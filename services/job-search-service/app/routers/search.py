"""Search endpoints. Every search is recorded in Cosmos DB so we can
(a) show 'Son Aramalarım' on the home page, and
(b) the notification service can use the history for related-job alerts.
"""
from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..auth import get_optional_user
from ..cosmos_client import db
from ..posting_client import search_postings
from ..schemas import Page, StoredSearch

router = APIRouter(prefix="/search", tags=["search"])


class SearchResponse(BaseModel):
    page: dict  # raw paginated response from posting service
    stored_search_id: str | None


@router.get("", response_model=SearchResponse)
async def search(
    position: str | None = Query(default=None),
    city: str | None = Query(default=None),
    country: str | None = Query(default=None),
    town: str | None = Query(default=None),
    work_preference: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(get_optional_user),
):
    page_data = await search_postings(
        {
            "title": position,
            "city": city,
            "country": country,
            "town": town,
            "work_preference": work_preference,
            "page": page,
            "page_size": page_size,
        }
    )

    # Persist the search (NoSQL container partitioned by user_id).
    stored_id = None
    if any([position, city, country, town, work_preference]):
        stored = {
            "id": str(uuid.uuid4()),
            "user_id": user["uid"],
            "query_position": position,
            "query_city": city,
            "query_country": country,
            "filters": {
                "town": town,
                "work_preference": work_preference,
            },
            "result_count": page_data.get("total", 0),
            "searched_at": dt.datetime.utcnow().isoformat() + "Z",
        }
        db.searches.upsert_item(stored)
        stored_id = stored["id"]

    return SearchResponse(page=page_data, stored_search_id=stored_id)


@router.get("/recent", response_model=list[StoredSearch])
def recent_searches(
    limit: int = 5,
    user: dict = Depends(get_optional_user),
):
    """Powers 'Son Aramalarım' on the home page."""
    if user["uid"] == "anonymous":
        return []
    rows = list(
        db.searches.query_items(
            query="SELECT * FROM c WHERE c.user_id = @user_id ORDER BY c.searched_at DESC",
            parameters=[{"name": "@user_id", "value": user["uid"]}],
            enable_cross_partition_query=False,
        )
    )
    rows.sort(key=lambda r: r.get("searched_at", ""), reverse=True)
    return rows[:limit]
