"""User profile endpoints — any authenticated user manages their own profile.

GET  /profile           → return current user's profile
PUT  /profile           → upsert school / department
POST /profile/cv        → upload PDF CV (max 5 MB)
GET  /profile/cv/{uid}  → download a user's CV (company / admin only)
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import JobPosting, SavedJob, UserProfile
from ..schemas import JobPostingOut, UserProfileIn, UserProfileOut

log = logging.getLogger(__name__)

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

    p = db.get(UserProfile, uid)
    if not p:
        p = UserProfile(user_id=uid)
        db.add(p)

    p.cv_filename = filename
    p.cv_data = content
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
) -> Response:
    """Download a candidate's CV. Requires company or admin role."""
    p = db.get(UserProfile, user_id)
    if not p or not p.cv_filename or not p.cv_data:
        raise HTTPException(404, "CV bulunamadı.")

    display = p.cv_filename.split("_", 1)[1] if "_" in p.cv_filename else p.cv_filename
    return Response(
        content=p.cv_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{display}"'},
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET  /profile/saved-jobs          → list saved jobs
# GET  /profile/saved-jobs/{job_id} → check if saved
# POST /profile/saved-jobs/{job_id} → save a job
# DELETE /profile/saved-jobs/{job_id} → unsave a job
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/saved-jobs", response_model=list[JobPostingOut])
def list_saved_jobs(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[JobPostingOut]:
    uid = user["uid"]
    rows = (
        db.query(SavedJob)
        .filter(SavedJob.user_id == uid)
        .options(selectinload(SavedJob.job).selectinload(JobPosting.company))
        .order_by(SavedJob.saved_at.desc())
        .all()
    )
    return [r.job for r in rows if r.job and r.job.is_active]


@router.get("/saved-jobs/{job_id}")
def get_saved_status(
    job_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    uid = user["uid"]
    exists = (
        db.query(SavedJob)
        .filter(SavedJob.user_id == uid, SavedJob.job_posting_id == job_id)
        .first()
    )
    return {"saved": exists is not None}


@router.post("/saved-jobs/{job_id}")
def save_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    uid = user["uid"]
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, "İlan bulunamadı.")
    existing = (
        db.query(SavedJob)
        .filter(SavedJob.user_id == uid, SavedJob.job_posting_id == job_id)
        .first()
    )
    if existing:
        return {"saved": True}
    try:
        db.add(SavedJob(user_id=uid, job_posting_id=job_id))
        db.commit()
    except IntegrityError:
        db.rollback()
    return {"saved": True}


@router.delete("/saved-jobs/{job_id}", status_code=204)
def unsave_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> Response:
    uid = user["uid"]
    row = (
        db.query(SavedJob)
        .filter(SavedJob.user_id == uid, SavedJob.job_posting_id == job_id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return Response(status_code=204)
