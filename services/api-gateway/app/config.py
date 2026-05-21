from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "api-gateway"

    JOB_POSTING_SERVICE_URL: str = "http://job-posting-service:8001"
    JOB_SEARCH_SERVICE_URL: str = "http://job-search-service:8002"
    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8003"
    AI_AGENT_SERVICE_URL: str = "http://ai-agent-service:8004"

    FIREBASE_PROJECT_ID: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    ALLOWED_ORIGINS: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
