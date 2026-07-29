"""Triage gate — the cheap filter that runs before any expensive generation.

One structured Groq call per raw item decides whether it's worth writing a post
about. Everything downstream (the dedup embedding, ~4 more Groq calls, an image)
is skipped when this says no, which is the whole point: filtering costs one call,
generating costs ~8.
"""

import logging

from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.models.generativemodel import triagemodel

logger = logging.getLogger(__name__)


MIN_IMPORTANCE = 2


class TriageResult(BaseModel):
    is_it_relevant: bool
    importance: int = Field(ge=1, le=5)
    reason: str



structured = triagemodel.with_structured_output(TriageResult, method="json_schema")


TRIAGE_PROMPT = """
You are filtering articles for an AI news platform aimed at beginner developers.
We want concrete, buildable AI developments — NOT generic AI commentary.

Article title: {title}
Article description: {description}

Decide:
1. is_it_relevant: True ONLY if the article is about at least one of:
   - a new or updated AI/ML MODEL (LLM, image/audio/video, embeddings, etc.)
   - a new AI TOOL or DEV TOOL (frameworks, libraries, APIs, SDKs, IDEs, infra)
   - an AI AGENT or agentic system / capability
   - concrete AI RESEARCH with a technical result or method
   - a notable RELEASE / launch / feature in the AI dev ecosystem
   Mark False for everything else, including: generic AI news, business/funding/valuation
   stories, hype or opinion pieces, policy/regulation/ethics debates, "AI will change X"
   think-pieces, and anything with no technical or buildable substance for a developer.
   When in doubt, prefer False.
2. importance: 1 (minor tool/update) to 5 (major model release / breakthrough)
3. reason: one sentence explaining your decision

Respond with JSON only.
"""


def triage_node(state: State) -> dict:
    title = state.get("topic") or state.get("title") or ""
    description = state.get("data") or ""

    if not title.strip():
        # Nothing to classify. Fail CLOSED here (unlike the error path below): an item
        # with no title gives the generator nothing to work from either.
        logger.warning("triage_node: item has no title/topic, skipping")
        return {
            "triage": {
                "is_it_relevant": False,
                "importance": 0,
                "reason": "no title available to triage",
            },
            "should_process": False,
        }

    try:
        result: TriageResult = structured.invoke(
            [
                HumanMessage(
                    content=TRIAGE_PROMPT.format(title=title, description=description)
                )
            ],
            config={
                "run_name": "triage",
                "tags": [state.get("name") or "unknown-source"],
                "metadata": {"raw_id": state.get("raw_id")},
            },
        )
    except Exception as e:
        logger.error("triage_node: call failed, passing item through: %s", e)
        return {
            "triage": {
                "is_it_relevant": True,
                "importance": MIN_IMPORTANCE,
                "reason": f"triage unavailable ({type(e).__name__}), passed through",
            },
            "should_process": True,
        }

    should_process = result.is_it_relevant and result.importance >= MIN_IMPORTANCE
    logger.info(
        "triage: %s | relevant=%s importance=%s -> %s",
        title[:70],
        result.is_it_relevant,
        result.importance,
        "process" if should_process else "skip",
    )
    return {
        "triage": result.model_dump(),
        "should_process": should_process,
    }
