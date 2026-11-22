import logging
import uuid
from typing import Dict, Generator, List

from backend.db.client import supabase
from backend.services.get_previous_days import get_previous_day

logger = logging.getLogger(__name__)

VALID_STATUSES = ("pending", "processing", "succeeded", "skipped", "failed")


# Legacy date-range fetch. Superseded by the status-driven queue below.
def fetch_last_days_posts() -> Generator[Dict, None, None]:
    start = get_previous_day()
    response = (
        supabase.table("raw_api_data")
        .select("*")
        .gte("created_at", start)
        .order("created_at", desc=False)
        .execute()
    )
    print("Fetched some posts from the database.")
    print(f"Number of posts fetched: {len(response.data)}")
    yield from response.data


def fetch_pending_items(limit: int = 20) -> List[Dict]:
    """Recover expired owners and atomically claim the oldest pending raw items.

    The database function locks candidate rows with ``FOR UPDATE SKIP LOCKED`` and
    changes them to ``processing`` in the same transaction. Overlapping workers
    therefore receive disjoint batches. Each claim has a five-minute lease and
    ownership token. A committed claim whose reply is lost expires without a
    heartbeat and is reclaimed on a later call; no returned ID is needed.
    """
    response = supabase.rpc(
        "claim_pending_raw_items",
        {"p_limit": limit, "p_claim_token": str(uuid.uuid4())},
    ).execute()
    rows = response.data or []
    logger.info("Claimed %d pending item(s) (limit %d)", len(rows), limit)
    return rows


def renew_claim(raw_id: str, claim_token: str) -> None:
    response = supabase.rpc(
        "renew_raw_item_claim", {"p_raw_id": raw_id, "p_claim_token": claim_token}
    ).execute()
    if response.data is not True:
        raise RuntimeError(f"Claim lease is no longer owned for {raw_id}")


def _read_status(raw_id: str) -> dict:
    response = (
        supabase.table("raw_api_data")
        .select("status,claim_token")
        .eq("id", raw_id)
        .single()
        .execute()
    )
    return response.data or {}


def update_status(
    raw_id: str,
    status: str,
    *,
    expected_status: str,
    error: str | None = None,
    claim_token: str | None = None,
    increment_retry: bool = False,
) -> None:
    """Atomically transition an item from ``expected_status`` to ``status``.

    Ownership is fenced by the claim token. Deterministic attempts increment the
    counter atomically, including bounded pending releases. If a reply is lost,
    verify the target status AND token instead of acknowledging another owner.
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"invalid status {status!r}; expected one of {VALID_STATUSES}")
    if expected_status not in VALID_STATUSES:
        raise ValueError(
            f"invalid expected_status {expected_status!r}; expected one of {VALID_STATUSES}"
        )
    if expected_status == "processing" and not claim_token:
        raise ValueError("A processing transition requires its claim token")

    transition_error: Exception | None = None
    try:
        response = supabase.rpc(
            "transition_raw_item_status",
            {
                "p_raw_id": raw_id,
                "p_expected_status": expected_status,
                "p_new_status": status,
                "p_error": error,
                "p_claim_token": claim_token,
                "p_increment_retry": increment_retry,
            },
        ).execute()
        if response.data is True:
            return
    except Exception as error_from_rpc:
        transition_error = error_from_rpc

    try:
        current = _read_status(raw_id)
        current_status = current.get("status")
    except Exception as verification_error:
        message = f"could not verify transition {raw_id}: {expected_status} -> {status}"
        if transition_error is not None:
            raise RuntimeError(message) from transition_error
        raise RuntimeError(message) from verification_error

    if current_status == status and current.get("claim_token") == claim_token:
        logger.warning(
            "Status transition response was ambiguous for %s, but target status=%s is stored",
            raw_id,
            status,
        )
        return

    message = (
        f"required status transition failed for {raw_id}: expected {expected_status}, "
        f"found {current_status!r}, target {status}"
    )
    if transition_error is not None:
        raise RuntimeError(message) from transition_error
    raise RuntimeError(message)
