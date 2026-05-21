"""Relational data model for Job Postings.

Mirrors the ER diagram in /docs/er-diagram.md.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), index=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    postings: Mapped[list["JobPosting"]] = relationship(back_populates="company")


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), index=True)

    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(String(4000))

    country: Mapped[str] = mapped_column(String(100), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    town: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    work_preference: Mapped[str] = mapped_column(String(20), index=True)  # onsite/remote/hybrid
    position_level: Mapped[str] = mapped_column(String(20), index=True)   # junior/mid/senior/expert
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)

    min_salary: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_salary: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    application_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_updated: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    company: Mapped[Company] = relationship(back_populates="postings")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_posting_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_postings.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)  # Firebase UID
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), default="submitted")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)  # Firebase UID
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    school: Mapped[str | None] = mapped_column(String(300), nullable=True)
    department: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cv_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    education_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # student/graduate/no_degree
    class_year: Mapped[str | None] = mapped_column(String(20), nullable=True)  # prep/year_1/.../year_5
    experience_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # new_grad/junior/mid/senior
