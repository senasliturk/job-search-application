"""NoSQL client — Firebase Firestore (notification service).

Reads alerts/searches written by job-search-service.
Writes notifications to the shared 'notifications' collection.
Falls back to in-memory when Firebase is not configured (local dev).
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from .config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


class _MemoryContainer:
    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    def upsert_item(self, item: dict) -> dict:
        item.setdefault("id", str(uuid.uuid4()))
        self._items[item["id"]] = item
        return item

    def query_items(self, query: str = "", parameters: list | None = None, **kw):
        params = {p["name"]: p["value"] for p in (parameters or [])}
        for item in list(self._items.values()):
            if "@user_id" in params and item.get("user_id") != params["@user_id"]:
                continue
            if "@active" in params and item.get("active") != params["@active"]:
                continue
            if "@cutoff" in params and item.get("searched_at", "") < params["@cutoff"]:
                continue
            yield item

    def delete_item(self, item: str, partition_key: str) -> None:
        self._items.pop(item, None)


class _FirestoreContainer:
    def __init__(self, collection) -> None:
        self._col = collection

    def upsert_item(self, item: dict) -> dict:
        item.setdefault("id", str(uuid.uuid4()))
        self._col.document(item["id"]).set(item)
        return item

    def query_items(self, query: str = "", parameters: list | None = None, **kw):
        params = {p["name"]: p["value"] for p in (parameters or [])}
        q = self._col
        if "@user_id" in params:
            q = q.where("user_id", "==", params["@user_id"])
        if "@active" in params:
            q = q.where("active", "==", params["@active"])
        if "@cutoff" in params:
            q = q.where("searched_at", ">=", params["@cutoff"])
        for doc in q.stream():
            yield doc.to_dict()

    def delete_item(self, item: str, partition_key: str) -> None:
        self._col.document(item).delete()


class _Db:
    def __init__(self) -> None:
        self.alerts: Any
        self.searches: Any
        self.notifications: Any
        self._connect()

    def _connect(self) -> None:
        if not settings.FIREBASE_PROJECT_ID:
            log.warning("FIREBASE_PROJECT_ID empty — notification service using in-memory store.")
            self._use_memory()
            return
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            if not firebase_admin._apps:
                import json, os
                sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
                sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
                if sa_json:
                    cred = credentials.Certificate(json.loads(sa_json))
                elif sa_path and os.path.exists(sa_path):
                    cred = credentials.Certificate(sa_path)
                else:
                    cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})

            fs = firestore.client()
            self.alerts = _FirestoreContainer(fs.collection("user_alerts"))
            self.searches = _FirestoreContainer(fs.collection("user_searches"))
            self.notifications = _FirestoreContainer(fs.collection("notifications"))
            log.info("Firestore connected (project=%s)", settings.FIREBASE_PROJECT_ID)
        except Exception as e:  # noqa: BLE001
            log.warning("Firestore connect failed (%s) — falling back to in-memory.", e)
            self._use_memory()

    def _use_memory(self) -> None:
        self.alerts = _MemoryContainer()
        self.searches = _MemoryContainer()
        self.notifications = _MemoryContainer()


db = _Db()
