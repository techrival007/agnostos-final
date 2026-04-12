from pydantic import BaseModel
from datetime import datetime


class KnowledgeEntryOut(BaseModel):
    id: str
    source: str
    category: str | None = None
    title: str | None = None
    content: str
    metadata: dict | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeEntryCreate(BaseModel):
    source: str = "manual"
    category: str | None = None
    title: str | None = None
    content: str
    metadata: dict | None = None


class KnowledgeEntryUpdate(BaseModel):
    category: str | None = None
    title: str | None = None
    content: str | None = None
    metadata: dict | None = None


class KnowledgeSearchResult(BaseModel):
    id: str
    source: str
    category: str | None = None
    title: str | None = None
    content: str
    score: float
