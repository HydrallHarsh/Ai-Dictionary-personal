"""Write one finished post to the flat ``posts`` table.

Per-item insertion pairs with the caller's terminal status transition. Image
cleanup is conservative because an insert exception can arrive after the database
has committed the row.
"""

import logging
import uuid

from backend.db.client import supabase

logger = logging.getLogger(__name__)

BUCKET = "post-images"


def find_published_post(raw_item_id: str) -> str | None:
    """Reconcile a prior publication before running provider gates again."""
    response = supabase.table("posts").select("id").eq("raw_item_id", raw_item_id).limit(1).execute()
    return response.data[0]["id"] if response.data else None


def _upload_image(
    image_data: bytes | None, post_id: str
) -> tuple[str | None, str | None]:
    """Upload an image and return its public URL and storage path.

    A missing thumbnail is not a reason to discard an otherwise finished post.
    """
    if not image_data:
        return None, None

    path = f"{post_id}.jpg"
    try:
        # storage3 merges these options straight into the request headers and pops
        # "content-type" out for the multipart part. The underscore spelling misses,
        # so the JPEG uploads as the DEFAULT_FILE_OPTIONS text/plain.
        supabase.storage.from_(BUCKET).upload(
            path, image_data, {"content-type": "image/jpeg"}
        )
        return supabase.storage.from_(BUCKET).get_public_url(path), path
    except Exception as error:
        logger.error("Image upload failed for %s: %s", post_id, error)
        return None, None


def _post_exists(post_id: str) -> bool:
    response = supabase.table("posts").select("id").eq("id", post_id).limit(1).execute()
    return bool(response.data)


def _discard_image(uploaded_path: str | None) -> None:
    """Drop an image this call uploaded but is not going to use."""
    if not uploaded_path:
        return
    try:
        supabase.storage.from_(BUCKET).remove([uploaded_path])
    except Exception as cleanup_error:
        logger.error("Image rollback failed for %s: %s", uploaded_path, cleanup_error)


def _existing_post_id(post_id: str, raw_item_id: str | None) -> str | None:
    """Return the id of the post covering this raw item, ours or an earlier run's.

    Querying by raw_item_id answers both "did my insert land" and "did an earlier
    attempt already publish this item" in one read. `_post_exists` alone cannot
    answer the second: post_id is freshly generated on every call, so a replay
    always looks like a row that is simply absent.
    """
    if raw_item_id:
        response = (
            supabase.table("posts")
            .select("id")
            .eq("raw_item_id", raw_item_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0]["id"] if rows else None
    return post_id if _post_exists(post_id) else None


def insert_cleaned_data(state: dict) -> str:
    """Insert one generated post and return its ID.

    If the insert response fails after a possible commit, verify the row before
    cleaning up its image. An unverifiable image is retained for reconciliation.
    """
    slug = state.get("slug")
    title = state.get("title") or (state.get("title_block") or {}).get("content")
    description = state.get("description")

    if not slug:
        raise ValueError(
            "cannot insert post: slug is empty (slug_node produced nothing)"
        )
    if not title:
        raise ValueError("cannot insert post: title is empty")
    if not isinstance(description, str) or not description.strip():
        raise ValueError("cannot insert post: description is empty")

    post_id = str(uuid.uuid4())
    image_url, uploaded_path = _upload_image(state.get("generated_image"), post_id)

    row = {
        "id": post_id,
        "slug": slug,
        "title": title,
        "summary": state.get("summary"),
        "description": description,
        "source_url": state.get("source_url"),
        "source_name": state.get("name"),
        "image_url": image_url,
        "tags": state.get("tags") or [],
        "difficulty": state.get("difficulty"),
        "read_time": state.get("read_time"),
        # The dedup embedding also powers related-post lookup.
        "embedding": state.get("embedding"),
        "raw_item_id": state.get("raw_id"),
        "likes_count": 0,
    }

    try:
        supabase.table("posts").insert(row).execute()
    except Exception as insert_error:
        try:
            existing_id = _existing_post_id(post_id, row["raw_item_id"])
        except Exception as verification_error:
            logger.error(
                "Post insert failed for %s and its outcome could not be verified; "
                "retaining image %s for reconciliation",
                post_id,
                uploaded_path,
            )
            raise insert_error from verification_error

        if existing_id == post_id:
            logger.warning(
                "Post insert response failed for %s, but the row exists; treating it as committed",
                post_id,
            )
            return post_id

        if existing_id is not None:
            # An earlier attempt already published this raw item, so the unique index
            # on posts.raw_item_id rejected this one. Report the post that exists:
            # the caller's job is to record an outcome for the raw item, and the
            # outcome is that it has a post. Our own image is now unreferenced.
            logger.warning(
                "Raw item %s already has post %s; treating this insert as a replay of it",
                row["raw_item_id"],
                existing_id,
            )
            _discard_image(uploaded_path)
            return existing_id

        _discard_image(uploaded_path)
        raise

    logger.info("Inserted post %s (%s)", slug, post_id)
    return post_id
