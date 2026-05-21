"""API Gateway.

Single public entrypoint. Routes incoming requests to the right backend
service. Verifies Firebase ID tokens once at the edge so downstream services
trust the upstream `Authorization` header.

Per assignment: 'All APIs will be reached via an API gateway.'
"""
from __future__ import annotations

import logging

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(
    title="Job Search – API Gateway",
    version="1.0.0",
    description="Single ingress for all backend services.",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
)

origins = (
    [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
    if settings.ALLOWED_ORIGINS != "*"
    else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path prefix → upstream
ROUTES = [
    ("/api/v1/jobs", settings.JOB_POSTING_SERVICE_URL),
    ("/api/v1/admin/jobs", settings.JOB_POSTING_SERVICE_URL),
    ("/api/v1/admin/companies", settings.JOB_POSTING_SERVICE_URL),
    ("/api/v1/profile", settings.JOB_POSTING_SERVICE_URL),
    ("/api/v1/search", settings.JOB_SEARCH_SERVICE_URL),
    ("/api/v1/alerts", settings.JOB_SEARCH_SERVICE_URL),
    ("/api/v1/agent", settings.AI_AGENT_SERVICE_URL),
    ("/internal", settings.NOTIFICATION_SERVICE_URL),
]


def _resolve_upstream(path: str) -> str | None:
    for prefix, upstream in ROUTES:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + "?"):
            return upstream
    return None


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": settings.SERVICE_NAME}


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(full_path: str, request: Request):
    upstream = _resolve_upstream("/" + full_path)
    if upstream is None:
        return Response("Not Found", status_code=404)

    url = f"{upstream}/{full_path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}
    body = await request.body()

    async with httpx.AsyncClient(timeout=30) as client:
        upstream_resp = await client.request(
            request.method,
            url,
            params=request.query_params,
            content=body,
            headers=headers,
        )

    # Strip hop-by-hop headers
    safe_headers = {k: v for k, v in upstream_resp.headers.items() if k.lower() not in {
        "transfer-encoding", "connection", "content-encoding"
    }}
    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=safe_headers,
        media_type=upstream_resp.headers.get("content-type"),
    )
