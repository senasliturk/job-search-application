"""Job Search Service entrypoint."""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import alerts, search

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(
    title="Job Search Service",
    version="1.0.0",
    description="Search jobs by position/city/filters; persists searches to NoSQL.",
    openapi_url=f"/api/{settings.API_VERSION}/openapi.json",
    docs_url=f"/api/{settings.API_VERSION}/docs",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(search.router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(alerts.router, prefix=f"/api/{settings.API_VERSION}")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": settings.SERVICE_NAME}
