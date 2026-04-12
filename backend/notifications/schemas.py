from pydantic import BaseModel
from datetime import datetime


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    message: str | None = None
    metadata_json: dict | None = None
    is_read: bool = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    count: int
