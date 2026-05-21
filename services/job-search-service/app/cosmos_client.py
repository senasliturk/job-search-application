"""Lazy Cosmos DB client.

Per assignment: "Job searches will be stored in a separate No SQL DB".
Containers are partitioned by `user_id` so per-user history scans cheaply.

If COSMOS_ENDPOINT is not set we fall back to an in-memory dict so local
development still works without an Azure account.
"""
from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict
from typing import Any

from .config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


class _MemoryContainer:
    """Tiny stand-in for Cosmos when COSMOS_ENDPOINT is empty."""

    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    def upsert_item(self, item: dict) -> dict:
        item.setdefault("id", str(uuid.uuid4()))
        self._items[item["id"]] = item
        return item

    def read_item(self, item: str, partition_key: str) -> dict:
        if item not in self._items:
            raise KeyError(f"Item {item!r} not found")
        return self._items[item]

    def query_items(self, query: str, parameters: list[dict[str, Any]] | None = None, **kw):
        # Extremely small subset of SQL filtering – enough for our use cases.
        params = {p["name"]: p["value"] for p in (parameters or [])}
        for item in list(self._items.values()):
            if "@user_id" in params and item.get("user_id") != params["@user_id"]:
                continue
            if "@active" in params and item.get("active") != params["@active"]:
                continue
            if "@read" in params and item.get("read") != params["@read"]:
                continue
            yield item

    def delete_item(self, item: str, partition_key: str) -> None:
        self._items.pop(item, None)


class _CosmosLike:
    """Thin facade so the rest of the code only sees `db.searches.upsert_item(...)`."""

    def __init__(self) -> None:
        self.searches: Any
        self.alerts: Any
        self.notifications: Any
        self._connect()

    def _connect(self) -> None:
        if not settings.COSMOS_ENDPOINT:
            log.warning("COSMOS_ENDPOINT empty — using in-memory store (local dev only).")
            self.searches = _MemoryContainer()
            self.alerts = _MemoryContainer()
            self.notifications = _MemoryContainer()
            return
        try:
            from azure.cosmos import CosmosClient, PartitionKey

            client = CosmosClient(settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY)
            db = client.create_database_if_not_exists(id=settings.COSMOS_DATABASE)
            self.searches = db.create_container_if_not_exists(
                id=settings.COSMOS_CONTAINER_SEARCHES,
                partition_key=PartitionKey(path="/user_id"),
            )
            self.alerts = db.create_container_if_not_exists(
                id=settings.COSMOS_CONTAINER_ALERTS,
                partition_key=PartitionKey(path="/user_id"),
            )
            self.notifications = db.create_container_if_not_exists(
                id=settings.COSMOS_CONTAINER_NOTIFICATIONS,
                partition_key=PartitionKey(path="/user_id"),
            )
            log.info("Cosmos DB connected (db=%s)", settings.COSMOS_DATABASE)
        except Exception as e:  # noqa: BLE001
            log.warning("Cosmos connect failed (%s) — falling back to in-memory store.", e)
            self.searches = _MemoryContainer()
            self.alerts = _MemoryContainer()
            self.notifications = _MemoryContainer()


db = _CosmosLike()


def now_ms() -> int:
    return int(time.time() * 1000)
