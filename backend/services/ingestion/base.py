from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class RawData:
    title: str
    description: str
    source_url: str
    source_name: str
    source_type: str
    fetched_at: datetime = None
    engagement_meta: Optional[dict] = (
        None  # points, comments, etc. — not content, just signal
    )
    content: Optional[str] = (
        None  # full article body when the feed ships it (RSS content:encoded); None otherwise
    )

    def __post_init__(self):
        if self.fetched_at is None:
            self.fetched_at = datetime.now(timezone.utc)


class SourceAdapter(ABC):
    source_name: str  # human label for the source, e.g. "Hacker News"
    source_type: str  # how we fetch it: one of 'rss', 'api', 'scraper', 'other' (matches raw_api_data CHECK)
    tier: int = 1  # Tier 1 = trigger source. Tier 2 sources don't use this adapter pattern at all

    @abstractmethod
    def fetch(self) -> list[RawData]:
        """Fetches the data from the respective Sources and returns the array of items or []"""
        ...
