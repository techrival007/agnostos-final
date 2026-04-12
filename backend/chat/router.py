from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from shared.models import User
from chat.models import ChatSession, ChatMessage
from chat.schemas import (
    ChatSessionOut, ChatSessionCreate,
    ChatMessageOut, ChatMessageCreate, ChatReply,
)
from chat.service import get_adam_reply
from auth.service import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()

    out = []
    for s in sessions:
        last_msg_result = await db.execute(
            select(ChatMessage.content)
            .where(ChatMessage.session_id == s.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        out.append(ChatSessionOut(
            id=str(s.id), title=s.title,
            created_at=s.created_at, updated_at=s.updated_at,
            last_message=last_msg,
        ))
    return out


@router.post("/sessions", response_model=ChatSessionOut)
async def create_session(
    req: ChatSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(user_id=user.id, title=req.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionOut(
        id=str(session.id), title=session.title,
        created_at=session.created_at, updated_at=session.updated_at,
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
    await db.commit()
    return {"status": "deleted"}


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_messages(
    session_id: str,
    limit: int = Query(default=50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .limit(limit)
    )
    messages = result.scalars().all()
    return [
        ChatMessageOut(
            id=str(m.id), role=m.role,
            content=m.content, created_at=m.created_at,
        ) for m in messages
    ]


@router.post("/sessions/{session_id}/messages", response_model=ChatReply)
async def send_message(
    session_id: str,
    req: ChatMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    user_msg = ChatMessage(session_id=session_id, role="user", content=req.message)
    db.add(user_msg)
    await db.flush()

    reply_text = await get_adam_reply(db, user.id, session_id, req.message)

    adam_msg = ChatMessage(session_id=session_id, role="adam", content=reply_text)
    db.add(adam_msg)

    from sqlalchemy import update
    await db.execute(
        update(ChatSession).where(ChatSession.id == session_id).values(
            updated_at=user_msg.created_at
        )
    )

    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(adam_msg)

    return ChatReply(
        user_message=ChatMessageOut(
            id=str(user_msg.id), role=user_msg.role,
            content=user_msg.content, created_at=user_msg.created_at,
        ),
        adam_reply=ChatMessageOut(
            id=str(adam_msg.id), role=adam_msg.role,
            content=adam_msg.content, created_at=adam_msg.created_at,
        ),
    )
