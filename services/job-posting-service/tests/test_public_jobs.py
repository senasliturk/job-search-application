"""Tests for the public /jobs endpoints.

Seed data (inserted by app startup) includes jobs in İzmir, İstanbul, and
Ankara across different work_preference values — so filters can be asserted
without additional fixtures.
"""
import pytest


# ── GET /api/v1/jobs ─────────────────────────────────────────────────────────

def test_list_jobs_ok(client):
    resp = client.get("/api/v1/jobs")
    assert resp.status_code == 200


def test_list_jobs_response_shape(client):
    data = client.get("/api/v1/jobs").json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "has_next" in data


def test_list_jobs_returns_only_active(client):
    items = client.get("/api/v1/jobs").json()["items"]
    assert len(items) > 0
    assert all(j["is_active"] for j in items), "inactive jobs must not appear"


def test_list_jobs_item_has_required_fields(client):
    item = client.get("/api/v1/jobs").json()["items"][0]
    for field in ("id", "title", "city", "country", "work_preference", "position_level", "company"):
        assert field in item, f"missing field: {field}"


def test_filter_by_city(client):
    items = client.get("/api/v1/jobs?city=İstanbul").json()["items"]
    assert len(items) > 0
    for j in items:
        # Use exact match — Python's .lower() converts Turkish 'İ' to two
        # code-points ('i' + combining dot), so substring checks break.
        assert j["city"] == "İstanbul"


def test_filter_by_work_preference_remote(client):
    items = client.get("/api/v1/jobs?work_preference=remote").json()["items"]
    assert len(items) > 0
    assert all(j["work_preference"] == "remote" for j in items)


def test_filter_by_work_preference_onsite(client):
    items = client.get("/api/v1/jobs?work_preference=onsite").json()["items"]
    assert all(j["work_preference"] == "onsite" for j in items)


def test_pagination_page_size(client):
    resp = client.get("/api/v1/jobs?page=1&page_size=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 2
    assert data["page_size"] == 2


def test_pagination_page_2(client):
    first_page = client.get("/api/v1/jobs?page=1&page_size=2").json()
    second_page = client.get("/api/v1/jobs?page=2&page_size=2").json()
    ids_p1 = {j["id"] for j in first_page["items"]}
    ids_p2 = {j["id"] for j in second_page["items"]}
    assert ids_p1.isdisjoint(ids_p2), "pages must not overlap"


def test_total_is_consistent(client):
    data = client.get("/api/v1/jobs?page_size=100").json()
    assert data["total"] == len(data["items"])  # all on one page


def test_filter_by_title_partial_match(client):
    items = client.get("/api/v1/jobs?title=Developer").json()["items"]
    assert len(items) > 0
    for j in items:
        assert "developer" in j["title"].lower()


# ── GET /api/v1/jobs/{id} ─────────────────────────────────────────────────────

def test_get_job_detail_exists(client):
    all_items = client.get("/api/v1/jobs").json()["items"]
    job_id = all_items[0]["id"]
    resp = client.get(f"/api/v1/jobs/{job_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == job_id


def test_get_job_detail_not_found(client):
    resp = client.get("/api/v1/jobs/nonexistent-id-9999")
    assert resp.status_code == 404
