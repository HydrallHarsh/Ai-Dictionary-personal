"""Queue orchestration with injectable I/O so failure handling can be tested offline."""

import logging
import time

logger = logging.getLogger(__name__)


def build_initial_state(post: dict) -> dict:
    return {
        "slug": "", "user_input": "Explain the source for beginner developers. Use only supported facts.",
        "messages": [], "data": post.get("description") or "",
        "topic": post.get("title"), "title": post.get("title"),
        "summary": None, "description": None, "arxiv_urls": [], "documents": [],
        "tavily_search_result": None, "code": None, "name": post.get("source_name"),
        "generated_image": None, "source_url": post.get("website"),
        "raw_id": post.get("id"), "content": post.get("content"), "should_process": True,
    }


def skip_reason(result: dict) -> str:
    if result.get("is_duplicate"):
        return f"duplicate of {(result.get('duplicate_of') or {}).get('slug', 'unknown')}"
    return f"triage: {(result.get('triage') or {}).get('reason', 'filtered')}"


def drain_queue(*, fetch, invoke, transition, publish, find_existing, limit=20, pause=2, sleep=time.sleep) -> dict:
    """Claim one item at a time and stop without discarding work on any failure.

    A single claim bounds the damage of forced termination until database leases
    are introduced. Python exits release it; SIGKILL still needs lease recovery.
    Check publication before generation so an ambiguous earlier commit is reconciled.
    """
    counts = {"total": 0, "succeeded": 0, "skipped": 0, "failed": 0, "released": 0, "halted": False}
    for _ in range(limit):
        claimed = fetch(limit=1)
        if not claimed:
            break
        # The claim RPC's limit=1 contract must hold; release everything if it does not.
        settled = set()
        counts["total"] += len(claimed)
        try:
            if len(claimed) != 1:
                raise RuntimeError("Queue claim returned more than one item for limit=1")
            post = claimed[0]
            raw_id = post["id"]
            if find_existing(raw_id):
                transition(raw_id, "succeeded", expected_status="processing")
                settled.add(raw_id)
                counts["succeeded"] += 1
                continue
            result = invoke(build_initial_state(post))
            if (result.get("triage") or {}).get("available") is False:
                raise RuntimeError("Triage is unavailable")
            if not result.get("should_process"):
                transition(raw_id, "skipped", expected_status="processing", error=skip_reason(result))
                settled.add(raw_id)
                counts["skipped"] += 1
                continue
            publish(result)
            transition(raw_id, "succeeded", expected_status="processing")
            settled.add(raw_id)
            counts["succeeded"] += 1
            sleep(pause)
        except Exception:
            counts["failed"] += 1
            counts["halted"] = True
            logger.exception("Queue run halted; unsettled work will be released for retry")
            break
        finally:
            for item in claimed:
                raw_id = item.get("id")
                if raw_id in settled:
                    continue
                try:
                    transition(raw_id, "pending", expected_status="processing")
                    counts["released"] += 1
                except Exception:
                    counts["halted"] = True
                    logger.exception("Could not release claim %s; recovery is required", raw_id)
    return counts
