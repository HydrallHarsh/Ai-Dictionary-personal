import os
import re
import requests
from bs4 import BeautifulSoup
from typing import Optional
from datetime import date, datetime, timedelta
from firecrawl import Firecrawl
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")


class ScrapedData(BaseModel):
    source_name: Optional[str] = None
    url: Optional[str] = None
    slug: Optional[str] = None
    tagline: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    created_at: Optional[datetime] = None


# We also need to fetch latest User-agent to avoid 520 Errors
def fetching_user_agents() -> list:
    try:
        user_agents = []
        url = "https://www.useragentlist.net/"
        user_agent_res = requests.get(url=url, timeout=10)
        # another soup instance for this
        user_agent_soup = BeautifulSoup(user_agent_res.text, "lxml")
        for agents in user_agent_soup.select("pre.wp-block-code"):
            user_agents.append(agents.text)
        if not user_agents:
            raise ValueError("No User Agent Found")
        return user_agents
    except requests.exceptions.RequestException as e:
        print(f"Error in fetching User Gate {e}")
        raise


def fetch_blog_urls(url_mtp: str, user_agent: str) -> set:
    blog_links = set()
    try:
        header = {"User-Agent": f"{user_agent}"}
        response = requests.get(url=url_mtp, headers=header, timeout=10)
        # check for connection_errors if any
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "lxml")
        curr_year = date.today().strftime("%Y")
        curr_month = date.today().strftime("%m")
        # Fetch blogs from last 4 days, excluding todays day
        # because we have 1 day delay for extra leverage for safety
        for day in range(2, 0, -1):
            curr_day = (date.today() - timedelta(day)).strftime("%d")
            blogs = soup.find_all(
                href=re.compile(
                    f"https://www.marktechpost.com/{curr_year}/{curr_month}/{curr_day}/[^/]+/$"
                )
            )
            for blog in blogs:
                blog_links.add(blog["href"])
            if response.status_code == 200:
                break
        return blog_links
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the data from url {e}")


def fetch_tech_news_only(blog_links: set, user_agent: str) -> set:
    tutorial_links_set = set()
    try:
        for url in blog_links:
            if not user_agent:
                raise Exception("User Agent Empty")
            header = {"User-Agent": f"{user_agent}"}
            blog_res = requests.get(url, headers=header)
            blog_soup = BeautifulSoup(blog_res.text, "lxml")
            block = blog_soup.find("div", class_="td-post-header")
            target_link = block.find("a", string=re.compile(r"Tutorials"))
            if target_link is not None:
                tutorial_links_set.add(url)
        return tutorial_links_set
    except requests.exceptions.RequestException as e:
        print(f"Error filtering tutorials {e}")


# Extract/ Scrape content using FireCrawl API
def run_firecrawl_scrape(url) -> dict:
    try:
        app = Firecrawl(api_key=firecrawl_api_key)
        result = app.scrape(
            url,
            formats=[
                {
                    "type": "json",
                    "schema": ScrapedData.model_json_schema(),
                    "prompt": (
                        "Extract the data and most importantly content "
                        "present in the URL and follow the JSON schema. "
                        "The content key should have whole explanation "
                        "as it is in the website of the website/blog in "
                        "text. Strictly copy paste the content explaination "
                        'as it is and dont shorten or summarize it "DONT"'
                        "Content is the most important key here and it should"
                        "have the whole content of the website/blog."
                        "Dont miss any part of the content and strictly follow the JSON schema."  # noqa: E501
                        "Dont try to summarize or shorten the content"
                        "Copy paste the content as it is from the website/blog"
                        "created_at should be the post timestamp in ISO-8601 UTC format (example: 2026-01-01T12:34:56Z)."  # noqa: E501
                    ),
                }
            ],
            only_main_content=False,
            timeout=150000,
            wait_for=2000,
            block_ads=True,
            store_in_cache=False,
            proxy="auto",
            profile={"name": "MarkTechPost Scraper", "saveChanges": True},
        )

        json_result = result.json
        if not json_result:
            raise ValueError("Firecrawl response did not include a `json` payload")

        # validate the json result with the schema
        validated_result = ScrapedData.model_validate(json_result)
        return validated_result.model_dump(mode="json", exclude_none=True)
    except requests.exceptions.RequestException as e:
        print(f"Error in Scraping website {e}")
