"""
Gemini helper — uses google-genai (v1+ SDK).
Falls back to mock responses when GEMINI_API_KEY is not set.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from config import get_settings

log = logging.getLogger("shared.gemini")
settings = get_settings()

# ---------------------------------------------------------------------------
# SDK import (graceful — server starts even without the package)
# ---------------------------------------------------------------------------
_GENAI_AVAILABLE = False
_client: Any = None

try:
    from google import genai as _genai
    from google.genai import types as _types
    _GENAI_AVAILABLE = True
except ImportError:
    log.warning("google-genai not installed — Gemini calls will use mock responses")


def _get_client():
    global _client
    if not _GENAI_AVAILABLE:
        return None
    if not settings.gemini_api_key:
        return None
    if _client is None:
        _client = _genai.Client(api_key=settings.gemini_api_key)
    return _client


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def chat_with_gemini(
    system_prompt: str,
    messages: list[dict],
    model_name: str = "gemini-2.5-flash",
) -> str:
    client = _get_client()
    if not client:
        return get_mock_adam_response(len(messages))

    history: list[Any] = []
    for msg in messages[:-1]:
        role = "user" if msg["role"] == "user" else "model"
        history.append(
            _types.Content(role=role, parts=[_types.Part(text=msg["content"])])
        )

    last_msg = messages[-1]["content"] if messages else ""
    first_turn = f"{system_prompt}\n\n{last_msg}" if not history else last_msg

    response = await client.aio.models.generate_content(
        model=model_name,
        contents=history + [_types.Content(role="user", parts=[_types.Part(text=first_turn)])],
    )
    return response.text


async def generate_structured(prompt: str, use_pro: bool = False) -> dict:
    client = _get_client()
    if not client:
        raise RuntimeError("Gemini not configured")

    model = "gemini-2.5-flash"
    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
    )
    text = response.text.strip()
    # Strip markdown fences if present
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())


async def analyze_with_pro(prompt: str) -> str:
    client = _get_client()
    if not client:
        return ""
    response = await client.aio.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
    )
    return response.text


async def generate_embedding(text: str) -> list[float]:
    client = _get_client()
    if not client:
        return []
    response = await client.aio.models.embed_content(
        model="models/text-embedding-004",
        contents=text,
    )
    return response.embeddings[0].values


# ---------------------------------------------------------------------------
# Mock responses (Adam interview fallback)
# ---------------------------------------------------------------------------

MOCK_ADAM_RESPONSES = [
    "Before I dive in -- what made you want to do this today? What are you actually hoping to find?",
    "Walk me through the thing you've built that you're most proud of. Not the most impressive on paper -- the one that meant the most to you.",
    "What kind of work makes you completely lose track of time?",
    "Say more about that. What specifically about it pulled you in?",
    "If you could design your ideal day at work, what would you actually be doing?",
    "What's something you're genuinely good at that doesn't show up on your CV?",
    "Tell me about a time you solved a problem that nobody asked you to solve.",
    "What kind of team brings out the best in you?",
    "Where do you want to be in 2 years -- and what's the real reason?",
    "What's the one thing you'd want a hiring manager to know about you that they'd never guess from your resume?",
]


def get_mock_adam_response(turn: int) -> str:
    return MOCK_ADAM_RESPONSES[turn % len(MOCK_ADAM_RESPONSES)]
