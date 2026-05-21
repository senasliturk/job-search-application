"""User profile endpoints — any authenticated user manages their own profile.

GET  /profile           → return current user's profile
PUT  /profile           → upsert school / department
POST /profile/cv        → upload PDF CV (max 5 MB)
GET  /profile/cv/{uid}  → download a user's CV (company / admin only)
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import UserProfile
from ..schemas import UserProfileIn, UserProfileOut

log = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.getenv("CV_UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_CV_BYTES = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/profile", tags=["profile"])


# ──────────────────────────────────────────────────────────────────────────────
# GET  /profile
# ──────────────────────────────────────────────────────────────────────────────
@router.get("", response_model=UserProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> UserProfileOut:
    uid = user["uid"]
    p = db.get(UserProfile, uid)
    if not p:
        p = UserProfile(user_id=uid)
        db.add(p)
    # Auto-sync display_name and email from the Firebase token so companies
    # can see this info even on old applications that pre-date these columns.
    token_name = user.get("name") or user.get("display_name")
    token_email = user.get("email")
    changed = False
    if token_name and p.display_name != token_name:
        p.display_name = token_name
        changed = True
    if token_email and p.email != token_email:
        p.email = token_email
        changed = True
    if changed or p.user_id not in db.identity_map:
        db.commit()
        db.refresh(p)
    return p


# ──────────────────────────────────────────────────────────────────────────────
# PUT  /profile
# ──────────────────────────────────────────────────────────────────────────────
@router.put("", response_model=UserProfileOut)
def update_profile(
    body: UserProfileIn,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> UserProfileOut:
    uid = user["uid"]
    p = db.get(UserProfile, uid)
    if not p:
        p = UserProfile(user_id=uid)
        db.add(p)
    # Always apply every field sent by the client — None means "clear this field"
    for field, value in body.model_dump().items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


# ──────────────────────────────────────────────────────────────────────────────
# POST /profile/cv
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/cv", response_model=UserProfileOut)
async def upload_cv(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> UserProfileOut:
    if file.content_type not in {"application/pdf"}:
        raise HTTPException(400, "Yalnızca PDF dosyası yüklenebilir.")

    content = await file.read(MAX_CV_BYTES + 1)
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(413, "CV dosyası en fazla 5 MB olabilir.")

    uid = user["uid"]
    safe_orig = re.sub(r"[^a-zA-Z0-9._\- ]", "_", file.filename or "cv.pdf").strip()
    filename = f"{uid}_{safe_orig}"

    # Persist file
    (UPLOAD_DIR / filename).write_bytes(content)

    p = db.get(UserProfile, uid)
    if not p:
        p = UserProfile(user_id=uid)
        db.add(p)

    # Remove old file if different
    if p.cv_filename and p.cv_filename != filename:
        old = UPLOAD_DIR / p.cv_filename
        try:
            old.unlink(missing_ok=True)
        except Exception:
            pass

    p.cv_filename = filename
    db.commit()
    db.refresh(p)
    return p


# ──────────────────────────────────────────────────────────────────────────────
# GET  /profile/cv/{user_id}
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/cv/{user_id}")
def download_cv(
    user_id: str,
    db: Session = Depends(get_db),
    _caller: dict = Depends(require_admin),
) -> FileResponse:
    """Download a candidate's CV. Requires company or admin role."""
    p = db.get(UserProfile, user_id)
    if not p or not p.cv_filename:
        raise HTTPException(404, "CV bulunamadı.")

    path = UPLOAD_DIR / p.cv_filename
    if not path.exists():
        raise HTTPException(404, "CV dosyası sunucuda bulunamadı.")

    # Strip the uid_ prefix to produce a friendly download filename
    display = p.cv_filename.split("_", 1)[1] if "_" in p.cv_filename else p.cv_filename
    return FileResponse(path, media_type="application/pdf", filename=display)
