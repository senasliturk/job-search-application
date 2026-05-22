from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "notification-service"
    API_VERSION: str = "v1"

    # Firebase / Firestore
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""

    # Queue
    SERVICE_BUS_CONNECTION_STRING: str = ""
    SERVICE_BUS_QUEUE_NEW_JOBS: str = "new-job-postings"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    # Downstream services
    JOB_POSTING_SERVICE_URL: str = "http://job-posting-service:8001"
    JOB_SEARCH_SERVICE_URL: str = "http://job-search-service:8002"

    # Internal HTTP key – used by the cloud scheduler to call /internal/run-* endpoints.
    INTERNAL_API_KEY: str = "change-me"

    # SMTP email – leave SMTP_HOST empty to skip actual email delivery (log-only mode)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
