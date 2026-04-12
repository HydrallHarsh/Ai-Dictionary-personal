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
from backend.db.repository.insert_raw_api_data import insert_raw_api_data

# MTP Scraper
firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
url_mtp = "https://www.marktechpost.com/category/editors-pick/ai-agents/"

# NewsAPI
news_api_key = os.getenv("NEWSAPI_ORG_KEY")

# Product Hunt
product_hunt_token = os.getenv("product_hunt_access_token")


def fetch_all_data():
    all_data = []
    errors = []
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
        errors.append(
            "Environment variable 'product_hunt_access_token' is not set. "
            "Please create a .env file in the backend/ directory with your API key."
        )

    try:
        news_api_result = get_newsapi_data()
        all_data.extend(news_api_result)
        print(f"NewsApI data fetched successfully: {len(news_api_result)} articles")
    except Exception as e:
        errors.append(f"Error fetching NewsAPI data: {str(e)}")
        print(f"[WARN] NewsAPI failed: {e}")

    try:
        mtp_result = test_full_scrape_pipeline()
        all_data.extend(mtp_result)
        print(f"MTP data fetched successfully: {len(mtp_result)} articles")
    except Exception as e:
        errors.append(f"Error fetching MTP data: {str(e)}")
        print(f"[WARN] MTP failed: {e}")

    if product_hunt_token:
        try:
            product_hunt_result_ai = ProductHuntWrapper(
                product_hunt_token
            ).get_top_products_by_topic("artificial-intelligence")

            product_hunt_result_devtools = ProductHuntWrapper(
                product_hunt_token
            ).get_top_products_by_topic("developer-tools")
            print(
                f"Product Hunt data fetched successfully: {len(product_hunt_result_ai) + len(product_hunt_result_devtools)} products"  # noqa: E501
            )
        except Exception as e:
            errors.append(f"Error fetching Product Hunt data: {str(e)}")
            print(f"[WARN] Product Hunt failed: {e}")  # noqa: E501

    if not all_data:
        raise RuntimeError("Failed to fetch any data from all sources.")

    if errors:
        print(f"[WARN] Completed with some failures: {errors}")

    return all_data


def run_fetch_and_store():
    data = fetch_all_data()
    result = insert_raw_api_data(data)
    print(f"Inserted {result['inserted']} items into raw_api_data")
    return result


if __name__ == "__main__":
    run_fetch_and_store()
