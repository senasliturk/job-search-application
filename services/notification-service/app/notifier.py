"""Notification sender.

Persists an in-app notification to job-search-service (via internal HTTP)
so the frontend navbar bell can display it, and optionally sends an SMTP
email when SMTP_HOST is configured.
"""
from __future__ import annotations

import datetime as dt
import logging
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from .config import get_settings

log = logging.getLogger("notifier")
settings = get_settings()

# job-search-service internal URL (service name in Docker Compose network)
_JOB_SEARCH_INTERNAL = "http://job-search-service:8002"


def send(
    user_id: str,
    subject: str,
    body: str,
    user_email: str = "",
    jobs: list[dict] | None = None,
) -> None:
    """Persist an in-app notification and (if configured) send an SMTP email."""
    _save_notification(user_id, subject, body, jobs or [])
    _send_email(user_email, subject, body)


# ── internal helpers ──────────────────────────────────────────────────────────

def _save_notification(
    user_id: str, subject: str, body: str, jobs: list[dict]
) -> None:
    item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "subject": subject,
        "body": body,
        "jobs": [
            {
                "id": j.get("id", ""),
                "title": j.get("title", ""),
                "city": j.get("city", ""),
            }
            for j in jobs
        ],
        "read": False,
        "created_at": dt.datetime.utcnow().isoformat() + "Z",
    }
    try:
        resp = httpx.post(
            f"{_JOB_SEARCH_INTERNAL}/api/v1/alerts/internal/notify",
            json=item,
            headers={"x-internal-key": settings.INTERNAL_API_KEY},
            timeout=5,
        )
        resp.raise_for_status()
        log.info("[NOTIFY-SAVED] uid=%s notification_id=%s", user_id, item["id"])
    except Exception as e:  # noqa: BLE001
        log.warning("[NOTIFY-SAVE-FAIL] Could not persist notification: %s", e)


def _send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        log.info("[NOTIFY-EMAIL-SKIP] SMTP not configured. subject=%s", subject)
        return
    if not to_email:
        log.warning("[NOTIFY-EMAIL-SKIP] No recipient address. subject=%s", subject)
        return
    try:
        from_addr = settings.SMTP_FROM or settings.SMTP_USER
        msg = MIMEMultipart("alternative")
        msg["From"] = from_addr
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(from_addr, to_email, msg.as_string())
        log.info("[NOTIFY-EMAIL-SENT] to=%s subject=%s", to_email, subject)
    except Exception as e:  # noqa: BLE001
        log.error("[NOTIFY-EMAIL-FAIL] to=%s error=%s", to_email, e)
