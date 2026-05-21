"""Public read endpoints — paginated, cached."""
from __future__ import annotations

import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user
from ..cache import cache_get, cache_set
from ..database import get_db
from ..models import Company, JobApplication, JobPosting
from ..pagination import PageParams, page_params
from ..schemas import JobApplicationOut, JobPostingOut, Page

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _list_cache_key(filters: dict, page: PageParams) -> str:
    payload = json.dumps({"f": filters, "p": page.model_dump()}, sort_keys=True, default=str)
    digest = hashlib.sha1(payload.encode()).hexdigest()
    return f"jobs:list:{digest}"


@router.get("", response_model=Page[JobPostingOut])
def list_jobs(
    db: Session = Depends(get_db),
    page: PageParams = Depends(page_params),
    title: Annotated[str | None, Query()] = None,
    country: Annotated[str | None, Query()] = None,
    city: Annotated[str | None, Query()] = None,
    town: Annotated[str | None, Query()] = None,
    work_preference: Annotated[str | None, Query()] = None,
    company_id: Annotated[str | None, Query()] = None,
):
    filters = {
        "title": title,
        "country": country,
        "city": city,
        "town": town,
        "work_preference": work_preference,
        "company_id": company_id,
    }

    cache_key = _list_cache_key(filters, page)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    q = select(JobPosting).options(selectinload(JobPosting.company)).where((JobPosting.is_active == True))
    # ilike (case-insensitive substring) for free-text columns so Turkish
    # input like "izmir" matches DB "İzmir" — and partial city/title matches
    # work without users having to type the exact full string.
    if title:
        q = q.where(JobPosting.title.ilike(f"%{title}%"))
    if country:
        q = q.where(JobPosting.country.ilike(f"%{country}%"))
    if city:
        q = q.where(JobPosting.city.ilike(f"%{city}%"))
    if town:
        q = q.where(JobPosting.town.ilike(f"%{town}%"))
    if work_preference:
        q = q.where(JobPosting.work_preference == work_preference)
    if company_id:
        q = q.where(JobPosting.company_id == company_id)

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    items = db.scalars(q.order_by(JobPosting.last_updated.desc()).offset(page.offset).limit(page.page_size)).all()

    response = Page[JobPostingOut](
        items=[JobPostingOut.model_validate(j) for j in items],
        page=page.page,
        page_size=page.page_size,
        total=total,
        has_next=(page.offset + len(items)) < total,
    ).model_dump()

    cache_set(cache_key, response, ttl=60)
    return response


@router.get("/featured", response_model=list[JobPostingOut])
def featured_for_city(
    city: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
    db: Session = Depends(get_db),
):
    """Used by the home page – at least 5 postings in the user's current city."""
    q = select(JobPosting).options(selectinload(JobPosting.company)).where((JobPosting.is_active == True))
    if city:
        q = q.where(JobPosting.city == city)
    rows = db.scalars(q.order_by(JobPosting.last_updated.desc()).limit(limit)).all()
    if len(rows) < limit:
        # Fallback to any city if not enough results in the given one.
        extra = db.scalars(
            select(JobPosting)
            .options(selectinload(JobPosting.company))
            .where((JobPosting.is_active == True))
            .order_by(JobPosting.last_updated.desc())
            .limit(limit - len(rows))
        ).all()
        rows.extend(extra)
    return [JobPostingOut.model_validate(r) for r in rows]


@router.get("/{job_id}", response_model=JobPostingOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    cache_key = f"job:{job_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    job = db.scalar(
        select(JobPosting).options(selectinload(JobPosting.company)).where(JobPosting.id == job_id)
    )
    if not job:
        raise HTTPException(404, "Job not found")
    response = JobPostingOut.model_validate(job).model_dump()
    cache_set(cache_key, response)
    return response


@router.get("/{job_id}/related", response_model=list[JobPostingOut])
def related_jobs(job_id: str, db: Session = Depends(get_db), limit: int = 3):
    """Show 'İlgini Çekebilecek İlanlar' on the detail page."""
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    rows = db.scalars(
        select(JobPosting)
        .options(selectinload(JobPosting.company))
        .where((JobPosting.is_active == True))
        .where(JobPosting.id != job_id)
        .where((JobPosting.city == job.city) | (JobPosting.title.ilike(f"%{job.title.split()[0]}%")))
        .order_by(JobPosting.last_updated.desc())
        .limit(limit)
    ).all()
    return [JobPostingOut.model_validate(r) for r in rows]


@router.get("/{job_id}/my-application", response_model=JobApplicationOut)
def my_application(
    job_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Check whether the current user already applied to this job."""
    app = db.scalar(
        select(JobApplication).where(
            JobApplication.job_posting_id == job_id,
            JobApplication.user_id == user["uid"],
        )
    )
    if not app:
        raise HTTPException(404, "No application")
    return app


@router.post("/{job_id}/apply", response_model=JobApplicationOut, status_code=201)
def apply(
    job_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Authenticated user clicks 'Başvur'."""
    job = db.get(JobPosting, job_id)
    if not job or not job.is_active:
        raise HTTPException(404, "Job not found")

    # Prevent duplicate applications
    existing = db.scalar(
        select(JobApplication).where(
            JobApplication.job_posting_id == job_id,
            JobApplication.user_id == user["uid"],
        )
    )
    if existing:
        raise HTTPException(409, "Already applied")

    application = JobApplication(
        job_posting_id=job_id,
        user_id=user["uid"],
        display_name=user.get("name") or user.get("display_name"),
        email=user.get("email"),
    )
    job.application_count += 1
    db.add(application)
    db.commit()
    db.refresh(application)

    # Detail-page count changed → invalidate cache.
    from ..cache import cache_delete_pattern
    cache_delete_pattern(f"job:{job_id}")
    cache_delete_pattern("jobs:list:*")
    return application


# ------------------------------------------------------------------
# Autocomplete (used by the home page search box)
# ------------------------------------------------------------------

@router.get("/autocomplete/positions", response_model=list[str])
def autocomplete_positions(
    q: Annotated[str, Query(min_length=1)],
    db: Session = Depends(get_db),
    limit: int = 8,
):
    cache_key = f"autocomplete:position:{q.lower()}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    rows = db.scalars(
        select(JobPosting.title)
        .where(JobPosting.title.ilike(f"%{q}%"), (JobPosting.is_active == True))
        .distinct()
        .limit(limit)
    ).all()
    cache_set(cache_key, rows, ttl=60 * 30)
    return rows


@router.get("/autocomplete/cities", response_model=list[str])
def autocomplete_cities(
    q: Annotated[str, Query(min_length=1)],
    db: Session = Depends(get_db),
    limit: int = 8,
):
    cache_key = f"autocomplete:city:{q.lower()}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    rows = db.scalars(
        select(JobPosting.city)
        .where(JobPosting.city.ilike(f"%{q}%"), (JobPosting.is_active == True))
        .distinct()
        .limit(limit)
    ).all()
    cache_set(cache_key, rows, ttl=60 * 30)
    return rows
