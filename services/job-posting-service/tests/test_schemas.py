"""Unit tests for Pydantic request/response schemas.

No database or HTTP needed — pure validation logic.
"""
import pytest
from pydantic import ValidationError

from app.schemas import JobPostingBase, JobPostingCreate, JobPostingUpdate


# ── Valid construction ────────────────────────────────────────────────────────

def test_valid_job_posting_base():
    job = JobPostingBase(
        title="Python Developer",
        description="Great opportunity for a senior Python developer.",
        country="Türkiye",
        city="İzmir",
        work_preference="remote",
        position_level="junior",
    )
    assert job.title == "Python Developer"
    assert job.work_preference == "remote"
    assert job.position_level == "junior"
    assert job.town is None
    assert job.min_salary is None


def test_valid_job_posting_with_optional_fields():
    job = JobPostingBase(
        title="Backend Engineer",
        description="Building scalable backend services for our platform.",
        country="Türkiye",
        city="İstanbul",
        town="Kadıköy",
        work_preference="hybrid",
        position_level="senior",
        department="Engineering",
        min_salary=50000.0,
        max_salary=80000.0,
    )
    assert job.town == "Kadıköy"
    assert job.min_salary == 50000.0
    assert job.department == "Engineering"


def test_valid_job_posting_create():
    job = JobPostingCreate(
        title="Frontend Developer",
        description="React and TypeScript experience required for this role.",
        country="Türkiye",
        city="Ankara",
        work_preference="onsite",
        position_level="mid",
        company_id="some-company-uuid",
    )
    assert job.company_id == "some-company-uuid"


# ── Title validation ──────────────────────────────────────────────────────────

def test_title_too_short_raises():
    with pytest.raises(ValidationError) as exc_info:
        JobPostingBase(
            title="A",  # min_length=2
            description="Valid description here for testing.",
            country="Türkiye",
            city="İzmir",
            work_preference="remote",
            position_level="junior",
        )
    assert "title" in str(exc_info.value)


def test_title_too_long_raises():
    with pytest.raises(ValidationError):
        JobPostingBase(
            title="X" * 201,  # max_length=200
            description="Valid description here for testing.",
            country="Türkiye",
            city="İzmir",
            work_preference="remote",
            position_level="junior",
        )


def test_title_min_length_boundary_ok():
    job = JobPostingBase(
        title="AB",  # exactly 2 chars — min boundary
        description="Valid description here for testing.",
        country="Türkiye",
        city="İzmir",
        work_preference="remote",
        position_level="junior",
    )
    assert job.title == "AB"


# ── Description validation ────────────────────────────────────────────────────

def test_description_too_short_raises():
    with pytest.raises(ValidationError) as exc_info:
        JobPostingBase(
            title="Valid Title",
            description="Short",  # min_length=10
            country="Türkiye",
            city="İzmir",
            work_preference="remote",
            position_level="junior",
        )
    assert "description" in str(exc_info.value)


# ── work_preference enum ──────────────────────────────────────────────────────

@pytest.mark.parametrize("pref", ["onsite", "remote", "hybrid"])
def test_valid_work_preferences(pref):
    job = JobPostingBase(
        title="Some Job",
        description="A valid description for this test case.",
        country="Türkiye",
        city="İzmir",
        work_preference=pref,
        position_level="junior",
    )
    assert job.work_preference == pref


def test_invalid_work_preference_raises():
    with pytest.raises(ValidationError):
        JobPostingBase(
            title="Some Job",
            description="A valid description for this test case.",
            country="Türkiye",
            city="İzmir",
            work_preference="flying",  # not a valid literal
            position_level="junior",
        )


# ── position_level enum ───────────────────────────────────────────────────────

@pytest.mark.parametrize("level", ["junior", "mid", "senior", "expert"])
def test_valid_position_levels(level):
    job = JobPostingBase(
        title="Some Job",
        description="A valid description for this test case.",
        country="Türkiye",
        city="İzmir",
        work_preference="remote",
        position_level=level,
    )
    assert job.position_level == level


def test_invalid_position_level_raises():
    with pytest.raises(ValidationError):
        JobPostingBase(
            title="Some Job",
            description="A valid description for this test case.",
            country="Türkiye",
            city="İzmir",
            work_preference="remote",
            position_level="intern",  # not a valid literal
        )


# ── JobPostingUpdate (all optional) ──────────────────────────────────────────

def test_update_schema_all_none():
    update = JobPostingUpdate()
    assert update.title is None
    assert update.work_preference is None
    assert update.is_active is None


def test_update_schema_partial():
    update = JobPostingUpdate(title="New Title", is_active=False)
    assert update.title == "New Title"
    assert update.is_active is False
    assert update.city is None
