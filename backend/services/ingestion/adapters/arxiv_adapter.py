from ..base import SourceAdapter, RawData
import feedparser
import logging

logger = logging.getLogger(__name__)

ARXIV_CATEGORIES = ["cs.AI", "cs.LG"]
MAX_PER_CATEGORY = 25

_API_BASE = "https://export.arxiv.org/api/query"


class ArxivAdapter(SourceAdapter):
    source_name = "Arxiv"
    source_type = "api"
    tier = 1

    def fetch(self) -> list[RawData]:
        items = []
        for category in ARXIV_CATEGORIES:
            url = (
                f"{_API_BASE}?search_query=cat:{category}"
                f"&sortBy=submittedDate&sortOrder=descending"
                f"&max_results={MAX_PER_CATEGORY}"
            )
            feed = feedparser.parse(url)

            # `bozo` is only a warning (content-type/encoding quibbles); a valid feed
            # can trip it and still parse. Only NO entries is a real failure.
            if not feed.entries:
                logger.error(
                    f"ArxivAdapter: no entries for {category} "
                    f"(bozo={feed.bozo}, {getattr(feed, 'bozo_exception', '')})"
                )
                continue
            for entry in feed.entries:
                items.append(
                    RawData(
                        title=entry.title,
                        description=entry.get("summary", ""),
                        source_url=entry.link,
                        source_name=f"Arxiv ({category})",
                        source_type=self.source_type,
                    )
                )
        return items
