"""Generation run: drain the `pending` queue in raw_api_data, one post at a time.

Status-driven (not date-range): every item ends the run in a terminal status, so the
next run picks up exactly what's left. Nothing is re-processed and nothing is lost.

On rate limits — there is no blanket `sleep` in this loop any more. Every provider is
gated at the **call site** instead (langgraph_bot/utils/ratelimit.py): the shared Groq
bucket, the Gemini embedding limiter, and the Pollinations limiter. A single item makes
~7 rate-limited calls across two concurrent branches, so a loop-level sleep could never
have been correct — it can't see inside an item. `PAUSE_BETWEEN_ITEMS` below is only a
politeness gap, not the rate-limit mechanism.
"""

import logging
import time
import traceback

from backend.db.repository.fetch_raw_data import fetch_pending_items, update_status
from langgraph_bot.insert_bot_data import insert_cleaned_data

from .workflow.complete_workflow import mjorgraph, write_complete_graph_png
from .workflow.description_workflow import write_description_graph_png
from .workflow.workflow import write_graph_summarygraph_png

logger = logging.getLogger(__name__)

MAX_ITEMS_PER_RUN = 20

PAUSE_BETWEEN_ITEMS = 2


def build_initial_state(post: dict) -> dict:
    """Map a raw_api_data row onto the graph state.

    `source_url` / `raw_id` / `content` are the plumbing that used to be missing:
    without them every generated post got a NULL `source_url`, no FK back to the raw
    row, and the description agent only ever saw the short feed blurb.
    """
    return {
        "slug": "",
        "user_input": (
            "generate the post using the given data in the state and keep it beginner "
            "friendly so freshers and new developers can understand the posts."
        ),
        "messages": [],
        "data": post.get("description") or "",
        "topic": post.get("title"),
        "title": post.get("title"),
        "summary": None,
        "description": None,
        "arxiv_urls": [],
        "documents": [],
        "tavily_search_result": None,
        "code": None,
        "name": post.get("source_name"),
        "generated_image": None,
        # --- provenance / source body ---
        "source_url": post.get("website"),
        "raw_id": post.get("id"),
        "content": post.get("content"),
        # --- gates start open; triage and dedup can only close them ---
        "should_process": True,
    }


def _skip_reason(result: dict) -> str:
    """Why did the gate close? Recorded in raw_api_data.last_error."""
    if result.get("is_duplicate"):
        existing = (result.get("duplicate_of") or {}).get("slug", "unknown")
        return f"duplicate of {existing}"

    triage = result.get("triage") or {}
    if not triage.get("is_it_relevant", True):
        return f"triage: {triage.get('reason', 'not relevant')}"
    if triage.get("importance") is not None:
        return f"triage: importance {triage['importance']} below threshold"
    return "filtered"


def run_entire_flow() -> dict:
    """Process up to MAX_ITEMS_PER_RUN pending items. Returns a counts summary."""
    pending = fetch_pending_items(limit=MAX_ITEMS_PER_RUN)
    counts = {"total": len(pending), "succeeded": 0, "skipped": 0, "failed": 0}

    for index, post in enumerate(pending, 1):
        raw_id = post["id"]
        title = post.get("title") or "<untitled>"
        logger.info("[%d/%d] %s", index, counts["total"], title[:80])

        try:
            
            update_status(raw_id, "processing")

            result = mjorgraph.invoke(build_initial_state(post))

            if not result.get("should_process"):
                reason = _skip_reason(result)
                update_status(raw_id, "skipped", error=reason)
                counts["skipped"] += 1
                logger.info("    skipped — %s", reason)
                # No pause: a skip touched the triage + embedding limiters already,
                continue

            insert_cleaned_data(result)
            update_status(raw_id, "succeeded")
            counts["succeeded"] += 1
            logger.info("    generated -> %s", result.get("slug"))
            time.sleep(PAUSE_BETWEEN_ITEMS)

        except Exception as e:
            update_status(raw_id, "failed", error=f"{type(e).__name__}: {e}")
            counts["failed"] += 1
            logger.error("    failed — %s", e)
            traceback.print_exc()

    return counts


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    write_description_graph_png()
    write_complete_graph_png()
    write_graph_summarygraph_png()

    summary = run_entire_flow()

    print(
        f"Run complete: {summary['succeeded']} generated, "
        f"{summary['skipped']} skipped, {summary['failed']} failed "
        f"(of {summary['total']} pending)"
    )
    if summary["total"] and summary["succeeded"] == 0:
        print(
            "WARNING: nothing was generated. If everything was skipped, check the "
            "triage threshold; if everything failed, check the logs above."
        )
