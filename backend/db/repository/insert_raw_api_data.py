from backend.db.client import supabase
from backend.services.main import fetch_all_data


def normalize(item):
    clean = {
        "source_name": item.get("source_name"),
        "website": item.get("website") or item.get("url"),
        "description": item.get("description") or item.get("content"),
        "title": item.get("title"),
        "created_at": item.get("created_at") or item.get("post_created_at"),
    }

    # remove None values (important for DB constraints)
    return {k: v for k, v in clean.items() if v is not None}


def insert_raw_api_data():
    data = fetch_all_data()

    if not data:
        print("No data fetched to insert.")
        return {"inserted": 0}

    inserted_count = 0

    for item in data:
        try:
            clean_item = normalize(item)

            # Skip invalid rows
            if not clean_item.get("website"):
                print("Skipping item (missing website/url)")
                continue

            supabase.table("raw_api_data").upsert(
                clean_item, on_conflict="website"
            ).execute()

            inserted_count += 1

        except Exception as e:
            print(f"Skipping item due to error: {e}")

    return {"inserted": inserted_count}


# testing the function
if __name__ == "__main__":
    result = insert_raw_api_data()
    print(result)
