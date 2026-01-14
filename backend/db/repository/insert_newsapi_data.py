from db.client import supabase
from services.newsapi_scrapper.news_api_fetcher import get_newsapi_data


def insert_articles(rows: list):
    """
    Inserts a list of pre-processed articles into Supabase.
    Each row should have keys: website, description, title, created_at.
    Handles duplicates (website), empty lists.
    """
    if not rows:
        print("No articles to insert.")
        return {"inserted": 0}

    # Filter out rows with missing website or title
    valid_rows = [r for r in rows if r.get("website") and r.get("title")]
    if not valid_rows:
        print("All articles invalid, nothing to insert.")
        return {"inserted": 0}

    try:
        # Upsert: insert or update if website already exists

        (
            supabase.table("raw_api_data")
            .upsert(valid_rows, on_conflict="website")  # website is unique
            .execute()
        )

        inserted_count = len(valid_rows)
        print(f"Inserted {inserted_count} articles into Supabase.")
        return {"inserted": inserted_count}

    except Exception as e:
        print(f"Failed to insert articles: {e}")
        return {"inserted": 0}


