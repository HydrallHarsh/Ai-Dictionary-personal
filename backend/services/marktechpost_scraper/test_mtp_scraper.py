"""Manual testing script for MarkTechPost Scraper.

This module provides manual tests for the MarkTechPost scraper to verify
fetching and scraping of AI-related blog posts.

Environment Setup:
    Requires FIRECRAWL_API_KEY environment variable set in a .env file
    located in the backend/ directory. Generate API key at:
    https://www.firecrawl.dev/

    Example .env file content:
        FIRECRAWL_API_KEY="YOUR_API_KEY_HERE"

Usage:
    Run as a module from repository root:
        python -m backend.services.marktechpost_scraper.test_mtp_scraper

Testing Approach:
    Uses manual verification through console output instead of automated assertions.
    Includes test functions for scraping MarkTechPost articles:
    - test_fetch_blog_urls(): Tests fetching blog URLs from the AI agents category
    - test_full_scrape_pipeline(): Tests the complete scraping pipeline with FireCrawl
"""

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
from fake_useragent import UserAgent
from backend.services.marktechpost_scraper.mtp_scraper import (
    # fetching_user_agents,
    fetch_blog_urls,
    fetch_tech_news_only,
    run_firecrawl_scrape,
)

# Testing MarkTechPost Scraper Functions
# Ensure you have set the environment variable "FIRECRAWL_API_KEY" with your
# FireCrawl API key before running the tests.
# Generate API key from - https://www.firecrawl.dev/
# TO TEST CREATE A .env FILE IN THE backend/ DIRECTORY AND ADD THE FOLLOWING LINE:
# FIRECRAWL_API_KEY="YOUR_API_KEY_HERE"
#
# THEN RUN `python -m backend.services.marktechpost_scraper.test_mtp_scraper`

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
if not firecrawl_api_key:
    raise ValueError(
        "Environment variable 'FIRECRAWL_API_KEY' is not set. "
        "Please create a .env file in the backend/ directory with your API key."
    )

# URL for MarkTechPost AI agents category
url_mtp = "https://www.marktechpost.com/category/editors-pick/ai-agents/"
ua = UserAgent()


def test_fetch_blog_urls():
    """Test fetching blog URLs and filtering tutorials."""
    print("Fetching user agents...")
    user_agents = ua.random
    # print(f"Found {len(user_agents)} user agents\n")

    print("Fetching blog URLs from MarkTechPost...")
    blog_links = fetch_blog_urls(url_mtp, user_agents)
    print(f"Found {len(blog_links)} blog links\n")

    print("Filtering out tutorial links...")
    tutorial_urls = fetch_tech_news_only(blog_links, user_agents)
    blog_links = blog_links - tutorial_urls
    print(f"After filtering: {len(blog_links)} non-tutorial blog links\n")

    print("Blog URLs:")
    for url in blog_links:
        print(url)

    return blog_links


def test_full_scrape_pipeline():
    """Test the complete scraping pipeline with FireCrawl."""
    print("\n" + "=" * 60)
    print("Starting Full Scrape Pipeline Test")
    print("=" * 60 + "\n")

    # Fetch blog URLs
    print("Fetching user agents...")
    user_agents = ua.random

    print("Fetching blog URLs...")
    blog_links = fetch_blog_urls(url_mtp, user_agents)

    print("Filtering tutorial links...")
    tutorial_urls = fetch_tech_news_only(blog_links, user_agents)
    blog_links = blog_links - tutorial_urls
    blog_links_list = list(blog_links)
    total_urls = len(blog_links)

    print(f"\nScraping {len(blog_links)} blog posts with FireCrawl...")
    successful_results = []
    failed_urls = []
    # Running FireCrawler using a Thread Pool
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {}
        for i, url in enumerate(blog_links_list):
            if i > 0 and i % 3 == 0:
                time.sleep(
                    2
                )  # Sleep for 1 second after every 3 requests to avoid rate limits

            future = executor.submit(run_firecrawl_scrape, url)
            futures[future] = url

        completed = 0
        for future in as_completed(futures):
            completed += 1
            url = futures[future]
            try:
                scraped_data = future.result()
                if isinstance(scraped_data, dict) and scraped_data:
                    successful_results.append(scraped_data)
                else:
                    failed_urls.append(url)
            except Exception as e:
                # Catch any exceptions that weren't handled in run_firecrawl_scrape
                print(f"⚠️  Unexpected error for {url[:60]}...: {type(e).__name__}")
                failed_urls.append(url)
            progress_pct = (completed / total_urls) * 100
            print(
                f"\n Progress: {completed}/{total_urls} ({progress_pct:.1f}%) | Success: {len(successful_results)} | Failed: {len(failed_urls)}"  # noqa: E501
            )

        # for url in blog_links:
        #     futures.append(executor.submit(run_firecrawl_scrape, url))

        # for future in as_completed(futures):
        #     result.append(future.result())

    print("\n" + "=" * 60)
    print("Scraping Complete!")
    print("=" * 60)
    print(f"✓ Successfully scraped: {len(successful_results)} articles")
    print(f"✗ Failed to scrape: {len(failed_urls)} articles")
    if failed_urls:
        print("\nFailed URLs:")
        for url in failed_urls[:5]:  # Show first 5
            print(f"  - {url}")
        if len(failed_urls) > 5:
            print(f"  ... and {len(failed_urls) - 5} more")
    return successful_results


if __name__ == "__main__":
    # Test 1: Fetch and display blog URLs
    # test_fetch_blog_urls()

    # Test 2: Run full scraping pipeline
    # (commented out by default as it uses API credits)
    # Uncomment the line below to test the full pipeline
    result = test_full_scrape_pipeline()
    for item in result:
        print("=" * 60)
        print(item)
        print("=" * 60 + "\n")
