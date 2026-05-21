from datetime import datetime
from typing import Generic, TypeVar
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    position: str | None = None
    city: str | None = None
    country: str | None = None
    town: str | None = None
    work_preference: str | None = None  # onsite|remote|hybrid
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class StoredSearch(BaseModel):
    id: str
    user_id: str
    query_position: str | None = None
    query_city: str | None = None
    query_country: str | None = None
    filters: dict = {}
    result_count: int
    searched_at: datetime


class JobAlertCreate(BaseModel):
    keywords: list[str] = []
    country: str | None = None
    city: str | None = None
    town: str | None = None
    work_preference: str | None = None


class JobAlertOut(JobAlertCreate):
    id: str
    user_id: str
    active: bool = True
    created_at: datetime
    last_notified_at: datetime | None = None


class NotificationJobRef(BaseModel):
    id: str
    title: str
    city: str = ""


class NotificationOut(BaseModel):
    id: str
    user_id: str
    subject: str
    body: str
    jobs: list[NotificationJobRef] = []
    read: bool = False
    created_at: datetime


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
    has_next: bool
