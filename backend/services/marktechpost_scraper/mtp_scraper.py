import os
import re
import requests
from bs4 import BeautifulSoup
from typing import Optional
from datetime import date, timedelta
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


def fetch_blog_urls(url_mtp: str, user_agents: list) -> set:
    blog_links = set()
    try:
        for _headers in user_agents:
            header = {"User-Agent": f"{_headers}"}
            response = requests.get(url=url_mtp, headers=header, timeout=10)
            # check for connection_errors if any
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "lxml")
            curr_year = date.today().strftime("%Y")
            curr_month = date.today().strftime("%m")
            # Fetch blogs from last 4 days, excluding todays day
            # because we have 1 day delay for extra leverage for safety
            for day in range(4, 0, -1):
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
        raise


def fetch_tech_news_only(blog_links: set, user_agents: list) -> set:
    tutorial_links_set = set()
    try:
        for url in blog_links:
            if not user_agents:
                raise Exception("User Agent Empty")
            header = {"User-Agent": f"{user_agents[0]}"}
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
def run_firecrawl_scrape(url) -> str:
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
                    ),
                }
            ],
            only_main_content=False,
            timeout=180000,
        )
        return result.model_dump_json(include="json")
        # print(result.model_dump_json(include="json"))
    except requests.exceptions.RequestException as e:
        print(f"Error in Scraping website {e}")
