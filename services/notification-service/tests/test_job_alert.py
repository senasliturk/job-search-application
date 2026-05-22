"""Unit tests for job alert matching logic.

These are pure-Python tests — no database, no HTTP, no queue connection needed.
They verify that _norm() and _matches() handle Turkish characters correctly and
that alert filter combinations work as expected.
"""
import pytest
from app.jobs.job_alert_task import _matches, _norm


# ── _norm ─────────────────────────────────────────────────────────────────────

def test_norm_lowercases_ascii():
    assert _norm("Hello WORLD") == "hello world"


def test_norm_strips_whitespace():
    assert _norm("  İzmir  ") == "izmir"


def test_norm_turkish_capital_i():
    """Turkish 'İ' (dotted capital I) must normalize to 'i', not 'i̇'."""
    assert _norm("İzmir") == "izmir"


def test_norm_turkish_lowercase_i():
    """Turkish 'ı' (dotless i) must normalize to 'i'."""
    assert _norm("ışık") == "isik"


def test_norm_turkish_c_cedilla():
    assert _norm("Çankaya") == "cankaya"


def test_norm_turkish_s_cedilla():
    assert _norm("Şişli") == "sisli"


def test_norm_turkish_u_umlaut():
    assert _norm("Üsküdar") == "uskudar"


def test_norm_turkish_o_umlaut():
    assert _norm("Öğrenci") == "ogrenci"


def test_norm_turkish_g_breve():
    assert _norm("Ağrı") == "agri"


def test_norm_none_returns_empty():
    assert _norm(None) == ""


def test_norm_empty_string():
    assert _norm("") == ""


def test_norm_mixed_sentence():
    assert _norm("İstanbul Şişli") == "istanbul sisli"


# ── _matches ──────────────────────────────────────────────────────────────────

def test_matches_empty_alert_matches_any_job():
    """An alert with no filters should match every job."""
    alert = {}
    job = {"title": "Java Developer", "city": "Ankara", "work_preference": "onsite"}
    assert _matches(alert, job) is True


def test_matches_city_exact():
    alert = {"city": "İzmir"}
    job = {"title": "Developer", "city": "İzmir", "work_preference": "remote"}
    assert _matches(alert, job) is True


def test_matches_city_no_match():
    alert = {"city": "İzmir"}
    job = {"title": "Developer", "city": "İstanbul", "work_preference": "remote"}
    assert _matches(alert, job) is False


def test_matches_city_turkish_normalization():
    """Alert stores 'İzmir' (with Turkish İ); job stores 'Izmir' (ASCII I).
    The matcher must treat them as equal.
    """
    alert = {"city": "İzmir"}
    job = {"title": "Developer", "city": "Izmir", "work_preference": "remote"}
    assert _matches(alert, job) is True


def test_matches_city_normalization_reverse():
    """Reversed: alert has ASCII 'Izmir', job has Turkish 'İzmir'."""
    alert = {"city": "Izmir"}
    job = {"title": "Developer", "city": "İzmir", "work_preference": "remote"}
    assert _matches(alert, job) is True


def test_matches_country_filter():
    alert = {"country": "Türkiye"}
    job_match = {"title": "Dev", "city": "İzmir", "country": "Türkiye"}
    job_no_match = {"title": "Dev", "city": "Berlin", "country": "Germany"}
    assert _matches(alert, job_match) is True
    assert _matches(alert, job_no_match) is False


def test_matches_town_filter():
    alert = {"town": "Bornova"}
    job_match = {"title": "Dev", "city": "İzmir", "town": "Bornova"}
    job_no_match = {"title": "Dev", "city": "İzmir", "town": "Karşıyaka"}
    assert _matches(alert, job_match) is True
    assert _matches(alert, job_no_match) is False


def test_matches_work_preference_match():
    alert = {"work_preference": "remote"}
    job = {"title": "Developer", "city": "İzmir", "work_preference": "remote"}
    assert _matches(alert, job) is True


def test_matches_work_preference_no_match():
    alert = {"work_preference": "remote"}
    job = {"title": "Developer", "city": "İzmir", "work_preference": "onsite"}
    assert _matches(alert, job) is False


def test_matches_keyword_in_title():
    alert = {"keywords": ["Python"]}
    job_match = {"title": "Senior Python Developer", "city": "İzmir"}
    job_no_match = {"title": "Java Backend Engineer", "city": "İzmir"}
    assert _matches(alert, job_match) is True
    assert _matches(alert, job_no_match) is False


def test_matches_keyword_case_insensitive():
    alert = {"keywords": ["python"]}
    job = {"title": "Python Developer", "city": "İzmir"}
    assert _matches(alert, job) is True


def test_matches_keyword_turkish_normalization():
    """Keyword 'yazılım' should match title 'Yazilim Uzmani'."""
    alert = {"keywords": ["yazılım"]}
    job = {"title": "Yazilim Uzmani", "city": "İzmir"}
    assert _matches(alert, job) is True


def test_matches_multiple_keywords_any_match():
    """If any keyword matches the title, the alert is satisfied."""
    alert = {"keywords": ["Python", "Django"]}
    job_python = {"title": "Python Developer", "city": "İzmir"}
    job_django = {"title": "Django Backend Developer", "city": "İzmir"}
    job_java = {"title": "Java Developer", "city": "İzmir"}
    assert _matches(alert, job_python) is True
    assert _matches(alert, job_django) is True
    assert _matches(alert, job_java) is False


def test_matches_combined_city_and_keyword():
    alert = {"city": "İzmir", "keywords": ["Python"]}
    job_both = {"title": "Python Developer", "city": "İzmir"}
    job_wrong_city = {"title": "Python Developer", "city": "İstanbul"}
    job_wrong_kw = {"title": "Java Developer", "city": "İzmir"}
    assert _matches(alert, job_both) is True
    assert _matches(alert, job_wrong_city) is False
    assert _matches(alert, job_wrong_kw) is False


def test_matches_combined_city_work_pref_keyword():
    alert = {"city": "İzmir", "work_preference": "remote", "keywords": ["Backend"]}
    job = {
        "title": "Backend Developer",
        "city": "Izmir",        # ASCII I — must normalize
        "work_preference": "remote",
    }
    assert _matches(alert, job) is True
