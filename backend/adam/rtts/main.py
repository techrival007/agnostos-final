import asyncio
import logging
from deepgram import AsyncDeepgramClient
from config import get_settings

logger = logging.getLogger("rtts")
settings = get_settings()

MAX_RETRIES = 3
RETRY_DELAY = 0.5


def _get_client() -> AsyncDeepgramClient:
    return AsyncDeepgramClient(api_key=settings.deepgram_api_key)


async def synthesize(text: str, model: str = "aura-2-thalia-en") -> bytes:
    """Convert text to speech using Deepgram's TTS API.
    Retries on transient DNS/network errors.
    """
    logger.info(f"[RTTS] synthesizing '{text[:80]}' ({len(text)} chars)")

    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            client = _get_client()
            chunks = []
            async for chunk in client.speak.v1.audio.generate(
                text=text,
                model=model,
            ):
                chunks.append(chunk)
            audio = b"".join(chunks)
            logger.info(f"[RTTS] result: {len(audio)} bytes")
            return audio
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (attempt + 1)
                logger.warning(f"[RTTS] attempt {attempt+1} failed ({e}), retrying in {delay}s")
                await asyncio.sleep(delay)

    logger.error(f"[RTTS] all {MAX_RETRIES} attempts failed: {last_err}")
    raise last_err
