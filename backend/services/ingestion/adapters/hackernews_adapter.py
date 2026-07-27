from ..base import SourceAdapter, RawData
import httpx
import logging
import time

logger = logging.getLogger(__name__)

# SEARCH_QUERY = ["LLM", "AI agent", "language model", "AI", "Raised", "Funding", "Releases"]


class HackerNewsAdapter(SourceAdapter):
    source_name = "Hacker News"
    source_type = "api"
    tier = 1

    def fetch(self) -> list[RawData]:
        items = []
        # ~28-hour window: ingestion runs once a day, so we need the whole day's
        # stories. The extra 4h overlaps the previous run to survive run-time drift;
        # the upsert dedups on `website` (ignore_duplicates=True), so repeats are free.
        # points>50 keeps the bar high enough that a full day's catch stays small.
        cutoff = int(time.time()) - 100800
        try:
            response = httpx.get(
                "https://hn.algolia.com/api/v1/search",
                params={
                    "tags": "story",
                    # HN Algolia GET expects numericFilters as ONE comma-joined string
                    # with NO spaces. A Python list makes httpx emit repeated query
                    # params (numericFilters=a&numericFilters=b), which this endpoint
                    # does not AND together; a leading space makes it drop the filter.
                    "numericFilters": f"points>50,created_at_i>{cutoff}",
                    "hitsPerPage": 50,
                },
                timeout=15,
            )
            response.raise_for_status()
            hits = response.json().get("hits", [])

            for hit in hits:
                if not hit.get("title") or not hit.get("url"):
                    continue

                # Only real content goes in description. Most HN stories are
                # link posts with no body text, so this will often be empty —
                # that's honest, not a bug. Triage works off title alone in that case.
                description = hit.get("story_text") or ""

                items.append(
                    RawData(
                        title=hit["title"],
                        description=description,
                        source_url=hit["url"],
                        source_name=self.source_name,
                        source_type=self.source_type,
                        engagement_meta={
                            "points": hit.get("points", 0),
                            "num_comments": hit.get("num_comments", 0),
                        },
                    )
                )
        except Exception as e:
            logger.error(f"HackerNewsAdapter failed: {e}")

        return items
