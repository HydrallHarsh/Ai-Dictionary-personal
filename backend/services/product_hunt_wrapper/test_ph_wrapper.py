import os
from ph_wrapper import ProductHuntWrapper
from dotenv import load_dotenv

# Testing Product Hunt Wrapper Functions
# Ensure you have set the environment variable "product_hunt_access_token" with your Product Hunt API access token before running the tests.
# Generate access token from - https://www.producthunt.com/v2/oauth/applications
# TO TEST CREATE A .env FILE IN THE backend/ DIRECTORY AND ADD THE FOLLOWING LINE:
# product_hunt_access_token="YOUR_ACCESS_TOKEN_HERE"
#
# THEN RUN `uv run backend/services/product_hunt_wrapper/test_ph_wrapper.py`

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

access_token = os.getenv("product_hunt_access_token")
ph = ProductHuntWrapper(access_token)
def test1():
    top_ai_products = ph.get_top_products_topic_ai()
    print("Top AI Products:")
    for i in top_ai_products:
        print(i,"\n")
    
def test2():
    print("\n")
    top_dev_tools_products = ph.get_top_products_topic_developer_tools()
    print("Top Developer Tools Products:")
    for i in top_dev_tools_products:
        print(i,"\n")

if __name__ == "__main__":
    test1()
    test2()