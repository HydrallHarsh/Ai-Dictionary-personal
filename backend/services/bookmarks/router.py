"""
Saved posts ("bookmarks") for the signed-in user.

Posts live in Supabase and users live in this service's database, so this
router only records which post ids a user saved. Returning ids rather than post
rows keeps the ownership check here — where the session cookie is verified —
while the article data is still read from Supabase by the frontend.

Every route takes its `user` from `current_active_user`, so nothing here can
read or write another user's bookmarks, and none of it trusts a user id sent by
the client.
"""

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from services.authentication.dbs import SavedPost, User, get_async_session
from services.authentication.users import current_active_user
from services.bookmarks.schema import BookmarkRead

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("", response_model=list[BookmarkRead])
async def list_bookmarks(
    user: User = Depends(current_active_user),  # noqa: B008
    session: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Newest first — the order a saved list is read in."""
    result = await session.execute(
        select(SavedPost)
        .where(SavedPost.user_id == user.id)
        .order_by(SavedPost.created_at.desc(), SavedPost.post_id)
    )
    return result.scalars().all()


@router.put("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def save_bookmark(
    post_id: uuid.UUID,
    user: User = Depends(current_active_user),  # noqa: B008
    session: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """
    Save a post. Idempotent: the composite primary key means a repeat save is a
    no-op rather than a 409, which is what a toggle button wants.
    """
    await session.execute(
        insert(SavedPost)
        .values(user_id=user.id, post_id=post_id)
        .on_conflict_do_nothing()
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    post_id: uuid.UUID,
    user: User = Depends(current_active_user),  # noqa: B008
    session: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Unsaving something that is not saved succeeds — the end state is the same."""
    await session.execute(
        delete(SavedPost).where(
            SavedPost.user_id == user.id, SavedPost.post_id == post_id
        )
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
