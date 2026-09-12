from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'data' / 'idp.db').as_posix()}"
    upload_dir: str = str(BACKEND_ROOT / "data" / "uploads")
    confidence_threshold: float = 0.7


settings = Settings()
