from pydantic import BaseModel, Field


class ProviderStatus(BaseModel):
    id: str
    label: str
    configured: bool
    editable: bool = False


class ProviderSettingsResponse(BaseModel):
    providers: list[ProviderStatus]


class GeminiKeyUpdateRequest(BaseModel):
    gemini_api_key: str = Field(default="")


class ApolloKeyUpdateRequest(BaseModel):
    apollo_api_key: str = Field(default="")
