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
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv

from mtp_scraper import (
    fetching_user_agents,
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


def test_fetch_blog_urls():
    """Test fetching blog URLs and filtering tutorials."""
    print("Fetching user agents...")
    user_agents = fetching_user_agents()
    print(f"Found {len(user_agents)} user agents\n")

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
    user_agents = fetching_user_agents()

    print("Fetching blog URLs...")
    blog_links = fetch_blog_urls(url_mtp, user_agents)

    print("Filtering tutorial links...")
    tutorial_urls = fetch_tech_news_only(blog_links, user_agents)
    blog_links = blog_links - tutorial_urls

    print(f"\nScraping {len(blog_links)} blog posts with FireCrawl...")

    # Running FireCrawler using a Thread Pool
    result = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = []
        for url in blog_links:
            futures.append(executor.submit(run_firecrawl_scrape, url))

        for future in as_completed(futures):
            result.append(future.result())

    print(f"\nSuccessfully scraped {len(result)} articles\n")

    print("Scraped Data:")
    for item in result:
        print("=" * 60)
        print(item)
        print("=" * 60 + "\n")


if __name__ == "__main__":
    # Test 1: Fetch and display blog URLs
    test_fetch_blog_urls()

    # Test 2: Run full scraping pipeline
    # (commented out by default as it uses API credits)
    # Uncomment the line below to test the full pipeline
    test_full_scrape_pipeline()
