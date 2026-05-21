from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "notification-service"
    API_VERSION: str = "v1"

    # Cosmos DB (alerts + searches – read-only here, writes happen in Job Search service)
    # notifications container is write-only from this service
    COSMOS_ENDPOINT: str = ""
    COSMOS_KEY: str = ""
    COSMOS_DATABASE: str = "jobsearch"
    COSMOS_CONTAINER_SEARCHES: str = "user_searches"
    COSMOS_CONTAINER_ALERTS: str = "user_alerts"
    COSMOS_CONTAINER_NOTIFICATIONS: str = "notifications"

    # Queue
    SERVICE_BUS_CONNECTION_STRING: str = ""
    SERVICE_BUS_QUEUE_NEW_JOBS: str = "new-job-postings"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    # Downstream services
    JOB_POSTING_SERVICE_URL: str = "http://job-posting-service:8001"

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
