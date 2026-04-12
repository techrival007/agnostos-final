from fastapi import APIRouter, Depends

from auth.service import get_current_user
from config import get_settings
from settings.schemas import GeminiKeyUpdateRequest, ProviderSettingsResponse, ProviderStatus
from settings.service import update_env_value
from shared.gemini import set_gemini_api_key
from shared.models import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/providers", response_model=ProviderSettingsResponse)
async def get_provider_settings(user: User = Depends(get_current_user)):
    settings = get_settings()
    providers = [
        ProviderStatus(
            id="gemini",
            label="Gemini",
            configured=bool(settings.gemini_api_key.strip()),
            editable=True,
        ),
        ProviderStatus(id="anthropic", label="Anthropic", configured=False),
        ProviderStatus(id="grok", label="Grok", configured=False),
        ProviderStatus(id="openai", label="OpenAI", configured=False),
    ]
    return ProviderSettingsResponse(providers=providers)


@router.put("/providers/gemini", response_model=ProviderSettingsResponse)
async def update_gemini_provider(
    req: GeminiKeyUpdateRequest,
    user: User = Depends(get_current_user),
):
    key = req.gemini_api_key.strip()
    update_env_value("GEMINI_API_KEY", key)

    settings = get_settings()
    settings.gemini_api_key = key
    set_gemini_api_key(key)

    providers = [
        ProviderStatus(id="gemini", label="Gemini", configured=bool(key), editable=True),
        ProviderStatus(id="anthropic", label="Anthropic", configured=False),
        ProviderStatus(id="grok", label="Grok", configured=False),
        ProviderStatus(id="openai", label="OpenAI", configured=False),
    ]
    return ProviderSettingsResponse(providers=providers)
