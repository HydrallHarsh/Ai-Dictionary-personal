import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime

from dotenv import load_dotenv
from fastapi import Depends
from fastapi_users_db_sqlalchemy import (
    SQLAlchemyBaseUserTableUUID,
    SQLAlchemyUserDatabase,
)
from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

load_dotenv()

DB_PASSWORD = os.environ.get("DB_PASSWORD")
DATABASE_URL = f"postgresql+asyncpg://postgres:{DB_PASSWORD}@localhost:5432/postgres"


class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    pass


class SavedPost(Base):
    """
    A user's bookmark, stored in the same database as the users.

    The post itself lives in Supabase (a different database), so `post_id` is a
    bare UUID with no foreign key: a cross-database constraint is not possible,
    and enforcing existence would need the backend to hold a Supabase service
    key just to validate an id. The frontend already reads posts from Supabase
    with the publishable key, so a stale id simply drops out of the saved list
    when the rows are matched.

    The composite primary key does the important work: saving the same post
    twice is a no-op instead of a duplicate row, without a lookup first.
    """

    __tablename__ = "saved_posts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        primary_key=True,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):  # noqa: B008
    yield SQLAlchemyUserDatabase(session, User)
