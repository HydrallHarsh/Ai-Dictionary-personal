# import datetime
# from datetime import date
import logging
from typing import Dict, Generator, List

from backend.db.client import supabase
from backend.services.get_previous_days import get_previous_day

# from backend.services.get_previous_days import get_previous_day

logger = logging.getLogger(__name__)

VALID_STATUSES = ("pending", "processing", "succeeded", "skipped", "failed")


# LEGACY — date-range fetch. Superseded by `fetch_pending_items` (status-driven), which
# doesn't re-process yesterday's already-handled rows. Kept until nothing imports it.
def fetch_last_days_posts() -> Generator[Dict, None, None]:
    start = get_previous_day()
    response = (
        supabase.table("raw_api_data")
        .select("*")
        .gte("created_at", start)
        .order("created_at", desc=False)
        .execute()
    )
    # print(response)
    print("Fetched some posts from the database.")
    print(f"Number of posts fetched: {len(response.data)}")
    for row in response.data:
        # print(row)
        yield row


def fetch_pending_items(limit: int = 20) -> List[Dict]:
    """Oldest-first queue of raw items awaiting generation.

    Status-driven, not date-range: an item is picked up exactly once and its outcome
    is recorded on the row, so leftovers past `limit` simply carry to the next run
    instead of being lost or re-processed.

    Returns a list (not a generator) so the caller knows the batch size up front.
    """
    response = (
        supabase.table("raw_api_data")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    rows = response.data or []
    logger.info("Fetched %d pending item(s) (limit %d)", len(rows), limit)
    return rows


def update_status(raw_id: str, status: str, error: str | None = None) -> None:
    """Record an item's outcome on its raw_api_data row.

    On 'failed', also bumps `retry_count` so a permanently-broken item is visible as
    such (`SELECT * FROM raw_api_data WHERE retry_count > 2`) rather than silently
    retried forever.
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"invalid status {status!r}; expected one of {VALID_STATUSES}")

    payload: Dict = {"status": status, "last_error": error}

    if status == "failed":
        # supabase-py can't express `retry_count = retry_count + 1`, so read-then-write.
        try:
            current = (
                supabase.table("raw_api_data")
                .select("retry_count")
                .eq("id", raw_id)
                .single()
                .execute()
            )
            payload["retry_count"] = (current.data or {}).get("retry_count", 0) + 1
        except Exception as e:
            logger.warning("Could not read retry_count for %s: %s", raw_id, e)

    try:
        supabase.table("raw_api_data").update(payload).eq("id", raw_id).execute()
    except Exception as e:
        # Never let bookkeeping kill the run — but log loudly, because a failed status
        # write means this item will be picked up again next run.
        logger.error("Failed to set status=%s on %s: %s", status, raw_id, e)
