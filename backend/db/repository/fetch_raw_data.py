# import datetime
# from datetime import date
from typing import Dict, Generator

from backend.db.client import supabase
from backend.services.get_previous_days import get_previous_day

# from backend.services.get_previous_days import get_previous_day


def fetch_last_days_posts() -> Generator[Dict, None, None]:
    start = get_previous_day()
    response = (
        supabase.table("raw_api_data")
        .select("*")
        .gte("created_at", start)
        .order("created_at", desc=False)
        .execute()
    )
    # print(response)
    print("Fetched some posts from the database.")
    print(f"Number of posts fetched: {len(response.data)}")
    for row in response.data:
        # print(row)
        yield row
