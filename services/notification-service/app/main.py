"""Notification Service.

Two scheduled tasks (per assignment):
1) /internal/run-job-alert       – consume new job queue, match alerts.
2) /internal/run-related-jobs    – read recent user searches, send suggestions.

These are HTTP endpoints so any cloud scheduler (Azure Logic Apps, Google
Cloud Scheduler, GitHub Actions cron) can invoke them with a simple curl.
A static API key gates them so they are not publicly invocable.

In local dev the tasks also run automatically via a background asyncio loop
(every 2 minutes) so there's no need to set up an external scheduler.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException

from .config import get_settings
from .jobs import job_alert_task, related_job_task

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
settings = get_settings()

_POLL_INTERVAL = 120  # seconds between automatic runs


async def _background_loop() -> None:
    """Runs both scheduled tasks periodically so local dev works without a cron."""
    # Initial short delay so the service is fully up before first run
    await asyncio.sleep(10)
    while True:
        try:
            result = job_alert_task.run()
            log.info("[AUTO-TASK] job-alert: %s", result)
        except Exception as e:  # noqa: BLE001
            log.warning("[AUTO-TASK] job-alert failed: %s", e)
        try:
            result = related_job_task.run()
            log.info("[AUTO-TASK] related-jobs: %s", result)
        except Exception as e:  # noqa: BLE001
            log.warning("[AUTO-TASK] related-jobs failed: %s", e)
        await asyncio.sleep(_POLL_INTERVAL)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_background_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Notification Service",
    version="1.0.0",
    openapi_url=f"/api/{settings.API_VERSION}/openapi.json",
    docs_url=f"/api/{settings.API_VERSION}/docs",
    lifespan=lifespan,
)


def _require_api_key(x_internal_key: str | None) -> None:
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(401, "internal-api-key required")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": settings.SERVICE_NAME}


@app.post("/internal/run-job-alert")
def run_job_alert(x_internal_key: str | None = Header(default=None)):
    _require_api_key(x_internal_key)
    return job_alert_task.run()


@app.post("/internal/run-related-jobs")
def run_related_jobs(x_internal_key: str | None = Header(default=None)):
    _require_api_key(x_internal_key)
    return related_job_task.run()
