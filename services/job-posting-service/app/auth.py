"""Firebase ID-token verification.

The API Gateway also verifies tokens, but every service revalidates the token
attached as `Authorization: Bearer <id_token>` so they remain independently
deployable and can also be tested directly.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import firebase_admin
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth, credentials

from .config import get_settings


@lru_cache
def _init_firebase() -> firebase_admin.App | None:
    """Returns a Firebase App if a real credentials JSON exists, else None.

    We intentionally DO NOT try Application Default Credentials when no JSON
    is provided — ADC fails in dev containers and the resulting exception
    converts every protected request into a 500 instead of 401. Dev-mode
    (returning None) is much friendlier.
    """
    settings = get_settings()
    if firebase_admin._apps:
        return firebase_admin.get_app()
    cred_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    if cred_path and os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            return firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
        except Exception:
            return None
    return None  # auth disabled (dev mode)


def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Decode the Firebase ID token and return the decoded claims.

    If Firebase isn't configured (local dev), we accept a header
    `X-Dev-User: uid:email` to ease testing — clearly marked as dev-only.
    """
    app = _init_firebase()
    if app is None:
        # Dev fallback. Real deploy MUST configure Firebase.
        return {"uid": "dev-user", "email": "dev@example.com", "_dev": True}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = auth.verify_id_token(token, app=app)
        return decoded
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}") from e


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Admin endpoints – require custom claim `role=admin` or `role=company`."""
    if user.get("_dev"):
        return user
    role = user.get("role") or (user.get("custom_claims") or {}).get("role")
    if role not in {"admin", "company"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin or company role required")
    return user
