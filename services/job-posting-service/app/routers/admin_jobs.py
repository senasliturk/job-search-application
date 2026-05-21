"""Admin endpoints — authenticated. Authorized admins/companies create or update jobs."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..cache import cache_delete_pattern
from ..database import get_db
from ..models import Company, JobApplication, JobPosting, UserProfile
from ..queue import publish_new_job
from ..schemas import JobPostingCreate, JobPostingOut, JobPostingUpdate

router = APIRouter(prefix="/admin/jobs", tags=["admin-jobs"])


@router.post("", response_model=JobPostingOut, status_code=status.HTTP_201_CREATED)
def create_job(
    body: JobPostingCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    company = db.get(Company, body.company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    job = JobPosting(**body.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)

    # Bust list caches so the new job shows up on next read.
    cache_delete_pattern("jobs:list:*")
    cache_delete_pattern("autocomplete:*")

    # Fire-and-forget event for the Notification Service.
    publish_new_job(
        {
            "id": job.id,
            "title": job.title,
            "country": job.country,
            "city": job.city,
            "town": job.town,
            "work_preference": job.work_preference,
            "company": {"id": company.id, "name": company.name},
        }
    )
    return job


@router.patch("/{job_id}", response_model=JobPostingOut)
def update_job(
    job_id: str,
    body: JobPostingUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(job, k, v)
    db.commit()
    db.refresh(job)

    cache_delete_pattern(f"job:{job_id}")
    cache_delete_pattern("jobs:list:*")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Soft-delete by flipping is_active=False (we never hard-delete history)."""
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    job.is_active = False
    db.commit()
    cache_delete_pattern(f"job:{job_id}")
    cache_delete_pattern("jobs:list:*")
    return None


@router.get("/applications")
def list_company_applications(
    company_id: Annotated[str, Query()],
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all applications for every job belonging to the given company."""
    rows = db.execute(
        select(
            JobApplication.id,
            JobApplication.user_id,
            func.coalesce(JobApplication.display_name, UserProfile.display_name).label("display_name"),
            func.coalesce(JobApplication.email, UserProfile.email).label("email"),
            JobApplication.applied_at,
            JobApplication.status,
            JobPosting.id.label("job_id"),
            JobPosting.title.label("job_title"),
            UserProfile.school,
            UserProfile.department,
            UserProfile.cv_filename,
            UserProfile.education_status,
            UserProfile.class_year,
            UserProfile.experience_level,
        )
        .join(JobPosting, JobApplication.job_posting_id == JobPosting.id)
        .outerjoin(UserProfile, JobApplication.user_id == UserProfile.user_id)
        .where(JobPosting.company_id == company_id)
        .order_by(JobApplication.applied_at.desc())
    ).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "display_name": r.display_name,
            "email": r.email,
            "applied_at": r.applied_at,
            "status": r.status,
            "job_id": r.job_id,
            "job_title": r.job_title,
            "school": r.school,
            "department": r.department,
            "cv_filename": r.cv_filename,
            "education_status": r.education_status,
            "class_year": r.class_year,
            "experience_level": r.experience_level,
        }
        for r in rows
    ]
