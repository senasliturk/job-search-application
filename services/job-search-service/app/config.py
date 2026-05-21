from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "job-search-service"
    API_VERSION: str = "v1"

    # Cosmos DB (NoSQL store for user searches & alerts)
    COSMOS_ENDPOINT: str = ""
    COSMOS_KEY: str = ""
    COSMOS_DATABASE: str = "jobsearch"
    COSMOS_CONTAINER_SEARCHES: str = "user_searches"
    COSMOS_CONTAINER_ALERTS: str = "user_alerts"
    COSMOS_CONTAINER_NOTIFICATIONS: str = "notifications"

    # Where to fetch real postings from
    JOB_POSTING_SERVICE_URL: str = "http://job-posting-service:8001"

    # Auth
    FIREBASE_PROJECT_ID: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    # Internal service-to-service key (notification-service → job-search-service)
    INTERNAL_API_KEY: str = "change-me"


@lru_cache
def get_settings() -> Settings:
    return Settings()
