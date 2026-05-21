"""Seeds the DB with a handful of demo postings so screens have data on first run."""
from __future__ import annotations

import logging

from sqlalchemy import select

from .database import db_session, engine, Base
from .models import Company, JobPosting

log = logging.getLogger(__name__)

DEMO_COMPANIES = [
    {"name": "Alfemo", "logo_url": None, "website": "https://alfemo.com.tr"},
    {"name": "Packy Packaging", "logo_url": None, "website": None},
    {"name": "Datasist", "logo_url": None, "website": None},
    {"name": "VIGO Teknoloji", "logo_url": None, "website": None},
]

DEMO_JOBS = [
    {
        "title": "Yazılım Uzmanı",
        "description": "Bilgisayar Mühendisliği mezunu, .NET / C# / SQL Server deneyimi olan adaylar aranmaktadır.",
        "country": "Türkiye", "city": "İzmir", "town": "Torbalı",
        "work_preference": "onsite", "position_level": "expert", "department": "Bilgi Teknolojileri / IT",
        "company": "Alfemo",
    },
    {
        "title": "Canias Yazılım Uzmanı",
        "description": "Canias ERP modülleri üzerinde geliştirme yapacak yazılım uzmanı.",
        "country": "Türkiye", "city": "İzmir", "town": None,
        "work_preference": "onsite", "position_level": "mid", "department": "IT",
        "company": "Packy Packaging",
    },
    {
        "title": "Backend Developer - Node.Js",
        "description": "Node.js / TypeScript ile mikroservis geliştirme. AWS ve Docker bilgisi tercih sebebidir.",
        "country": "Türkiye", "city": "İstanbul", "town": "Asya",
        "work_preference": "hybrid", "position_level": "senior", "department": "IT",
        "company": "VIGO Teknoloji",
    },
    {
        "title": "Frontend Developer",
        "description": "React, TypeScript, modern JS component kütüphaneleri.",
        "country": "Türkiye", "city": "İstanbul", "town": None,
        "work_preference": "remote", "position_level": "mid", "department": "IT",
        "company": "Datasist",
    },
    {
        "title": "Full Stack Developer",
        "description": "End-to-end ürün geliştirme. React + Python/FastAPI, Azure tecrübesi.",
        "country": "Türkiye", "city": "İzmir", "town": None,
        "work_preference": "remote", "position_level": "senior", "department": "IT",
        "company": "Alfemo",
    },
    {
        "title": "Web Developer",
        "description": "HTML5, CSS3, JS, jQuery, REST API entegrasyonu.",
        "country": "Türkiye", "city": "İzmir", "town": None,
        "work_preference": "onsite", "position_level": "junior", "department": "IT",
        "company": "Packy Packaging",
    },
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with db_session() as db:
        if db.scalar(select(JobPosting).limit(1)):
            log.info("Seed: data already present, skipping.")
            return
        company_lookup: dict[str, Company] = {}
        for c in DEMO_COMPANIES:
            company = Company(**c)
            db.add(company)
            db.flush()
            company_lookup[c["name"]] = company
        for j in DEMO_JOBS:
            cname = j.pop("company")
            db.add(JobPosting(company_id=company_lookup[cname].id, **j))
        db.commit()
        log.info("Seed: inserted %d companies and %d job postings.", len(DEMO_COMPANIES), len(DEMO_JOBS))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
