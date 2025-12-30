"""Manual testing script for ProductHuntWrapper.

This module provides manual tests for the Product Hunt API wrapper to verify
fetching of top products by different topics.

Environment Setup:
    Requires product_hunt_access_token environment variable set in a .env file
    located in the backend/ directory. Generate tokens at:
    https://www.producthunt.com/v2/oauth/applications

    Example .env file content:
        product_hunt_access_token="YOUR_ACCESS_TOKEN_HERE"

Usage:
    Run as a module from repository root:
        python -m backend.services.product_hunt_wrapper.test_ph_wrapper

Testing Approach:
    Uses manual verification through console output instead of automated assertions.
    Includes two test functions for fetching products by different topics:
    - test1(): Tests fetching AI products
    - test2(): Tests fetching developer tools products
"""

import os

from dotenv import load_dotenv

from .ph_wrapper import ProductHuntWrapper

# Testing Product Hunt Wrapper Functions
# Ensure you have set the environment variable "product_hunt_access_token" with your
# Product Hunt API access token before running the tests.
# Generate access token from - https://www.producthunt.com/v2/oauth/applications
# TO TEST CREATE A .env FILE IN THE backend/ DIRECTORY AND ADD THE FOLLOWING LINE:
# product_hunt_access_token="YOUR_ACCESS_TOKEN_HERE"
#
# THEN RUN `uv run backend/services/product_hunt_wrapper/test_ph_wrapper.py`

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

access_token = os.getenv("product_hunt_access_token")
if not access_token:
    raise ValueError(
        "Environment variable 'product_hunt_access_token' is not set. "
        "Please create a .env file in the backend/ directory with your token."
    )
ph = ProductHuntWrapper(access_token)


def test1():
    """Test fetching AI products and print results to console."""
    top_ai_products = ph.get_top_products_topic_ai()
    print("Top AI Products:")
    for i in top_ai_products:
        print(i, "\n")


def test2():
    """Test fetching developer tools products and print results to console."""
    print("\n")
    top_dev_tools_products = ph.get_top_products_topic_developer_tools()
    print("Top Developer Tools Products:")
    for i in top_dev_tools_products:
        print(i, "\n")


if __name__ == "__main__":
    test1()
    test2()
