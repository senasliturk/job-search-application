"""Job Posting Service entrypoint.

Mounted under /api/v1 (versioned per COMMON REQUIREMENTS).
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from .config import get_settings
from .database import Base, engine
from .routers import admin_jobs, companies, public_jobs, profile as profile_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(
    title="Job Posting Service",
    version="1.0.0",
    description="CRUD for job postings + companies. Distributed-cached reads, queue-published writes.",
    openapi_url=f"/api/{settings.API_VERSION}/openapi.json",
    docs_url=f"/api/{settings.API_VERSION}/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_jobs.router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(admin_jobs.router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(companies.router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(profile_router.router, prefix=f"/api/{settings.API_VERSION}")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": settings.SERVICE_NAME}


def _ensure_database_exists() -> None:
    """Make sure the target database exists.

    SQL Server only ships with `master` + `tempdb`. SQLAlchemy's
    create_all() can create tables INSIDE a DB but cannot create the DB
    itself, so we connect to `master` first and run CREATE DATABASE if
    needed. Safe to call repeatedly.
    """
    target_url = make_url(get_settings().JOB_POSTING_DB_URL)
    target_db = target_url.database
    if not target_db:
        return
    master_url = target_url.set(database="master")
    master_engine = create_engine(master_url, isolation_level="AUTOCOMMIT")
    try:
        with master_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM sys.databases WHERE name = :n"),
                {"n": target_db},
            ).first()
            if not exists:
                # DB names can't be parameterized in CREATE DATABASE — sanitize.
                safe = target_db.replace("]", "]]")
                conn.execute(text(f"CREATE DATABASE [{safe}]"))
                log.info("Created database %s", target_db)
    finally:
        master_engine.dispose()


@app.on_event("startup")
def on_startup() -> None:
    """Ensure DB + tables + seed exist, retrying until the engine is ready.

    Azure SQL Edge under Rosetta (Apple Silicon) can take up to 60s to be
    ready to accept connections. We retry every 2s for up to ~2 minutes.
    """
    import time

    max_attempts = 60  # 60 × 2s = 120s
    for attempt in range(1, max_attempts + 1):
        try:
            _ensure_database_exists()
            Base.metadata.create_all(bind=engine)
            _migrate_add_columns()
            from . import seed
            seed.run()
            log.info("DB ready and seeded on attempt %d", attempt)
            return
        except Exception as e:  # noqa: BLE001
            if attempt == max_attempts:
                log.error("DB still unreachable after %d attempts: %s", attempt, e)
                return
            if attempt == 1 or attempt % 5 == 0:
                log.warning("DB not ready yet (attempt %d/%d): %s", attempt, max_attempts, e)
            time.sleep(2)


def _migrate_add_columns() -> None:
    """Idempotent column-level migrations for job_applications.

    SQLAlchemy's create_all() only creates missing *tables*, not missing
    *columns* in existing tables. Run raw DDL here so new nullable columns
    added to the ORM model are applied without a full Alembic setup.
    """
    migrations = [
        (   # job_applications columns
            "job_applications.display_name",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'job_applications') AND name = N'display_name') "
            "ALTER TABLE job_applications ADD display_name NVARCHAR(200) NULL",
        ),
        (
            "job_applications.email",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'job_applications') AND name = N'email') "
            "ALTER TABLE job_applications ADD email NVARCHAR(254) NULL",
        ),
        (   # user_profiles columns (table may already exist without these cols)
            "user_profiles.education_status",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'user_profiles') AND name = N'education_status') "
            "ALTER TABLE user_profiles ADD education_status NVARCHAR(20) NULL",
        ),
        (
            "user_profiles.experience_level",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'user_profiles') AND name = N'experience_level') "
            "ALTER TABLE user_profiles ADD experience_level NVARCHAR(20) NULL",
        ),
        (
            "user_profiles.display_name",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'user_profiles') AND name = N'display_name') "
            "ALTER TABLE user_profiles ADD display_name NVARCHAR(200) NULL",
        ),
        (
            "user_profiles.email",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'user_profiles') AND name = N'email') "
            "ALTER TABLE user_profiles ADD email NVARCHAR(254) NULL",
        ),
        (
            "user_profiles.class_year",
            "IF NOT EXISTS (SELECT 1 FROM sys.columns "
            "WHERE object_id = OBJECT_ID(N'user_profiles') AND name = N'class_year') "
            "ALTER TABLE user_profiles ADD class_year NVARCHAR(20) NULL",
        ),
    ]
    with engine.begin() as conn:
        for col, sql in migrations:
            try:
                conn.execute(text(sql))
                log.info("Migration OK: job_applications.%s", col)
            except Exception as e:  # noqa: BLE001
                log.warning("Migration skipped for %s: %s", col, e)
