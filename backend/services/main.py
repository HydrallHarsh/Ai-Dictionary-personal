"""
This module would be for the running of all the news and the fetching of
the news and the storing of the news in the database.
The automation of this file will be dont in a yml workflow file which will
run this file every 24 hours and fetch the news and store it in the database.
"""

import os
from backend.services.marktechpost_scraper.test_mtp_scraper import (
    test_full_scrape_pipeline,
)

from backend.services.newsapi_scrapper.news_api_fetcher import get_newsapi_data

from backend.services.product_hunt_wrapper.ph_wrapper import ProductHuntWrapper

# MTP Scraper
firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
url_mtp = "https://www.marktechpost.com/category/editors-pick/ai-agents/"

# NewsAPI
news_api_key = os.getenv("NEWSAPI_ORG_KEY")

# Product Hunt
product_hunt_token = os.getenv("product_hunt_access_token")


def fetch_all_data():
    if not firecrawl_api_key:
        raise ValueError(
            "Environment variable 'FIRECRAWL_API_KEY' is not set. "
            "Please create a .env file in the backend/ directory with your API key."
        )

    if not news_api_key:
        raise ValueError(
            "Environment variable 'NEWSAPI_ORG_KEY' is not set. "
            "Please create a .env file in the backend/ directory with your API key."
        )

    if not product_hunt_token:
        raise ValueError(
            "Environment variable 'product_hunt_access_token' is not set. "
            "Please create a .env file in the backend/ directory with your token."
        )

    try:
        # Start with MTP Scraper
        # Then fetch news from NewsAPI
        all_data = []
        news_api_result = get_newsapi_data()
        all_data.extend(news_api_result)
        mtp_result = test_full_scrape_pipeline()
        all_data.extend(mtp_result)

        # Finally fetch top products from Product Hunt
        product_hunt_result_ai = ProductHuntWrapper(
            product_hunt_token
        ).get_top_products_by_topic("artificial-intelligence")

        product_hunt_result_devtools = ProductHuntWrapper(
            product_hunt_token
        ).get_top_products_by_topic("developer-tools")

        print("Fetched data from all sources successfully!")
        print(
            type(mtp_result),
            type(news_api_result),
            type(product_hunt_result_ai),
            type(product_hunt_result_devtools),
        )

        print("Sample MTP Result:", mtp_result[:1])  # Print first item for brevity
        print("Sample NewsAPI Result:", news_api_result[:1])  # Print first item
        # Print first item
        # print("Sample Product Hunt AI Result:", product_hunt_result_ai[:1])
        # Print first item
        # print("Sample Product Hunt DevTools Result:", product_hunt_result_devtools[:1]

        return all_data

    except Exception as e:
        print(f"An error occurred while fetching data: {e}")


if __name__ == "__main__":
    fetch_all_data()
