"""Tier 1 ingestion runner.

Runs every Tier 1 (trigger) adapter, collects their `RawData` items, and upserts them
into `raw_api_data` with `status='pending'`. Tier 2 (context) sources — Latent Space,
Import AI, etc. — are NOT here; they're wired into the agent's research tools later.
"""

import logging

from backend.db.repository.raw_repo import upsert_raw_items
from backend.services.ingestion.base import RawData

from .adapters.arxiv_adapter import ArxivAdapter
from .adapters.github_trending_adapter import GithubTrendingAdapter
from .adapters.hackernews_adapter import HackerNewsAdapter
from .adapters.lab_blog_adapter import LabBlogAdapter

logger = logging.getLogger(__name__)

# Only Tier 1 sources. Each adapter's fetch() is contractually non-raising (returns []
# on failure), so one broken source never takes down the whole run.
ADAPTERS = [
    ArxivAdapter(),
    LabBlogAdapter(),
    HackerNewsAdapter(),
    GithubTrendingAdapter(),
]


def run_ingestion() -> int:
    all_items: list[RawData] = []

    for adapter in ADAPTERS:
        logger.info("Fetching from %s...", adapter.source_name)
        try:
            items = adapter.fetch()
        except Exception as e:
            # Belt-and-suspenders: fetch() should already swallow its own errors.
            logger.error("%s.fetch() raised unexpectedly: %s", adapter.source_name, e)
            items = []
        logger.info("  -> %s items from %s", len(items), adapter.source_name)
        all_items.extend(items)

    inserted = upsert_raw_items(all_items)
    logger.info(
        "Ingestion complete. %s fetched, %s new items queued.", len(all_items), inserted
    )
    return inserted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_ingestion()
