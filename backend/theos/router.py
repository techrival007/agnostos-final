import asyncio

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from shared.models import User
from theos.models import Company, CompanyResearch, Contact, LinkedInSignal, JobListing, SearchJob
from theos.schemas import (
    CompanyOut, CompanyDetailOut, CompanyResearchOut, ContactOut,
    SignalOut, JobListingOut, SearchJobOut, DeepSearchParams,
)
from auth.service import get_current_user

router = APIRouter(prefix="/api/theos", tags=["theos"])


@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(
    stage: str | None = None,
    sector: str | None = None,
    source: str | None = None,
    hiring_score_min: int = 0,
    sort: str = "hiring_score",
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Company)

    if stage:
        query = query.where(Company.stage == stage)
    if source:
        query = query.where(Company.source == source)
    if hiring_score_min > 0:
        query = query.where(Company.hiring_score >= hiring_score_min)
    if sector:
        query = query.where(Company.sector.any(sector))

    if sort == "hiring_score":
        query = query.order_by(Company.hiring_score.desc())
    elif sort == "funding_date":
        query = query.order_by(Company.funding_date.desc().nullslast())
    else:
        query = query.order_by(Company.created_at.desc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    companies = result.scalars().all()

    out = []
    for c in companies:
        contact_count = await db.execute(
            select(func.count(Contact.id)).where(Contact.company_id == c.id)
        )
        out.append(CompanyOut(
            id=str(c.id), name=c.name, website=c.website, linkedin_url=c.linkedin_url,
            stage=c.stage, funding_amount_usd=c.funding_amount_usd, funding_date=c.funding_date,
            investors=c.investors, sector=c.sector, hq_location=c.hq_location,
            headcount=c.headcount, tech_stack=c.tech_stack, hiring_score=c.hiring_score,
            research_summary=c.research_summary, source=c.source, source_batch=c.source_batch,
            contact_count=contact_count.scalar() or 0, created_at=c.created_at,
        ))
    return out


@router.get("/companies/{company_id}", response_model=CompanyDetailOut)
async def get_company_detail(
    company_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    research_result = await db.execute(
        select(CompanyResearch).where(CompanyResearch.company_id == company.id)
    )
    research = research_result.scalar_one_or_none()

    contacts_result = await db.execute(
        select(Contact).where(Contact.company_id == company.id)
    )
    contacts = contacts_result.scalars().all()

    contact_count = len(contacts)

    return CompanyDetailOut(
        company=CompanyOut(
            id=str(company.id), name=company.name, website=company.website,
            linkedin_url=company.linkedin_url, stage=company.stage,
            funding_amount_usd=company.funding_amount_usd, funding_date=company.funding_date,
            investors=company.investors, sector=company.sector, hq_location=company.hq_location,
            headcount=company.headcount, tech_stack=company.tech_stack,
            hiring_score=company.hiring_score, research_summary=company.research_summary,
            source=company.source, source_batch=company.source_batch,
            contact_count=contact_count, created_at=company.created_at,
        ),
        research=CompanyResearchOut(
            recent_news=research.recent_news if research else None,
            blog_posts=research.blog_posts if research else None,
            founder_posts=research.founder_posts if research else None,
            product_updates=research.product_updates if research else None,
            job_postings=research.job_postings if research else None,
        ) if research else None,
        contacts=[
            ContactOut(
                id=str(c.id), name=c.name, role=c.role, seniority=c.seniority,
                linkedin_url=c.linkedin_url, professional_email=c.professional_email,
                personal_email=c.personal_email, email_confidence_score=c.email_confidence_score,
                is_new_recruit=c.is_new_recruit, tenure_months=c.tenure_months,
                is_founder=c.is_founder, recent_posts=c.recent_posts,
            ) for c in contacts
        ],
    )


@router.get("/signals", response_model=list[SignalOut])
async def list_signals(
    signal_type: str | None = None,
    resolved: bool | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(LinkedInSignal).order_by(LinkedInSignal.detected_at.desc())

    if signal_type:
        query = query.where(LinkedInSignal.signal_type == signal_type)
    if resolved is not None:
        query = query.where(LinkedInSignal.resolved == resolved)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    signals = result.scalars().all()

    out = []
    for s in signals:
        company_name = None
        if s.company_id:
            cr = await db.execute(select(Company.name).where(Company.id == s.company_id))
            company_name = cr.scalar_one_or_none()

        out.append(SignalOut(
            id=str(s.id), post_url=s.post_url, post_content=s.post_content,
            author_name=s.author_name, author_linkedin=s.author_linkedin,
            signal_type=s.signal_type, company_name=company_name,
            company_id=str(s.company_id) if s.company_id else None,
            resolved=s.resolved, detected_at=s.detected_at,
        ))
    return out


@router.get("/listings", response_model=list[JobListingOut])
async def list_job_listings(
    location: str | None = None,
    employment_type: str | None = None,
    remote_ok: bool | None = None,
    source: str | None = None,
    search: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(JobListing).where(JobListing.is_active == True)

    if location:
        query = query.where(JobListing.location.ilike(f"%{location}%"))
    if employment_type:
        query = query.where(JobListing.employment_type == employment_type)
    if remote_ok is not None:
        query = query.where(JobListing.remote_ok == remote_ok)
    if source:
        query = query.where(JobListing.source == source)
    if search:
        query = query.where(JobListing.title.ilike(f"%{search}%"))

    query = query.order_by(JobListing.posted_at.desc().nullslast()).offset(offset).limit(limit)
    result = await db.execute(query)
    listings = result.scalars().all()

    out = []
    for l in listings:
        company_name = None
        if l.company_id:
            cr = await db.execute(select(Company.name).where(Company.id == l.company_id))
            company_name = cr.scalar_one_or_none()

        out.append(JobListingOut(
            id=str(l.id), title=l.title, url=l.url, description=l.description,
            location=l.location, employment_type=l.employment_type,
            remote_ok=l.remote_ok, source=l.source, posted_at=l.posted_at,
            company_name=company_name,
        ))
    return out


# ─── Deep Search ─────────────────────────────────────────────

@router.post("/deepsearch/start", response_model=SearchJobOut)
async def start_deepsearch(
    params: DeepSearchParams,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = SearchJob(
        user_id=user.id,
        status="pending",
        parameters=params.model_dump(),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from theos.search_service import run_deepsearch
    background_tasks.add_task(_run_in_loop, run_deepsearch, job.id, user.id, params.model_dump())

    return SearchJobOut(
        id=str(job.id),
        status=job.status,
        parameters=job.parameters,
        companies_found=job.companies_found,
        created_at=job.created_at,
    )


async def _run_in_loop(coro_fn, *args):
    """Run an async function inside a new event loop for BackgroundTasks."""
    await coro_fn(*args)


@router.get("/deepsearch/{job_id}/status", response_model=SearchJobOut)
async def get_deepsearch_status(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchJob).where(SearchJob.id == job_id, SearchJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Search job not found")
    return SearchJobOut(
        id=str(job.id),
        status=job.status,
        parameters=job.parameters,
        result_summary=job.result_summary,
        companies_found=job.companies_found,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.get("/deepsearch/history", response_model=list[SearchJobOut])
async def list_deepsearch_jobs(
    limit: int = Query(default=20, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchJob)
        .where(SearchJob.user_id == user.id)
        .order_by(SearchJob.created_at.desc())
        .limit(limit)
    )
    jobs = result.scalars().all()
    return [
        SearchJobOut(
            id=str(j.id),
            status=j.status,
            parameters=j.parameters,
            result_summary=j.result_summary,
            companies_found=j.companies_found,
            error_message=j.error_message,
            created_at=j.created_at,
            completed_at=j.completed_at,
        )
        for j in jobs
    ]
