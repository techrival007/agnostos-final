from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_db: str = "agnostos"
    database_url: str = "postgresql+asyncpg://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:6543/postgres"
    jwt_secret: str = "agnostos-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 72
    gemini_api_key: str = ""
    openai_api_key: str = ""
    deepgram_api_key: str = ""
    linkedin_email: str = ""
    linkedin_password: str = ""
    backend_cors_origins: list[str] = ["http://localhost:3000"]

    # Apollo — contact enrichment (email lookup)
    apollo_api_key: str = ""

    # Nylas — Gmail / Outlook OAuth + sending
    nylas_api_key: str = ""
    nylas_client_id: str = ""
    nylas_client_secret: str = ""
    nylas_webhook_secret: str = ""
    nylas_api_uri: str = "https://api.us.nylas.com"
    base_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
