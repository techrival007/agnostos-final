from pydantic import BaseModel
from datetime import datetime


class ChatSessionOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    last_message: str | None = None

    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    title: str = "New Chat"


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageCreate(BaseModel):
    message: str


class ChatReply(BaseModel):
    user_message: ChatMessageOut
    adam_reply: ChatMessageOut
