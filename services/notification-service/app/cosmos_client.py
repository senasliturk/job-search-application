"""Read/write Cosmos client for the notification service.

Reads alerts from the shared container the Job Search service writes to.
Writes notifications to the shared `notifications` container (also read by Job Search service).
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from .config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


class _NoCosmos:
    """Pure no-op for local dev when Cosmos is not configured."""
    def query_items(self, *_a, **_kw):
        return iter(())

    def upsert_item(self, item):
        log.info("[COSMOS-NOOP] upsert_item id=%s", item.get("id", "?"))
        return item


class _MemNotifications:
    """In-memory notifications store for local dev."""
    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    def upsert_item(self, item: dict) -> dict:
        item.setdefault("id", str(uuid.uuid4()))
        self._items[item["id"]] = item
        return item

    def query_items(self, *_a, **_kw):
        return iter(self._items.values())


class _Db:
    def __init__(self) -> None:
        self.alerts: Any
        self.searches: Any
        self.notifications: Any
        if not settings.COSMOS_ENDPOINT:
            log.warning("COSMOS_ENDPOINT empty – notification service runs without DB.")
            self.alerts = _NoCosmos()
            self.searches = _NoCosmos()
            self.notifications = _MemNotifications()
            return
        try:
            from azure.cosmos import CosmosClient, PartitionKey
            client = CosmosClient(settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY)
            cosmos_db = client.create_database_if_not_exists(id=settings.COSMOS_DATABASE)
            self.alerts = cosmos_db.get_container_client(settings.COSMOS_CONTAINER_ALERTS)
            self.searches = cosmos_db.get_container_client(settings.COSMOS_CONTAINER_SEARCHES)
            self.notifications = cosmos_db.create_container_if_not_exists(
                id=settings.COSMOS_CONTAINER_NOTIFICATIONS,
                partition_key=PartitionKey(path="/user_id"),
            )
        except Exception as e:  # noqa: BLE001
            log.warning("Cosmos connect failed (%s) – using no-op store.", e)
            self.alerts = _NoCosmos()
            self.searches = _NoCosmos()
            self.notifications = _MemNotifications()


db = _Db()
