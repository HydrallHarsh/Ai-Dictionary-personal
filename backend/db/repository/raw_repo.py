"""Repository for the ingestion layer's writes to `raw_api_data`.

This replaces the ad-hoc `insert_raw_api_data.normalize()` path for the new
adapter-based ingestion (Phase 2). Items arrive as `RawData` dataclasses from the
adapters and are upserted with `status='pending'` for the LangGraph worker to pick up.
"""

import logging

from backend.db.client import supabase
from backend.services.ingestion.base import RawData

logger = logging.getLogger(__name__)


def _to_row(item: RawData) -> dict:
    """Map a RawData item to a raw_api_data row.

    Column mapping notes:
    - `website`      <- source_url   (the identity / dedup key for a raw item)
    - `metadata`     <- engagement_meta  (points/comments/stars → jsonb bag)
    - `content`      <- content       (full body when the feed shipped it, else None)
    """
    return {
        "title": item.title,
        "description": item.description,
        "website": item.source_url,  # dedup key (UNIQUE on raw_api_data)
        "source_name": item.source_name,
        "source_type": item.source_type,
        "content": item.content,  # full body when the feed shipped it, else None
        "metadata": item.engagement_meta or {},
        "status": "pending",
        "created_at": item.fetched_at.isoformat(),
    }


def upsert_raw_items(items: list[RawData]) -> int:
    """Upsert raw items keyed on `website`, returning the number of NEW rows inserted.

    `ignore_duplicates=True` => INSERT ... ON CONFLICT (website) DO NOTHING, so
    re-ingesting the same URL never clobbers an existing row's status/error. The
    UNIQUE(title) constraint was dropped in the redesign migration, so a title
    collision on a new URL no longer fails the batch — website is the sole key here.
    """
    # Guard: `website` is NOT NULL and UNIQUE. Drop items without a usable URL so a
    # batch of empty-string websites can't collide with each other on ''.
    rows = [_to_row(item) for item in items if item.source_url]
    dropped = len(items) - len(rows)
    if dropped:
        logger.warning(
            "upsert_raw_items: skipped %d item(s) with no source_url", dropped
        )

    if not rows:
        return 0

    result = (
        supabase.table("raw_api_data")
        .upsert(rows, on_conflict="website", ignore_duplicates=True)
        .execute()
    )

    # With DO NOTHING, only actually-inserted rows are returned. supabase-py returns
    # them in `.data`; treat its length as the newly-inserted count.
    return len(result.data or [])
