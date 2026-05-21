"""SQLAlchemy session/engine.

Per assignment: SQLite is NOT allowed.  In production this points to an
Azure SQL Server. For local docker-compose we use Azure SQL Edge (the same
MSSQL engine, runs on ARM/x64).
"""
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.JOB_POSTING_DB_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session() -> Iterator[Session]:
    """For background tasks / startup scripts."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
