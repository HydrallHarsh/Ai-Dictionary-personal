from backend.db.client import supabase
from datetime import datetime
import uuid


def insert_cleaned_data(posts: list):
    total = len(posts)
    failed = 0
    inserted = 0

    for post in posts:
        try:
            post_id = str(uuid.uuid4())

            post_data = {
                "postid": post_id,
                "title": post.get("title"),
                "source": post.get("source"),
                "upload_date": datetime.utcnow().isoformat(),
                "approveddate": datetime.utcnow().isoformat(),
                "likescount": 0,
            }

            supabase.table("posts").insert(post_data).execute()

            content_data = {
                "postid": post_id,
                "content": {
                    "summary": post.get("summary"),
                    "description": post.get("description"),
                },
                "isoldpost": False,
            }

            try:
                supabase.table("post_content").insert(content_data).execute()
            except Exception:
                # compensate to keep consistency if content insert fails
                supabase.table("posts").delete().eq("postid", post_id).execute()
                raise

            print(f"Inserted: {post['title']}")
            inserted += 1

        except Exception as e:
            failed += 1
            print(f"Error inserting '{post.get('title', '<unknown>')}': {e}")

    status = "completed_with_errors" if failed else "completed"
    return {
        "status": status,
        "total": total,
        "inserted": inserted,
        "failed": failed,
    }
