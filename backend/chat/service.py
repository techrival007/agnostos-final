import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chat.models import ChatSession, ChatMessage
from knowledge.service import semantic_search
from shared.gemini import chat_with_gemini
from config import get_settings

settings = get_settings()

ADAM_CHAT_PROMPT = """
You are Adam, a warm and deeply curious AI assistant. You have access to
the user's knowledge base which contains their professional background,
skills, experiences, and goals.

Use the knowledge base context to give personalized, relevant responses.
You help with career questions, job search strategy, interview prep,
and general professional development.

Rules:
- Be concise but thoughtful
- Reference specific things from their background when relevant
- Don't repeat information they already know about themselves
- Be genuinely helpful, not performative
- Talk like a smart human friend, not a corporate bot
"""


async def get_adam_reply(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    user_message: str,
) -> str:
    kb_results = await semantic_search(db, user_id, user_message, limit=5)
    kb_context = ""
    if kb_results:
        kb_context = "\n\nRelevant knowledge about this user:\n"
        for r in kb_results:
            kb_context += f"- [{r['category'] or r['source']}] {r['title'] or ''}: {r['content'][:200]}\n"

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    history_rows = list(reversed(result.scalars().all()))

    messages = []
    for msg in history_rows:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    system = ADAM_CHAT_PROMPT + kb_context

    if settings.gemini_api_key:
        reply = await chat_with_gemini(
            system_prompt=system,
            messages=messages,
            model_name="gemini-2.5-flash",
        )
    else:
        reply = "I'm here to help you with your career journey. What would you like to discuss?"

    return reply
