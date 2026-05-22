"""Pytest configuration for job-posting-service tests.

Environment variables MUST be set before any app module is imported so that
SQLAlchemy picks up the SQLite URL instead of PostgreSQL, and so that the
Redis / Firebase / RabbitMQ clients fail gracefully.
"""
import os

# --- env overrides (must come before any 'from app...' import) ---
os.environ["JOB_POSTING_DB_URL"] = "sqlite:///./pytest_jobs.db"
os.environ.setdefault("REDIS_URL", "redis://nonexistent:6379/0")
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", "")
os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")
os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@nonexistent:5672/")
# profile.py creates UPLOAD_DIR at import time; point it to a writable tmp path
import tempfile
os.environ.setdefault("CV_UPLOAD_DIR", tempfile.mkdtemp(prefix="pytest_cv_"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.database import Base, engine, get_db
from app.main import app
import app.cache as _cache

# Reuse the same SQLite engine that database.py built (URL was set above)
_TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="session", autouse=True)
def _tables():
    """Create all tables once per test session; drop + remove file at the end."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    try:
        os.remove("pytest_jobs.db")
    except FileNotFoundError:
        pass


@pytest.fixture
def db(_tables):
    """Per-test DB session; rolls back on failure to keep tests isolated."""
    session = _TestSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@pytest.fixture
def client(db):
    """TestClient with get_db overridden to use the SQLite test session."""

    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    _cache._client = None  # disable Redis so tests never need a real cache

    # Context-manager form triggers @app.on_event("startup") which seeds the DB.
    # seed.run() is idempotent so repeated calls are safe.
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c

    app.dependency_overrides.clear()
