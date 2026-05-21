"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Generic, Literal, TypeVar
from pydantic import BaseModel, ConfigDict, Field

WorkPreference = Literal["onsite", "remote", "hybrid"]
PositionLevel = Literal["junior", "mid", "senior", "expert"]


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    logo_url: str | None = None
    website: str | None = None


class JobPostingBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=10, max_length=4000)
    country: str
    city: str
    town: str | None = None
    work_preference: WorkPreference
    position_level: PositionLevel
    department: str | None = None
    min_salary: float | None = None
    max_salary: float | None = None


class JobPostingCreate(JobPostingBase):
    company_id: str


class JobPostingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    country: str | None = None
    city: str | None = None
    town: str | None = None
    work_preference: WorkPreference | None = None
    position_level: PositionLevel | None = None
    department: str | None = None
    min_salary: float | None = None
    max_salary: float | None = None
    is_active: bool | None = None


class JobPostingOut(JobPostingBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company: CompanyOut
    application_count: int
    is_active: bool
    created_at: datetime
    last_updated: datetime


class JobApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_posting_id: str
    user_id: str
    display_name: str | None = None
    email: str | None = None
    status: str
    applied_at: datetime


class UserProfileIn(BaseModel):
    school: str | None = None
    department: str | None = None
    education_status: str | None = None
    class_year: str | None = None
    experience_level: str | None = None


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: str
    display_name: str | None = None
    email: str | None = None
    school: str | None = None
    department: str | None = None
    cv_filename: str | None = None
    education_status: str | None = None
    class_year: str | None = None
    experience_level: str | None = None


class CompanyUpdate(BaseModel):
    logo_url: str | None = None
    website: str | None = None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Generic paginated response — required by COMMON REQUIREMENTS."""
    items: list[T]
    page: int
    page_size: int
    total: int
    has_next: bool
