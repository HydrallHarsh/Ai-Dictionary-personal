import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BookmarkRead(BaseModel):
    """One saved post, as the frontend needs it to match Supabase rows."""

    model_config = ConfigDict(from_attributes=True)

    post_id: uuid.UUID
    created_at: datetime
