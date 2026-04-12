from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from database import get_db
from shared.models import User
from knowledge.models import KnowledgeEntry
from knowledge.schemas import (
    KnowledgeEntryOut, KnowledgeEntryCreate,
    KnowledgeEntryUpdate, KnowledgeSearchResult,
)
from knowledge.service import add_knowledge_entry, semantic_search
from auth.service import get_current_user

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/search", response_model=list[KnowledgeSearchResult])
async def search_knowledge(
    q: str,
    limit: int = Query(default=5, le=20),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = await semantic_search(db, user.id, q, limit)
    return [KnowledgeSearchResult(**r) for r in results]


@router.get("/entries", response_model=list[KnowledgeEntryOut])
async def list_entries(
    source: str | None = None,
    category: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(KnowledgeEntry).where(KnowledgeEntry.user_id == user.id)
    if source:
        query = query.where(KnowledgeEntry.source == source)
    if category:
        query = query.where(KnowledgeEntry.category == category)
    query = query.order_by(KnowledgeEntry.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    entries = result.scalars().all()
    return [
        KnowledgeEntryOut(
            id=str(e.id), source=e.source, category=e.category,
            title=e.title, content=e.content, metadata=e.metadata_,
            created_at=e.created_at, updated_at=e.updated_at,
        ) for e in entries
    ]


@router.post("/entries", response_model=KnowledgeEntryOut)
async def create_entry(
    req: KnowledgeEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await add_knowledge_entry(
        db=db, user_id=user.id, content=req.content,
        source=req.source, category=req.category,
        title=req.title, metadata=req.metadata,
    )
    await db.commit()
    await db.refresh(entry)
    return KnowledgeEntryOut(
        id=str(entry.id), source=entry.source, category=entry.category,
        title=entry.title, content=entry.content, metadata=entry.metadata_,
        created_at=entry.created_at, updated_at=entry.updated_at,
    )


@router.patch("/entries/{entry_id}", response_model=KnowledgeEntryOut)
async def update_entry(
    entry_id: str,
    req: KnowledgeEntryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeEntry).where(
            KnowledgeEntry.id == entry_id,
            KnowledgeEntry.user_id == user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    values = {k: v for k, v in req.model_dump().items() if v is not None}
    if not values:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "content" in values:
        from shared.gemini import generate_embedding
        from config import get_settings
        s = get_settings()
        if s.gemini_api_key:
            try:
                values["embedding"] = await generate_embedding(values["content"][:2000])
            except Exception:
                pass

    await db.execute(
        update(KnowledgeEntry)
        .where(KnowledgeEntry.id == entry_id)
        .values(**values)
    )
    await db.commit()

    result = await db.execute(select(KnowledgeEntry).where(KnowledgeEntry.id == entry_id))
    entry = result.scalar_one()
    return KnowledgeEntryOut(
        id=str(entry.id), source=entry.source, category=entry.category,
        title=entry.title, content=entry.content, metadata=entry.metadata_,
        created_at=entry.created_at, updated_at=entry.updated_at,
    )


@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeEntry).where(
            KnowledgeEntry.id == entry_id,
            KnowledgeEntry.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.execute(delete(KnowledgeEntry).where(KnowledgeEntry.id == entry_id))
    await db.commit()
    return {"status": "deleted"}
