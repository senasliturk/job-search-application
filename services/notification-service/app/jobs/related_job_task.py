"""Scheduled task #2 – Related job notifier.

Per assignment:
    o To go over job searches a user makes from a job searches a user made and send
      user notification about related job postings.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import logging
from collections import defaultdict

import httpx

from ..config import get_settings
from ..cosmos_client import db
from ..notifier import send

log = logging.getLogger(__name__)
settings = get_settings()

# Only consider searches from the last day so we don't spam users.
LOOKBACK_HOURS = 24


async def _fetch_related(position: str | None, city: str | None) -> list[dict]:
    """Ask the Job Posting service for postings matching the user's recent searches."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs",
            params={k: v for k, v in {"title": position, "city": city, "page_size": 5}.items() if v},
        )
        r.raise_for_status()
        return r.json().get("items", [])


def run() -> dict:
    cutoff = (dt.datetime.utcnow() - dt.timedelta(hours=LOOKBACK_HOURS)).isoformat() + "Z"
    rows = list(
        db.searches.query_items(
            query="SELECT * FROM c WHERE c.searched_at >= @cutoff",
            parameters=[{"name": "@cutoff", "value": cutoff}],
            enable_cross_partition_query=True,
        )
    )

    # group by user → take the most recent (position, city) per user
    grouped: dict[str, dict] = {}
    for row in sorted(rows, key=lambda r: r.get("searched_at", "")):
        if row.get("user_id") in (None, "anonymous"):
            continue
        grouped[row["user_id"]] = row

    sent = 0
    for user_id, search in grouped.items():
        position = search.get("query_position")
        city = search.get("query_city")
        if not (position or city):
            continue
        related = asyncio.run(_fetch_related(position, city))
        if not related:
            continue
        body = "\n".join(f"- {j['title']} ({j.get('city','')})" for j in related[:3])
        send(
            user_id,
            subject="Yeni ilgini çekebilecek ilanlar",
            body=body,
        )
        sent += 1

    return {"users_evaluated": len(grouped), "notifications_sent": sent}
