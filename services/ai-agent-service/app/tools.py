"""LLM 'tools' that proxy to our own REST endpoints.

The agent uses these to perform actual searches/applications instead of
hallucinating job results.
"""
from __future__ import annotations

import httpx

from .config import get_settings

settings = get_settings()


TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_jobs",
            "description": (
                "Search active job postings. Use this first to find relevant jobs. "
                "Returns up to `page_size` items with their IDs."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "position": {"type": "string", "description": "Job title / role keyword"},
                    "city": {"type": "string", "description": "Turkish city name"},
                    "country": {"type": "string"},
                    "work_preference": {
                        "type": "string",
                        "enum": ["onsite", "remote", "hybrid"],
                        "description": "Filter by work mode",
                    },
                    "page_size": {"type": "integer", "default": 5},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_job_details",
            "description": (
                "Fetch full details of a single job posting by its ID. "
                "Use after search_jobs when the user asks for more info about a specific job."
            ),
            "parameters": {
                "type": "object",
                "properties": {"job_id": {"type": "string", "description": "UUID of the job posting"}},
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_to_job",
            "description": (
                "Submit an application on behalf of the authenticated user. "
                "Requires the user to be logged in. "
                "Workflow: search_jobs → (optionally get_job_details) → apply_to_job."
            ),
            "parameters": {
                "type": "object",
                "properties": {"job_id": {"type": "string", "description": "UUID of the job to apply to"}},
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_alert",
            "description": (
                "Create a job alert so the user is notified when new matching jobs are posted. "
                "Use when the user asks to be notified or says 'alarm kur' / 'notify me'. "
                "Requires the user to be logged in."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "keywords": {
                        "type": "string",
                        "description": "Job title / role keywords to watch for",
                    },
                    "city": {"type": "string"},
                    "work_preference": {
                        "type": "string",
                        "enum": ["onsite", "remote", "hybrid"],
                    },
                },
                "required": ["keywords"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_alerts",
            "description": "List the authenticated user's active job alerts.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


async def search_jobs(
    position: str | None = None,
    city: str | None = None,
    country: str | None = None,
    work_preference: str | None = None,
    page_size: int = 5,
) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{settings.JOB_SEARCH_SERVICE_URL}/api/v1/search",
            params={k: v for k, v in {
                "position": position,
                "city": city,
                "country": country,
                "work_preference": work_preference,
                "page_size": page_size,
            }.items() if v},
        )
        r.raise_for_status()
        body = r.json()
    items = body.get("page", {}).get("items", [])
    return {
        "items": [
            {
                "id": j["id"],
                "title": j["title"],
                "company": (j.get("company") or {}).get("name"),
                "city": j.get("city"),
                "work_preference": j.get("work_preference"),
                "position_level": j.get("position_level"),
            }
            for j in items
        ]
    }


async def get_job_details(job_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs/{job_id}")
        r.raise_for_status()
        return r.json()


async def apply_to_job(job_id: str, bearer_token: str | None) -> dict:
    headers = {"Authorization": f"Bearer {bearer_token}"} if bearer_token else {}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs/{job_id}/apply",
            headers=headers,
        )
        if r.status_code in (401, 403):
            return {"ok": False, "reason": "login_required"}
        r.raise_for_status()
        return {"ok": True, "application": r.json()}


async def create_alert(
    keywords: str,
    city: str | None = None,
    work_preference: str | None = None,
    bearer_token: str | None = None,
) -> dict:
    if not bearer_token:
        return {"ok": False, "reason": "login_required"}
    headers = {"Authorization": f"Bearer {bearer_token}", "Content-Type": "application/json"}
    payload = {"keywords": keywords}
    if city:
        payload["city"] = city
    if work_preference:
        payload["work_preference"] = work_preference
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{settings.JOB_SEARCH_SERVICE_URL}/api/v1/alerts",
            json=payload,
            headers=headers,
        )
        if r.status_code in (401, 403):
            return {"ok": False, "reason": "login_required"}
        r.raise_for_status()
        return {"ok": True, "alert": r.json()}


async def list_alerts(bearer_token: str | None) -> dict:
    if not bearer_token:
        return {"ok": False, "reason": "login_required"}
    headers = {"Authorization": f"Bearer {bearer_token}"}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{settings.JOB_SEARCH_SERVICE_URL}/api/v1/alerts",
            headers=headers,
        )
        if r.status_code in (401, 403):
            return {"ok": False, "reason": "login_required"}
        r.raise_for_status()
        return {"alerts": r.json()}


DISPATCH = {
    "search_jobs":    lambda args, bearer: search_jobs(**args),
    "get_job_details": lambda args, bearer: get_job_details(**args),
    "apply_to_job":   lambda args, bearer: apply_to_job(**args, bearer_token=bearer),
    "create_alert":   lambda args, bearer: create_alert(**args, bearer_token=bearer),
    "list_alerts":    lambda args, bearer: list_alerts(bearer_token=bearer),
}



TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_jobs",
            "description": "Search active job postings. Returns up to `page_size` items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "position": {"type": "string", "description": "Job title / role keyword"},
                    "city": {"type": "string"},
                    "country": {"type": "string"},
                    "work_preference": {
                        "type": "string",
                        "enum": ["onsite", "remote", "hybrid"],
                    },
                    "page_size": {"type": "integer", "default": 5},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_job_details",
            "description": "Fetch a single job posting by id.",
            "parameters": {
                "type": "object",
                "properties": {"job_id": {"type": "string"}},
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_to_job",
            "description": "Submit an application for the current authenticated user.",
            "parameters": {
                "type": "object",
                "properties": {"job_id": {"type": "string"}},
                "required": ["job_id"],
            },
        },
    },
]


async def search_jobs(
    position: str | None = None,
    city: str | None = None,
    country: str | None = None,
    work_preference: str | None = None,
    page_size: int = 5,
) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{settings.JOB_SEARCH_SERVICE_URL}/api/v1/search",
            params={k: v for k, v in {
                "position": position,
                "city": city,
                "country": country,
                "work_preference": work_preference,
                "page_size": page_size,
            }.items() if v},
        )
        r.raise_for_status()
        body = r.json()
    items = body.get("page", {}).get("items", [])
    return {
        "items": [
            {
                "id": j["id"],
                "title": j["title"],
                "company": (j.get("company") or {}).get("name"),
                "city": j.get("city"),
                "work_preference": j.get("work_preference"),
            }
            for j in items
        ]
    }


async def get_job_details(job_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs/{job_id}")
        r.raise_for_status()
        return r.json()


async def apply_to_job(job_id: str, bearer_token: str | None) -> dict:
    headers = {"Authorization": f"Bearer {bearer_token}"} if bearer_token else {}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{settings.JOB_POSTING_SERVICE_URL}/api/v1/jobs/{job_id}/apply",
            headers=headers,
        )
        if r.status_code in (401, 403):
            return {"ok": False, "reason": "login_required"}
        r.raise_for_status()
        return {"ok": True, "application": r.json()}


DISPATCH = {
    "search_jobs": lambda args, bearer: search_jobs(**args),
    "get_job_details": lambda args, bearer: get_job_details(**args),
    "apply_to_job": lambda args, bearer: apply_to_job(**args, bearer_token=bearer),
}
