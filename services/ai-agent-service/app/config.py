from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "ai-agent-service"
    API_VERSION: str = "v1"

    JOB_POSTING_SERVICE_URL: str = "http://job-posting-service:8001"
    JOB_SEARCH_SERVICE_URL: str = "http://job-search-service:8002"

    LLM_PROVIDER: str = "openai"  # openai | azure | anthropic-compatible
    LLM_API_KEY: str = ""  # set via LLM_API_KEY env var or .env file
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: str = "https://api.openai.com/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
