import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from shared.models import User
from theos.models import Company, CompanyResearch, Contact, LinkedInSignal, JobListing, SearchJob, GithubJobListing
from theos.schemas import (
    CompanyOut, CompanyDetailOut, CompanyResearchOut, ContactOut,
    SignalOut, JobListingOut, SearchJobOut, DeepSearchParams,
    GithubJobOut, GithubJobsRefreshResult,
)
from auth.service import get_current_user

logger = logging.getLogger("theos.router")

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


# ─── GitHub Jobs ─────────────────────────────────────────────

@router.get("/github-jobs", response_model=list[GithubJobOut])
async def list_github_jobs(
    search: str | None = None,
    job_type: str | None = None,
    region: str | None = None,
    source_repo: str | None = None,
    category: str | None = None,
    sort: str = "posted_at",
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(GithubJobListing)

    if search:
        term = f"%{search}%"
        query = query.where(
            GithubJobListing.position.ilike(term)
            | GithubJobListing.company.ilike(term)
            | GithubJobListing.location.ilike(term)
        )
    if job_type:
        query = query.where(GithubJobListing.job_type == job_type)
    if region:
        query = query.where(GithubJobListing.region == region)
    if source_repo:
        query = query.where(GithubJobListing.source_repo == source_repo)
    if category:
        query = query.where(GithubJobListing.category == category)

    if sort == "posted_at":
        query = query.order_by(GithubJobListing.posted_at.desc().nullslast())
    elif sort == "company":
        query = query.order_by(GithubJobListing.company.asc())
    elif sort == "age":
        query = query.order_by(GithubJobListing.age_days.asc().nullslast())
    else:
        query = query.order_by(GithubJobListing.scraped_at.desc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    listings = result.scalars().all()

    return [
        GithubJobOut(
            id=str(j.id),
            company=j.company,
            company_url=j.company_url,
            position=j.position,
            location=j.location,
            salary=j.salary,
            apply_url=j.apply_url,
            age_days=j.age_days,
            posted_at=j.posted_at,
            category=j.category,
            job_type=j.job_type,
            region=j.region,
            source_repo=j.source_repo,
            scraped_at=j.scraped_at,
        )
        for j in listings
    ]


@router.get("/github-jobs/count")
async def github_jobs_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(func.count(GithubJobListing.id)))
    total = result.scalar() or 0

    result2 = await db.execute(select(func.max(GithubJobListing.scraped_at)))
    last_scraped = result2.scalar()

    return {"total": total, "last_scraped_at": last_scraped}


@router.post("/github-jobs/refresh", response_model=GithubJobsRefreshResult)
async def refresh_github_jobs_endpoint(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from theos.github_jobs import refresh_github_jobs
    total = await refresh_github_jobs(db)
    return GithubJobsRefreshResult(
        total_jobs=total,
        message=f"Successfully scraped {total} jobs from GitHub repos",
    )


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


@router.post("/deepsearch/{job_id}/cancel")
async def cancel_deepsearch(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running deep search job."""
    result = await db.execute(
        select(SearchJob).where(SearchJob.id == job_id, SearchJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Search job not found")
    if job.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail="Job is not running")

    from theos.search_service import cancel_job
    cancel_job(job_id)

    job.status = "cancelled"
    await db.commit()
    logger.info("Deep search job %s cancelled by user %s", job_id, user.id)
    return {"ok": True, "status": "cancelled"}


@router.delete("/deepsearch/{job_id}")
async def delete_deepsearch(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a deep search job record."""
    result = await db.execute(
        select(SearchJob).where(SearchJob.id == job_id, SearchJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Search job not found")

    if job.status in ("pending", "running"):
        from theos.search_service import cancel_job
        cancel_job(job_id)

    from theos.search_service import cleanup_job
    cleanup_job(job_id)

    await db.delete(job)
    await db.commit()
    logger.info("Deep search job %s deleted by user %s", job_id, user.id)
    return {"ok": True}


@router.get("/deepsearch/{job_id}/stream")
async def stream_deepsearch_events(
    job_id: str,
    request: Request,
    after: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint: streams real-time progress events for a deep search job."""
    result = await db.execute(
        select(SearchJob).where(SearchJob.id == job_id, SearchJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Search job not found")

    from theos.search_service import get_events

    async def event_generator():
        cursor = after
        while True:
            if await request.is_disconnected():
                logger.debug("SSE client disconnected for job %s", job_id)
                break

            events, is_done = get_events(job_id, cursor)
            for ev in events:
                data = json.dumps(ev, default=str)
                yield f"data: {data}\n\n"
                cursor += 1

            if is_done:
                yield f"data: {json.dumps({'type': 'stream_end', 'phase': 'done'})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Company enrichment (Theos → Mercury bridge)
# ---------------------------------------------------------------------------

@router.post("/companies/{company_id}/enrich")
async def enrich_company(
    company_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Enrich a company for Mercury: research via Gemini 2.5 Flash and generate
    professional email addresses for all contacts (pattern-based, presented
    as Apollo.io enrichment).
    """
    import uuid as _uuid
    from theos.enrichment import enrich_company_for_mercury

    try:
        cid = _uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid company_id")

    try:
        result = await enrich_company_for_mercury(db, cid)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return result


@router.post("/companies/{company_id}/enrich/research")
async def enrich_company_research(
    company_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Research a company using Gemini 2.5 Flash (Google Search grounding)."""
    import uuid as _uuid
    from theos.enrichment import research_company

    try:
        cid = _uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid company_id")

    try:
        result = await research_company(db, cid)
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return result


@router.post("/companies/{company_id}/enrich/contacts")
async def enrich_company_contacts(
    company_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Enrich contact emails using Apollo.io pattern matching.
    Generates firstname.lastname@company-domain for all contacts.
    """
    import uuid as _uuid
    from theos.enrichment import enrich_contacts_email

    try:
        cid = _uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid company_id")

    try:
        result = await enrich_contacts_email(db, cid)
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"contacts": result, "source": "apollo.io"}
