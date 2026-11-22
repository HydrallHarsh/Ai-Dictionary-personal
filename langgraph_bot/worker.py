"""Queue orchestration with injectable I/O so failure handling can be tested offline."""

import logging
import time
from threading import Event, Thread

from langgraph_bot.utils.errors import is_deterministic_provider_error

logger = logging.getLogger(__name__)


class _ClaimLease:
    """Renew a live claim while synchronous graph/provider calls are running."""

    def __init__(self, renew, raw_id, token, interval):
        self.renew = renew
        self.raw_id = raw_id
        self.token = token
        self.interval = interval
        self.stopped = Event()
        self.error = None
        self.thread = None

    def refresh(self):
        if self.error is not None:
            raise RuntimeError("Claim lease renewal failed") from self.error
        self.renew(self.raw_id, self.token)

    def start(self):
        self.refresh()
        self.thread = Thread(target=self._heartbeat, daemon=True)
        self.thread.start()

    def _heartbeat(self):
        while not self.stopped.wait(self.interval):
            try:
                self.renew(self.raw_id, self.token)
            except Exception as error:
                self.error = error
                return

    def stop(self):
        self.stopped.set()
        if self.thread is not None:
            self.thread.join(timeout=1)


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


def drain_queue(
    *, fetch, invoke, transition, publish, find_existing, renew,
    limit=20, pause=2, sleep=time.sleep, heartbeat_interval=60, max_item_attempts=3,
) -> dict:
    """Renew owned claims, bound deterministic input failures, and reconcile posts.

    Lost claim replies and forced exits are recovered by lease expiry in the next
    database claim. Transient/unknown failures still release work and halt the run.
    """
    if heartbeat_interval <= 0 or max_item_attempts < 1:
        raise ValueError("Heartbeat interval and item attempt limit must be positive")
    counts = {"total": 0, "succeeded": 0, "skipped": 0, "failed": 0, "released": 0, "halted": False}
    for _ in range(limit):
        try:
            claimed = fetch(limit=1)
        except Exception:
            counts["failed"] += 1
            counts["halted"] = True
            logger.exception("Claim failed; any committed claim will recover after lease expiry")
            break
        if not claimed:
            break
        # The claim RPC's limit=1 contract must hold; release everything if it does not.
        settled = set()
        lease = None
        counts["total"] += len(claimed)
        try:
            if len(claimed) != 1:
                raise RuntimeError("Queue claim returned more than one item for limit=1")
            post = claimed[0]
            raw_id = post["id"]
            token = post["claim_token"]
            lease = _ClaimLease(renew, raw_id, token, heartbeat_interval)
            lease.start()
            if find_existing(raw_id):
                lease.refresh()
                transition(raw_id, "succeeded", expected_status="processing", claim_token=token)
                settled.add(raw_id)
                counts["succeeded"] += 1
                continue
            result = invoke(build_initial_state(post))
            lease.refresh()
            if (result.get("triage") or {}).get("available") is False:
                raise RuntimeError("Triage is unavailable")
            if not result.get("should_process"):
                transition(raw_id, "skipped", expected_status="processing", error=skip_reason(result), claim_token=token)
                settled.add(raw_id)
                counts["skipped"] += 1
                continue
            publish(result)
            transition(raw_id, "succeeded", expected_status="processing", claim_token=token)
            settled.add(raw_id)
            counts["succeeded"] += 1
            sleep(pause)
        except Exception as error:
            counts["failed"] += 1
            if lease is not None and is_deterministic_provider_error(error):
                attempt = (post.get("retry_count") or 0) + 1
                target = "failed" if attempt >= max_item_attempts else "pending"
                try:
                    lease.refresh()
                    transition(
                        raw_id, target, expected_status="processing", claim_token=token,
                        increment_retry=True,
                        error=f"provider input limit: attempt {attempt}/{max_item_attempts}",
                    )
                except Exception:
                    counts["halted"] = True
                    logger.exception("Could not settle deterministic item failure")
                    break
                settled.add(raw_id)
                counts["released"] += target == "pending"
                logger.exception("Item %s reached deterministic attempt %d; status=%s", raw_id, attempt, target)
                continue
            counts["halted"] = True
            logger.exception("Queue run halted; unsettled work will be released for retry")
            break
        finally:
            if lease is not None:
                lease.stop()
            for item in claimed:
                raw_id = item.get("id")
                if raw_id in settled:
                    continue
                try:
                    transition(raw_id, "pending", expected_status="processing", claim_token=item.get("claim_token"))
                    counts["released"] += 1
                except Exception:
                    counts["halted"] = True
                    logger.exception("Could not release claim %s; recovery is required", raw_id)
    return counts
