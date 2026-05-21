"""Same shape as Job-Posting Service. Kept duplicated so each service is
deployable on its own — typical microservice trade-off."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import firebase_admin
from fastapi import Header, HTTPException, status
from firebase_admin import auth, credentials

from .config import get_settings


@lru_cache
def _init() -> firebase_admin.App | None:
    """Returns a Firebase App only when a real credentials JSON exists.
    Without one, return None so callers fall back to dev mode. We avoid
    Application Default Credentials in dev to prevent 500 errors."""
    s = get_settings()
    if firebase_admin._apps:
        return firebase_admin.get_app()
    if s.GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(s.GOOGLE_APPLICATION_CREDENTIALS):
        try:
            cred = credentials.Certificate(s.GOOGLE_APPLICATION_CREDENTIALS)
            return firebase_admin.initialize_app(cred, {"projectId": s.FIREBASE_PROJECT_ID})
        except Exception:
            return None
    return None


def get_optional_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Most search endpoints don't require login, but if a token is present we
    record the search history under that user."""
    app = _init()
    if not authorization:
        return {"uid": "anonymous"}
    if app is None:
        return {"uid": "dev-user", "_dev": True}
    if not authorization.lower().startswith("bearer "):
        return {"uid": "anonymous"}
    try:
        return auth.verify_id_token(authorization.split(" ", 1)[1].strip(), app=app)
    except Exception:  # noqa: BLE001
        return {"uid": "anonymous"}


def require_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    app = _init()
    if app is None:
        return {"uid": "dev-user", "_dev": True}
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        return auth.verify_id_token(authorization.split(" ", 1)[1].strip(), app=app)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}") from e
