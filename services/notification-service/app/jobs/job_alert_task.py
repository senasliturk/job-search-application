"""Scheduled task #1 – Job Alert notifier.

Per assignment:
    o to go over new job postings from a queue
    o go over all user job posting alerts
    o send to users if there are eligible postings.
"""
from __future__ import annotations

import datetime as dt
import logging

import httpx

from ..config import get_settings
from ..notifier import send
from ..queue_consumer import drain_new_jobs

log = logging.getLogger(__name__)
settings = get_settings()

# Track last run time so the direct-query fallback knows the window.
# Initialize 15 minutes back so first run catches recently posted jobs.
_last_checked_at: dt.datetime = dt.datetime.utcnow() - dt.timedelta(minutes=15)

# Normalize Turkish characters so "İzmir" == "Izmir", "Türkiye" == "Turkiye" etc.
_TR_MAP = str.maketrans("İıÇçŞşÜüÖöĞğ", "IiCcSsUuOoGg")


def _norm(s: str | None) -> str:
    if not s:
        return ""
    return s.strip().translate(_TR_MAP).lower()


def _fetch_alerts() -> list[dict]:
    """Fetch all active alerts from job-search-service (single source of truth)."""
    try:
        resp = httpx.get(
            f"{settings.JOB_SEARCH_SERVICE_URL}/api/v1/alerts/internal/all-active",
            headers={"x-internal-key": settings.INTERNAL_API_KEY},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:  # noqa: BLE001
        log.warning("[TASK] Failed to fetch alerts from job-search-service: %s", e)
        return []


def _fetch_recent_jobs(since: dt.datetime) -> list[dict]:
    """Fallback: query job-posting-service for jobs updated since `since`.

    Catches jobs whose queue message was already consumed (e.g. after a
    service restart) so the alert system works without re-publishing.
    """
    since_str = since.strftime("%Y-%m-%dT%H:%M:%S")
    try:
        resp = httpx.get(
            f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs",
            params={"page": 1, "page_size": 100},
            timeout=5,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        return [j for j in items if (j.get("last_updated") or "") >= since_str]
    except Exception as e:  # noqa: BLE001
        log.warning("[TASK] Recent-jobs fallback failed: %s", e)
        return []


def _matches(alert: dict, job: dict) -> bool:
    """Case-insensitive, Turkish-accent-aware matcher."""
    if alert.get("country") and _norm(alert["country"]) != _norm(job.get("country")):
        return False
    if alert.get("city") and _norm(alert["city"]) != _norm(job.get("city")):
        return False
    if alert.get("town") and _norm(alert["town"]) != _norm(job.get("town")):
        return False
    if alert.get("work_preference") and alert["work_preference"] != job.get("work_preference"):
        return False
    keywords = [_norm(k) for k in alert.get("keywords") or []]
    if keywords:
        title = _norm(job.get("title"))
        return any(k in title for k in keywords)
    return True


def run() -> dict:
    """Returns a small report (handy for the scheduled-task UI)."""
    global _last_checked_at
    now = dt.datetime.utcnow()

    # 1. Drain real-time queue messages
    queue_jobs = drain_new_jobs()

    # 2. Fallback: query job-posting-service directly for jobs since last run
    recent_jobs = _fetch_recent_jobs(_last_checked_at)

    # Merge and dedup by job id
    seen: set[str] = set()
    new_jobs: list[dict] = []
    for j in queue_jobs + recent_jobs:
        jid = str(j.get("id") or j.get("job_id") or "")
        if jid and jid not in seen:
            seen.add(jid)
            new_jobs.append(j)

    _last_checked_at = now

    if not new_jobs:
        return {"new_jobs": 0, "notifications_sent": 0}

    alerts = _fetch_alerts()
    sent = 0
    for alert in alerts:
        matches = [j for j in new_jobs if _matches(alert, j)]
        if not matches:
            continue
        body = "\n".join(f"- {j['title']} ({j.get('city','')})" for j in matches[:5])
        send(
            alert["user_id"],
            subject=f"{len(matches)} yeni ilan alarm'ınla eşleşti",
            body=body,
            user_email=alert.get("user_email", ""),
            jobs=matches[:5],
        )
        sent += 1
    return {"new_jobs": len(new_jobs), "alerts_evaluated": len(alerts), "notifications_sent": sent}

