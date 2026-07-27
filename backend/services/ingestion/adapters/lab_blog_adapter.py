from ..base import SourceAdapter, RawData
import feedparser
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 2  # ingestion runs daily; 2-day window (with a 1-day overlap) guards
# against run-time drift missing posts near the boundary. The upsert dedups on
# `website` (ignore_duplicates=True), so re-seeing yesterday's posts costs nothing.


def _extract_content(entry) -> str | None:
    """Return the full article body if the feed shipped it (RSS content:encoded),
    else None. Many lab feeds only send a summary — that's fine, generation
    re-fetches from source_url later. This is a free win when the body is present."""
    content = entry.get("content")
    if content:
        # feedparser exposes content:encoded as a list of {'value': ...} dicts
        value = content[0].get("value")
        if value:
            return value
    return None


def _entry_published(entry) -> datetime | None:
    """Parse feedparser's published_parsed (UTC struct_time) to a tz-aware datetime."""
    t = (
        entry.get("published_parsed")
        or entry.get("updated_parsed")
        or entry.get("published")
    )
    if t is None:
        return None
    try:
        return datetime(*t[:6], tzinfo=timezone.utc)
    except Exception:
        return None


LAB_FEEDS = {
    "OpenAI": "https://openai.com/news/rss.xml",
    "Anthropic": "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml",
    "Hugging Face": "https://huggingface.co/blog/feed.xml",
    "Google DeepMind": "https://deepmind.google/blog/rss.xml",
    "Apple ML Research": "https://machinelearning.apple.com/rss.xml",
    "Amazon Science": "https://www.amazon.science/index.rss",
    "Microsoft Research": "https://www.microsoft.com/en-us/research/feed/",
    "NVIDIA Developer": "https://developer.nvidia.com/blog/feed",
}


class LabBlogAdapter(SourceAdapter):
    source_name = "Lab Releases"
    source_type = "rss"
    tier = 1

    def fetch(self) -> list[RawData]:
        items = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

        for lab_name, feed_url in LAB_FEEDS.items():
            feed = feedparser.parse(feed_url)
            # `bozo` is only a warning flag — many valid feeds trip it over a cosmetic
            # content-type (text/plain) or a declared-vs-actual encoding mismatch, yet
            # still parse fine. Only treat NO entries as a real failure.
            if not feed.entries:
                logger.error(
                    f"LabBlogAdapter: no entries for {lab_name} "
                    f"(bozo={feed.bozo}, {getattr(feed, 'bozo_exception', '')})"
                )
                continue
            if feed.bozo:
                logger.warning(
                    f"LabBlogAdapter: {lab_name} parsed with a warning "
                    f"({getattr(feed, 'bozo_exception', '')}) — {len(feed.entries)} entries kept"
                )
            for entry in feed.entries:
                published = _entry_published(entry)
                # If we can't parse the date, include it (better to over-ingest than miss).
                # If we can, skip anything older than the cutoff.
                if published is not None and published < cutoff:
                    continue
                items.append(
                    RawData(
                        title=entry.title,
                        description=entry.get("summary", ""),
                        source_url=entry.link,
                        source_name=lab_name,
                        source_type=self.source_type,
                        content=_extract_content(entry),
                    )
                )
        return items
