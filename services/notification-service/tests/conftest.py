"""Set env vars before any app module is imported."""
import os

os.environ.setdefault("INTERNAL_API_KEY", "test-key")
os.environ.setdefault("JOB_POSTING_SERVICE_URL", "http://localhost:8001")
os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
os.environ.setdefault("SMTP_HOST", "")
os.environ.setdefault("COSMOS_ENDPOINT", "")
