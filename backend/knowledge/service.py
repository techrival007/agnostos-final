import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text
from knowledge.models import KnowledgeEntry
from shared.gemini import generate_embedding
from config import get_settings

settings = get_settings()


async def add_knowledge_entry(
    db: AsyncSession,
    user_id: uuid.UUID,
    content: str,
    source: str,
    category: str | None = None,
    title: str | None = None,
    metadata: dict | None = None,
) -> KnowledgeEntry:
    embedding = None
    if settings.gemini_api_key:
        try:
            embedding = await generate_embedding(content[:2000])
        except Exception:
            pass

    entry = KnowledgeEntry(
        user_id=user_id,
        source=source,
        category=category,
        title=title,
        content=content,
        metadata_=metadata,
        embedding=embedding,
    )
    db.add(entry)
    return entry


async def bulk_ingest_knowledge(
    db: AsyncSession,
    user_id: uuid.UUID,
    entries: list[dict],
    source: str,
) -> list[KnowledgeEntry]:
    results = []
    for entry_data in entries:
        entry = await add_knowledge_entry(
            db=db,
            user_id=user_id,
            content=entry_data["content"],
            source=source,
            category=entry_data.get("category"),
            title=entry_data.get("title"),
            metadata=entry_data.get("metadata"),
        )
        results.append(entry)
    return results


async def semantic_search(
    db: AsyncSession,
    user_id: uuid.UUID,
    query: str,
    limit: int = 5,
) -> list[dict]:
    if not settings.gemini_api_key:
        return []

    try:
        query_embedding = await generate_embedding(query)
    except Exception:
        return []

    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    sql = text("""
        SELECT id, source, category, title, content,
               1 - (embedding <=> :embedding::vector) as score
        FROM knowledge_entries
        WHERE user_id = :user_id AND embedding IS NOT NULL
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """)

    result = await db.execute(sql, {
        "embedding": embedding_str,
        "user_id": str(user_id),
        "limit": limit,
    })

    rows = result.fetchall()
    return [
        {
            "id": str(row.id),
            "source": row.source,
            "category": row.category,
            "title": row.title,
            "content": row.content,
            "score": float(row.score) if row.score else 0.0,
        }
        for row in rows
    ]


async def clear_user_knowledge(
    db: AsyncSession,
    user_id: uuid.UUID,
    source: str | None = None,
):
    stmt = delete(KnowledgeEntry).where(KnowledgeEntry.user_id == user_id)
    if source:
        stmt = stmt.where(KnowledgeEntry.source == source)
    await db.execute(stmt)
