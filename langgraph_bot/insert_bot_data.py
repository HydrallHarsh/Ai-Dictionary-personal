"""Write one finished post to the flat `posts` table.

Rewritten for the Phase 1 schema. The old version took a **batch** and wrote two
tables (`posts` + `post_content` JSONB, now renamed `posts_old` / `post_content_old`);
this one takes a **single graph result** and writes one flat row.

Per-item (not batch) is deliberate: it pairs 1:1 with `update_status(raw_id,
'succeeded')` in the caller, so a crash mid-run leaves the DB consistent instead of
losing a whole batch of finished generations.
"""

import logging
import uuid

from backend.db.client import supabase

logger = logging.getLogger(__name__)

BUCKET = "post-images"


def _upload_image(image_data: bytes | None, post_id: str) -> tuple[str | None, str | None]:
    """Upload the generated image; return (public_url, storage_path).

    Returns (None, None) when there's no image or the upload fails — a missing
    thumbnail is not a reason to throw away a finished post.
    """
    if not image_data:
        return None, None

    path = f"{post_id}.jpg"
    try:
        supabase.storage.from_(BUCKET).upload(
            path, image_data, {"content_type": "image/jpeg"}
        )
        return supabase.storage.from_(BUCKET).get_public_url(path), path
    except Exception as e:
        logger.error("Image upload failed for %s: %s", post_id, e)
        return None, None


def insert_cleaned_data(state: dict) -> str:
    """Insert one generated post. Returns the new post id.

    Raises on failure (after rolling back an uploaded image) so the caller can mark
    the raw item 'failed' and move on.
    """
    slug = state.get("slug")
    title = state.get("title") or (state.get("title_block") or {}).get("content")

    # Both are required: `title` is NOT NULL and the `slug_required_for_new_posts`
    # CHECK rejects a NULL slug on any row created after 2026-06-18. Fail here with a
    # clear message rather than letting Postgres reject it with a constraint name.
    if not slug:
        raise ValueError("cannot insert post: slug is empty (slug_node produced nothing)")
    if not title:
        raise ValueError("cannot insert post: title is empty")

    post_id = str(uuid.uuid4())
    image_url, uploaded_path = _upload_image(state.get("generated_image"), post_id)

    row = {
        "id": post_id,
        "slug": slug,
        "title": title,
        "summary": state.get("summary"),
        "description": state.get("description"),
        "source_url": state.get("source_url"),
        "source_name": state.get("name"),
        "image_url": image_url,
        "tags": state.get("tags") or [],
        "difficulty": state.get("difficulty"),
        "read_time": state.get("read_time"),
        # Embedding from the dedup node — also powers "related posts" on the frontend.
        "embedding": state.get("embedding"),
        "raw_item_id": state.get("raw_id"),
        "likes_count": 0,
    }

    try:
        supabase.table("posts").insert(row).execute()
    except Exception:
        # Rollback: don't leave an orphaned image in the bucket. Only the one row and
        # the one image need undoing now that this is a single flat insert.
        if uploaded_path:
            try:
                supabase.storage.from_(BUCKET).remove([uploaded_path])
            except Exception as cleanup_error:
                logger.error("Image rollback failed for %s: %s", post_id, cleanup_error)
        raise

    logger.info("Inserted post %s (%s)", slug, post_id)
    return post_id
