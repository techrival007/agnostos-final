import asyncio
import logging
from deepgram import AsyncDeepgramClient
from config import get_settings

logger = logging.getLogger("rstt")
settings = get_settings()

MAX_RETRIES = 3
RETRY_DELAY = 0.5


def _get_client() -> AsyncDeepgramClient:
    return AsyncDeepgramClient(api_key=settings.deepgram_api_key)


async def transcribe(audio_bytes: bytes, mimetype: str = "audio/webm") -> str:
    """Transcribe an audio blob using Deepgram's file API.
    Retries on transient DNS/network errors.
    """
    logger.info(f"[RSTT] transcribing {len(audio_bytes)} bytes (mimetype={mimetype})")

    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            client = _get_client()
            response = await client.listen.v1.media.transcribe_file(
                request=audio_bytes,
                model="nova-3",
                language="en",
                smart_format=True,
                punctuate=True,
            )
            transcript = response.results.channels[0].alternatives[0].transcript
            logger.info(f"[RSTT] result: '{transcript[:100]}' ({len(transcript)} chars)")
            return transcript
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (attempt + 1)
                logger.warning(f"[RSTT] attempt {attempt+1} failed ({e}), retrying in {delay}s")
                await asyncio.sleep(delay)

    logger.error(f"[RSTT] all {MAX_RETRIES} attempts failed: {last_err}")
    raise last_err
