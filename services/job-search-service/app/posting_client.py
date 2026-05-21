"""Thin wrapper around the Job Posting Service."""
import httpx

from .config import get_settings

settings = get_settings()


async def search_postings(params: dict) -> dict:
    """Re-uses the public list endpoint of the posting service.
    Kept here so the search service is the single owner of search semantics
    (filtering, history persistence) while the posting service stays the
    source of truth for postings themselves."""
    url = f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, params={k: v for k, v in params.items() if v is not None})
        r.raise_for_status()
        return r.json()
