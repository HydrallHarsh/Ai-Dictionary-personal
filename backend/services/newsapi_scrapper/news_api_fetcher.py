from datetime import date, timedelta
from dotenv import load_dotenv
from newsapi import NewsApiClient
from newspaper import Article
from newspaper.article import ArticleException
import json
import os
import requests
import ssl

load_dotenv()
# load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

news_api_key = os.getenv("NEWSAPI_ORG_KEY")
if not news_api_key:
    raise ValueError(
        "Environment variable 'NEWSAPI_ORG_KEY' is not set. "
        "Please create a .env file in the backend/ directory with your API key."
    )
# Init


def get_newsapi_client():
    return NewsApiClient(api_key=news_api_key)


# using requests
def get_newsorg_data(q: str):
    responses = requests.get(
        f"https://newsapi.org/v2/everything?q={q}&domains=techcrunch.com,thenextweb.com&from=2026-01-01&to=2026-01-05&apiKey={news_api_key}&"
    )
    combined = b"".join(responses)

    try:
        text = combined.decode("utf-8")
        data = json.loads(text)
    except json.JSONDecodeError as e:
        print("Invalid JSON:", e)
        print(text[:500])

    return data["articles"]


# for fetching the full article using the url
def get_full_article_content(url):
    """
    Returns the full article data using url in string format.

    PARAMS:url
    RETURN:str
    """
    try:
        article = Article(url)
        article.download()
        article.parse()
        return article.text

    except ArticleException as e:
        print(f"Article parse failed: {url} | {e}")
        return None

    except ssl.SSLError as e:
        print(f"SSL error while fetching: {url} | {e}")
        return None

    except Exception:
        print(f"Unexpected error scraping {url}")
        return None


# get the previous date
def get_previous_day(today: date | None = None) -> date:
    """
    Returns a date offset for article queries.

    Uses a 2-day offset to ensure sufficient article availability.
    Args:
        today (date, optional): Provide a date for testing.
                                Defaults to today's local date.
    Returns:
        date: The date two days before `today`.
    """
    if today is None:
        today = date.today()
    return today - timedelta(days=2)


# using function api
def get_newsapi_data():
    """
    fetch articles using newsapi

    Return : list of dictionary containing website(url),description , title,created_at
    """
    try:
        newsapi = get_newsapi_client()
        all_articles = newsapi.get_everything(
            q="AI",
            domains="techcrunch.com,thenextweb.com",
            from_param=get_previous_day().strftime("%Y-%m-%d"),  # previous date
            to=date.today().strftime("%Y-%m-%d"),  # latest/current date
            language="en",
            sort_by="relevancy",
        )
    except Exception as e:
        print(f"Exception {e} occured while fetching articles")
        return []

    clean_articles = []
    for x in all_articles["articles"]:
        x["content"] = get_full_article_content(
            x["url"]
        )  # update content so it has full content fromt the article and does not
        # show[+3000 chars..]
        if x["content"] is None:
            print("skipping full article")
            continue
        else:
            clean_articles.append(
                {
                    "source_name": x["source"]["name"],
                    "website": x["url"],
                    "description": x["content"],
                    "title": x["title"],
                    "created_at": x["publishedAt"],
                }
            )

    return clean_articles
