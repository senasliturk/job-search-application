"""Job alert (Iş Alarmı) CRUD. Stored in Cosmos DB so the Notification
Service's nightly task can scan all alerts cheaply by partition key."""
from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException

from ..auth import require_user
from ..config import get_settings
from ..cosmos_client import db
from ..schemas import JobAlertCreate, JobAlertOut, NotificationOut

router = APIRouter(prefix="/alerts", tags=["alerts"])
settings = get_settings()


@router.post("", response_model=JobAlertOut, status_code=201)
def create_alert(body: JobAlertCreate, user: dict = Depends(require_user)):
    item = {
        "id": str(uuid.uuid4()),
        "user_id": user["uid"],
        "user_email": user.get("email", ""),
        "keywords": body.keywords,
        "country": body.country,
        "city": body.city,
        "town": body.town,
        "work_preference": body.work_preference,
        "active": True,
        "created_at": dt.datetime.utcnow().isoformat() + "Z",
        "last_notified_at": None,
    }
    db.alerts.upsert_item(item)
    return item


@router.get("", response_model=list[JobAlertOut])
def list_alerts(user: dict = Depends(require_user)):
    rows = list(
        db.alerts.query_items(
            query="SELECT * FROM c WHERE c.user_id = @user_id AND c.active = @active",
            parameters=[
                {"name": "@user_id", "value": user["uid"]},
                {"name": "@active", "value": True},
            ],
            enable_cross_partition_query=False,
        )
    )
    return rows


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: str, user: dict = Depends(require_user)):
    # Cosmos delete by id+partition_key
    try:
        db.alerts.delete_item(item=alert_id, partition_key=user["uid"])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(404, f"Alert not found: {e}") from e
    return None


# ── In-app notifications ───────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user: dict = Depends(require_user)):
    """Return the 50 most recent notifications for the current user (read + unread)."""
    rows = list(
        db.notifications.query_items(
            query="SELECT TOP 50 * FROM c WHERE c.user_id = @user_id ORDER BY c.created_at DESC",
            parameters=[{"name": "@user_id", "value": user["uid"]}],
            enable_cross_partition_query=False,
        )
    )
    # Sort by created_at descending (memory container doesn't support ORDER BY)
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return rows[:50]


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: str, user: dict = Depends(require_user)):
    """Mark a single notification as read."""
    # Fetch existing notification (must belong to current user)
    try:
        item = db.notifications.read_item(item=notification_id, partition_key=user["uid"])
    except Exception:
        # Fallback: scan (works for both in-memory and Cosmos)
        rows = list(
            db.notifications.query_items(
                query="SELECT * FROM c WHERE c.id = @id AND c.user_id = @user_id",
                parameters=[
                    {"name": "@id", "value": notification_id},
                    {"name": "@user_id", "value": user["uid"]},
                ],
                enable_cross_partition_query=False,
            )
        )
        if not rows:
            raise HTTPException(404, "Notification not found")
        item = rows[0]
    item["read"] = True
    db.notifications.upsert_item(item)
    return item


@router.post("/notifications/read-all", status_code=204)
def mark_all_read(user: dict = Depends(require_user)):
    """Mark all unread notifications as read for the current user."""
    rows = list(
        db.notifications.query_items(
            query="SELECT * FROM c WHERE c.user_id = @user_id AND c.read = @read",
            parameters=[
                {"name": "@user_id", "value": user["uid"]},
                {"name": "@read", "value": False},
            ],
            enable_cross_partition_query=False,
        )
    )
    for item in rows:
        item["read"] = True
        db.notifications.upsert_item(item)
    return None


# ── Internal endpoint (notification-service → job-search-service) ─────────────

@router.get("/internal/all-active", include_in_schema=False)
def internal_list_all_active_alerts(x_internal_key: str | None = Header(default=None)):
    """Called by notification-service to read all active alerts across users."""
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(401, "internal-api-key required")
    rows = list(
        db.alerts.query_items(
            query="SELECT * FROM c WHERE c.active = @active",
            parameters=[{"name": "@active", "value": True}],
            enable_cross_partition_query=True,
        )
    )
    return rows


@router.post("/internal/notify", status_code=201, include_in_schema=False)
def internal_create_notification(
    payload: dict,
    x_internal_key: str | None = Header(default=None),
):
    """Called by notification-service to persist a notification in this service's store."""
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(401, "internal-api-key required")
    payload.setdefault("id", str(uuid.uuid4()))
    payload.setdefault("read", False)
    payload.setdefault("created_at", dt.datetime.utcnow().isoformat() + "Z")
    db.notifications.upsert_item(payload)
    return payload

