from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    auth_secret: SecretStr | None = None
    jwt_issuer: str = "outreach-local"
    jwt_audience: str = "outreach-api"
    google_client_id: str = ""
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str = "http://localhost:3000/api/mailboxes/google/callback"
    token_encryption_key: SecretStr | None = None

    database_url: SecretStr
    allowed_origins: list[str] = ["http://localhost:3000"]
    campaign_dry_run: bool = True
    require_lead_approval: bool = True
    auto_send_conversational_replies: bool = False
    max_emails_per_day: int = 10

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value: SecretStr) -> SecretStr:
        if make_url(value.get_secret_value()).drivername != "postgresql+psycopg":
            raise ValueError("DATABASE_URL must use postgresql+psycopg")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
