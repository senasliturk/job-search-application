"""Job Posting Service entrypoint.

Mounted under /api/v1 (versioned per COMMON REQUIREMENTS).
"""
from __future__ import annotations

import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.on_event("startup")
def on_startup() -> None:
    """Create tables and seed demo data, retrying until the DB is ready."""
    max_attempts = 30
    for attempt in range(1, max_attempts + 1):
        try:
            Base.metadata.create_all(bind=engine)
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
