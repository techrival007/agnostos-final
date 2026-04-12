from fastapi import APIRouter, Depends

from auth.service import get_current_user
from config import get_settings
from settings.schemas import GeminiKeyUpdateRequest, ApolloKeyUpdateRequest, ProviderSettingsResponse, ProviderStatus
from settings.service import update_env_value
from shared.gemini import set_gemini_api_key
from shared.models import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _build_provider_list() -> list[ProviderStatus]:
    settings = get_settings()
    return [
        ProviderStatus(
            id="gemini",
            label="Gemini",
            configured=bool(settings.gemini_api_key.strip()),
            editable=True,
        ),
        ProviderStatus(
            id="apollo",
            label="Apollo.io",
            configured=bool(settings.apollo_api_key.strip()),
            editable=True,
        ),
        ProviderStatus(id="anthropic", label="Anthropic", configured=False),
        ProviderStatus(id="grok", label="Grok", configured=False),
        ProviderStatus(id="openai", label="OpenAI", configured=False),
    ]


@router.get("/providers", response_model=ProviderSettingsResponse)
async def get_provider_settings(user: User = Depends(get_current_user)):
    return ProviderSettingsResponse(providers=_build_provider_list())


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

    return ProviderSettingsResponse(providers=_build_provider_list())


@router.put("/providers/apollo", response_model=ProviderSettingsResponse)
async def update_apollo_provider(
    req: ApolloKeyUpdateRequest,
    user: User = Depends(get_current_user),
):
    key = req.apollo_api_key.strip()
    update_env_value("APOLLO_API_KEY", key)

    settings = get_settings()
    settings.apollo_api_key = key

    return ProviderSettingsResponse(providers=_build_provider_list())
