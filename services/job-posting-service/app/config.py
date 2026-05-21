"""Centralized settings, loaded from environment.

We use pydantic-settings so the same code works locally (with .env), in
docker-compose (env_file), and in Azure App Service (App Settings).
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    JOB_POSTING_DB_URL: str = (
        "mssql+pyodbc://sa:Your_password123@localhost:1433/jobpostings"
        "?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
    )

    # Cache
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TTL_SECONDS: int = 300

    # Queue
    SERVICE_BUS_CONNECTION_STRING: str = ""
    SERVICE_BUS_QUEUE_NEW_JOBS: str = "new-job-postings"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    # Auth
    FIREBASE_PROJECT_ID: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    # Misc
    SERVICE_NAME: str = "job-posting-service"
    API_VERSION: str = "v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
