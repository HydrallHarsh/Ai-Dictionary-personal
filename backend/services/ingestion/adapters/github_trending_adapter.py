from ..base import SourceAdapter, RawData
from datetime import datetime, timezone, timedelta
import httpx
import os
import logging

logger = logging.getLogger(__name__)

AI_TOPICS = ["llm", "agent", "machine-learning", "generative-ai", "ai"]

# "Trending" = new projects gaining traction, NOT old giants that got a commit today.
# The GitHub search API has no "stars-gained-recently" sort, so we approximate it:
# restrict to repos CREATED in the last N days, then sort by stars. A repo created
# 3 years ago (n8n, langchain, ...) can never match, however active it is today.
CREATED_LOOKBACK_DAYS = 7
MIN_STARS = 500  # floor out the long tail of brand-new repos with ~0 traction
PER_TOPIC = 10


class GithubTrendingAdapter(SourceAdapter):
    source_name = "Github Trending"
    source_type = "api"
    tier = 1

    def fetch(self) -> list[RawData]:
        items = []

        created_since = (
            datetime.now(timezone.utc) - timedelta(days=CREATED_LOOKBACK_DAYS)
        ).strftime("%Y-%m-%d")

        headers = {"Accept": "application/vnd.github+json"}
        token = os.getenv("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        for topic in AI_TOPICS:
            try:
                response = httpx.get(
                    "https://api.github.com/search/repositories",
                    params={
                        "q": f"topic:{topic} created:>{created_since} stars:>{MIN_STARS}",
                        "sort": "stars",
                        "order": "desc",
                        "per_page": PER_TOPIC,
                    },
                    headers=headers,
                    timeout=15,
                )

                response.raise_for_status()
                repos = response.json().get("items", [])

                for repo in repos:
                    items.append(
                        RawData(
                            title=f"{repo['full_name']}: {repo.get('description', '')}",
                            description=repo.get("description", ""),
                            source_url=repo["html_url"],
                            source_name=self.source_name,
                            source_type=self.source_type,
                            engagement_meta={
                                "stars": repo.get("stargazers_count", 0),
                                "created_at": repo.get("created_at"),
                            },
                        )
                    )

            except Exception as e:
                logger.error(f"GithubTrendingAdapter failed for topic {topic}: {e}")
                continue

        return items
