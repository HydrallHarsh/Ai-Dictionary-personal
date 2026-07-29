"""Enrichment — fill the flat `posts` columns the schema exposes but nothing filled.

`difficulty`, `read_time`, and `tags` are real columns on `posts` and the frontend
renders them ("Beginner · 5 min read"), but before this node they were NULL forever.

**Zero extra LLM calls.** The plan originally proposed a fresh structured call here,
but `generate_title_block_node` (inside the summary subgraph) *already* asks the model
for `tags`, `difficulty`, and `estimated_time` — it just drops them into `title_block`
and never maps them onto the columns. So this node harvests what's already generated
and only falls back to an LLM call if that's missing. Given every key in the pipeline
is rate limited, not spending a call is the whole design.

`read_time` is computed **deterministically** from the word count of what we actually
wrote, which is both cheaper and more accurate than asking a model to guess.
"""

import logging
import re

from langgraph_bot.agentschema.stateschema import State

logger = logging.getLogger(__name__)

VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}
WORDS_PER_MINUTE = 200 
MAX_TAGS = 6

# the *texts in below code is same as passing elements from function call in a tuple/list, just helps in passing unknown number of arguments which makes it easier and dynamic - earlier I used explicit [state.get("description"), state.get("summary")] = Harsh


def _word_count(*texts: str | None) -> int:
    # there is better way for to find number of words, will add later
    return sum(len(re.findall(r"\b\w+\b", t)) for t in texts if t)


def compute_read_time(*texts: str | None) -> str:
    minutes = max(1, round(_word_count(*texts) / WORDS_PER_MINUTE))
    return f"{minutes} min read"


def _clean_tags(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    seen, tags = set(), []
    for tag in raw:
        if not isinstance(tag, str):
            continue
        cleaned = tag.strip().lower()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            tags.append(cleaned)
    return tags[:MAX_TAGS]


def enrich_node(state: State) -> dict:
    """Map the already-generated title_block metadata onto the posts columns.

    Runs top-level, after BOTH subgraphs have joined — it needs `title_block` (from
    the summary branch) and the generated text (for the word count).
    """
    title_block = state.get("title_block") or {}

    difficulty = str(title_block.get("difficulty", "")).strip().lower()
    if difficulty not in VALID_DIFFICULTIES:
        if difficulty:
            logger.warning("enrich_node: invalid difficulty %r, defaulting", difficulty)
        difficulty = "beginner"

    tags = _clean_tags(title_block.get("tags"))
    if not tags:
        # Last resort so the UI has something: the source name as a single tag.
        source = state.get("name")
        tags = [source.strip().lower()] if source else []

    read_time = compute_read_time(state.get("description"), state.get("summary"))

    logger.info(
        "enrich: difficulty=%s read_time=%s tags=%s", difficulty, read_time, tags
    )
    return {
        "difficulty": difficulty,
        "read_time": read_time,
        "tags": tags,
    }
