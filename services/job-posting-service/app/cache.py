"""Distributed cache wrapper around Redis.

Per assignment: "At least one distributed caching solution needs to be
implemented (i.e Hotel Details)" — for our domain that's Job Posting reads.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import redis

from .config import get_settings

log = logging.getLogger(__name__)
_settings = get_settings()

try:
    _client: redis.Redis | None = redis.from_url(_settings.REDIS_URL, decode_responses=True)
    _client.ping()
except Exception as e:  # noqa: BLE001
    log.warning("Redis unavailable (%s); falling back to no-op cache.", e)
    _client = None


def cache_get(key: str) -> Any | None:
    if _client is None:
        return None
    raw = _client.get(key)
    return json.loads(raw) if raw else None


def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    if _client is None:
        return
    _client.set(key, json.dumps(value, default=str), ex=ttl or _settings.REDIS_TTL_SECONDS)


def cache_delete_pattern(pattern: str) -> None:
    """Bust a group of keys (used after writes)."""
    if _client is None:
        return
    for key in _client.scan_iter(match=pattern, count=200):
        _client.delete(key)
