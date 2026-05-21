"""Companies routes (admins use this to register their company once)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Company
from ..schemas import CompanyOut, CompanyUpdate

router = APIRouter(prefix="/admin/companies", tags=["admin-companies"])


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(
    name: str,
    logo_url: str | None = None,
    website: str | None = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    company = Company(name=name, logo_url=logo_url, website=website)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    return db.scalars(select(Company).order_by(Company.name)).all()


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return company


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str,
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    if body.logo_url is not None:
        company.logo_url = body.logo_url.strip() or None
    if body.website is not None:
        company.website = body.website.strip() or None
    db.commit()
    db.refresh(company)
    return company
