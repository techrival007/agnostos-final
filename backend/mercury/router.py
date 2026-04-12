from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from database import get_db
from shared.models import User
from mercury.models import Campaign, OutreachEmail, FollowupSchedule
from theos.models import Company, Contact
from mercury.schemas import (
    CampaignCreate, CampaignOut, CampaignDetailOut, EmailOut, EmailUpdate,
    FollowupOut, PipelineColumn, PipelineCard,
    ContactEmailStatus, SingleContactDraftRequest,
)
from theos.schemas import CompanyOut
from auth.service import get_current_user
from config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/mercury", tags=["mercury"])

PIPELINE_COLUMNS = [
    {"status": "draft", "label": "Draft Ready"},
    {"status": "approved", "label": "Approved"},
    {"status": "sent", "label": "Sent"},
    {"status": "opened", "label": "Opened"},
    {"status": "replied", "label": "Replied"},
    {"status": "bounced", "label": "Bounced"},
    {"status": "skipped", "label": "Skipped"},
]


async def _build_campaign_out(campaign: Campaign, db: AsyncSession) -> CampaignOut:
    company = await db.execute(select(Company.name).where(Company.id == campaign.company_id))
    company_name = company.scalar_one_or_none()

    email_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.campaign_id == campaign.id)
    )
    emails = email_result.scalars().all()

    return CampaignOut(
        id=str(campaign.id), company_id=str(campaign.company_id),
        company_name=company_name, status=campaign.status,
        tone_settings=campaign.tone_settings, created_at=campaign.created_at,
        last_activity_at=campaign.last_activity_at, next_followup_at=campaign.next_followup_at,
        email_count=len(emails),
        draft_count=len([e for e in emails if e.status == "draft"]),
        sent_count=len([e for e in emails if e.status == "sent"]),
        opened_count=len([e for e in emails if e.status == "opened"]),
        replied_count=len([e for e in emails if e.status == "replied"]),
    )


async def _build_email_out(email: OutreachEmail, db: AsyncSession) -> EmailOut:
    contact = await db.execute(select(Contact).where(Contact.id == email.contact_id))
    c = contact.scalar_one_or_none()
    return EmailOut(
        id=str(email.id), campaign_id=str(email.campaign_id),
        contact_id=str(email.contact_id),
        contact_name=c.name if c else None,
        contact_role=c.role if c else None,
        contact_email=c.professional_email if c else None,
        contact_is_founder=c.is_founder if c else False,
        contact_is_new_recruit=c.is_new_recruit if c else False,
        subject=email.subject, body=email.body,
        subject_options=email.subject_options, tone_settings=email.tone_settings,
        relevance_score=email.relevance_score, relevant_projects=email.relevant_projects,
        hook_used=email.hook_used, status=email.status,
        followup_number=email.followup_number,
        sent_at=email.sent_at, opened_at=email.opened_at,
        replied_at=email.replied_at, created_at=email.created_at,
    )


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    status: str | None = None,
    limit: int = Query(default=20, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign).where(Campaign.user_id == user.id)
    if status:
        query = query.where(Campaign.status == status)
    query = query.order_by(Campaign.created_at.desc()).limit(limit)

    result = await db.execute(query)
    campaigns = result.scalars().all()
    return [await _build_campaign_out(c, db) for c in campaigns]


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetailOut)
async def get_campaign_detail(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    emails_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.campaign_id == campaign.id)
    )
    emails = emails_result.scalars().all()

    company_result = await db.execute(select(Company).where(Company.id == campaign.company_id))
    company = company_result.scalar_one_or_none()

    campaign_out = await _build_campaign_out(campaign, db)
    emails_out = [await _build_email_out(e, db) for e in emails]

    company_out = None
    if company:
        contact_count = await db.execute(
            select(func.count(Contact.id)).where(Contact.company_id == company.id)
        )
        company_out = CompanyOut(
            id=str(company.id), name=company.name, website=company.website,
            stage=company.stage, hiring_score=company.hiring_score,
            tech_stack=company.tech_stack, research_summary=company.research_summary,
            contact_count=contact_count.scalar() or 0,
        )

    return CampaignDetailOut(campaign=campaign_out, emails=emails_out, company=company_out)


@router.post("/campaigns", response_model=CampaignDetailOut, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a campaign for a company and generate AI-written draft emails
    for every contact that has a known email address.
    Uses Adam profile (proof points, projects, experience) + Theos research
    (job postings, news, tech stack) to personalise each draft.
    """
    import uuid as _uuid
    from mercury.service import create_campaign_with_drafts

    try:
        company_uuid = _uuid.UUID(body.company_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid company_id UUID")

    try:
        campaign, drafts = await create_campaign_with_drafts(
            db=db,
            user=user,
            company_id=company_uuid,
            tone_settings=body.tone_settings,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    emails_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.campaign_id == campaign.id)
    )
    all_emails = emails_result.scalars().all()

    company_result = await db.execute(select(Company).where(Company.id == campaign.company_id))
    company_obj = company_result.scalar_one_or_none()

    campaign_out = await _build_campaign_out(campaign, db)
    emails_out = [await _build_email_out(e, db) for e in all_emails]

    company_out = None
    if company_obj:
        contact_count = await db.execute(
            select(func.count(Contact.id)).where(Contact.company_id == company_obj.id)
        )
        company_out = CompanyOut(
            id=str(company_obj.id), name=company_obj.name, website=company_obj.website,
            stage=company_obj.stage, hiring_score=company_obj.hiring_score,
            tech_stack=company_obj.tech_stack, research_summary=company_obj.research_summary,
            contact_count=contact_count.scalar() or 0,
        )

    return CampaignDetailOut(campaign=campaign_out, emails=emails_out, company=company_out)


@router.get("/status/company/{company_id}", response_model=list[ContactEmailStatus])
async def get_contact_email_statuses(
    company_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return Mercury email status for every contact at a company.
    Allows the company detail page to show per-contact outreach state.
    """
    campaign_result = await db.execute(
        select(Campaign).where(
            Campaign.user_id == user.id,
            Campaign.company_id == company_id,
        )
    )
    campaign = campaign_result.scalar_one_or_none()

    contacts_result = await db.execute(
        select(Contact.id).where(Contact.company_id == company_id)
    )
    contact_ids = [cid for (cid,) in contacts_result.all()]

    if not campaign or not contact_ids:
        return [ContactEmailStatus(contact_id=str(cid)) for cid in contact_ids]

    emails_result = await db.execute(
        select(OutreachEmail).where(
            OutreachEmail.campaign_id == campaign.id,
            OutreachEmail.contact_id.in_(contact_ids),
            OutreachEmail.followup_number == 0,
        )
    )
    emails_by_contact = {str(e.contact_id): e for e in emails_result.scalars().all()}

    out: list[ContactEmailStatus] = []
    for cid in contact_ids:
        e = emails_by_contact.get(str(cid))
        if e:
            out.append(ContactEmailStatus(
                contact_id=str(cid),
                email_id=str(e.id),
                campaign_id=str(e.campaign_id),
                status=e.status,
                subject=e.subject,
                body=e.body,
                subject_options=e.subject_options,
                relevance_score=e.relevance_score,
                hook_used=e.hook_used,
                sent_at=e.sent_at,
                opened_at=e.opened_at,
                replied_at=e.replied_at,
            ))
        else:
            out.append(ContactEmailStatus(contact_id=str(cid)))
    return out


@router.post("/draft/contact", response_model=ContactEmailStatus, status_code=201)
async def generate_draft_for_contact(
    body: SingleContactDraftRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a Mercury draft email for a single contact.
    Creates the campaign for the company if one doesn't exist yet.
    """
    import uuid as _uuid
    from mercury.service import _get_or_create_campaign, _generate_email_for_contact
    from adam.models import UserProfile
    from theos.models import CompanyResearch

    try:
        company_uuid = _uuid.UUID(body.company_id)
        contact_uuid = _uuid.UUID(body.contact_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="Complete onboarding first.")

    company = await db.get(Company, company_uuid)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    contact = await db.get(Contact, contact_uuid)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if not contact.professional_email and not contact.personal_email:
        raise HTTPException(status_code=400, detail="Contact has no email — enrich first")

    research_result = await db.execute(
        select(CompanyResearch).where(CompanyResearch.company_id == company_uuid)
    )
    research = research_result.scalar_one_or_none()

    campaign, _ = await _get_or_create_campaign(db, user.id, company_uuid, body.tone_settings)

    email = await _generate_email_for_contact(
        db, user, profile, campaign, contact, company, research
    )

    if not email:
        existing = await db.execute(
            select(OutreachEmail).where(
                OutreachEmail.campaign_id == campaign.id,
                OutreachEmail.contact_id == contact_uuid,
                OutreachEmail.followup_number == 0,
            )
        )
        email = existing.scalar_one_or_none()

    await db.commit()

    if not email:
        raise HTTPException(status_code=500, detail="Could not generate draft")

    return ContactEmailStatus(
        contact_id=str(contact.id),
        email_id=str(email.id),
        campaign_id=str(email.campaign_id),
        status=email.status,
        subject=email.subject,
        body=email.body,
        subject_options=email.subject_options,
        relevance_score=email.relevance_score,
        hook_used=email.hook_used,
        sent_at=email.sent_at,
        opened_at=email.opened_at,
        replied_at=email.replied_at,
    )


@router.post("/emails/{email_id}/approve")
async def approve_email(
    email_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(OutreachEmail).where(OutreachEmail.id == email_id).values(status="approved")
    )
    await db.commit()
    return {"status": "approved"}


@router.post("/emails/{email_id}/skip")
async def skip_email(
    email_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(OutreachEmail).where(OutreachEmail.id == email_id).values(status="skipped")
    )
    await db.commit()
    return {"status": "skipped"}


@router.patch("/emails/{email_id}", response_model=EmailOut)
async def update_email(
    email_id: str,
    updates: EmailUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    values = {k: v for k, v in updates.model_dump().items() if v is not None}
    if values:
        await db.execute(
            update(OutreachEmail).where(OutreachEmail.id == email_id).values(**values)
        )
        await db.commit()

    result = await db.execute(select(OutreachEmail).where(OutreachEmail.id == email_id))
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return await _build_email_out(email, db)


@router.get("/pipeline", response_model=list[PipelineColumn])
async def get_pipeline(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns_result = await db.execute(
        select(Campaign).where(Campaign.user_id == user.id)
    )
    campaign_ids = [c.id for c in campaigns_result.scalars().all()]

    if not campaign_ids:
        return [PipelineColumn(status=col["status"], label=col["label"]) for col in PIPELINE_COLUMNS]

    emails_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.campaign_id.in_(campaign_ids))
    )
    emails = emails_result.scalars().all()

    columns = []
    for col in PIPELINE_COLUMNS:
        col_emails = [e for e in emails if e.status == col["status"]]
        cards = []
        for e in col_emails:
            contact = await db.execute(select(Contact).where(Contact.id == e.contact_id))
            c = contact.scalar_one_or_none()
            campaign = await db.execute(select(Campaign).where(Campaign.id == e.campaign_id))
            camp = campaign.scalar_one_or_none()
            company_name = ""
            if camp:
                cn = await db.execute(select(Company.name).where(Company.id == camp.company_id))
                company_name = cn.scalar_one_or_none() or ""

            followup_result = await db.execute(
                select(FollowupSchedule)
                .where(FollowupSchedule.outreach_email_id == e.id, FollowupSchedule.status == "pending")
                .order_by(FollowupSchedule.scheduled_for)
                .limit(1)
            )
            next_fu = followup_result.scalar_one_or_none()

            cards.append(PipelineCard(
                email_id=str(e.id), campaign_id=str(e.campaign_id),
                company_name=company_name,
                contact_name=c.name if c else "Unknown",
                contact_role=c.role if c else None,
                status=e.status,
                last_activity=e.sent_at or e.created_at,
                next_followup=next_fu.scheduled_for if next_fu else None,
                followup_number=e.followup_number,
            ))
        columns.append(PipelineColumn(status=col["status"], label=col["label"], cards=cards))
    return columns


# ---------------------------------------------------------------------------
# Send email
# ---------------------------------------------------------------------------

@router.post("/emails/{email_id}/send")
async def send_email(
    email_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from mercury.nylas_service import send_outreach_email
    import uuid
    result = await send_outreach_email(db, user, uuid.UUID(email_id))
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("detail"))
    return result


# ---------------------------------------------------------------------------
# Follow-ups
# ---------------------------------------------------------------------------

@router.get("/emails/{email_id}/followups", response_model=list[FollowupOut])
async def list_followups(
    email_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FollowupSchedule)
        .where(FollowupSchedule.outreach_email_id == email_id)
        .order_by(FollowupSchedule.followup_number)
    )
    return [
        FollowupOut(
            id=str(f.id),
            followup_number=f.followup_number,
            scheduled_for=f.scheduled_for,
            status=f.status,
            new_signal_found=f.new_signal_found or False,
            new_signal_content=f.new_signal_content,
        )
        for f in result.scalars().all()
    ]


# ---------------------------------------------------------------------------
# Nylas OAuth
# ---------------------------------------------------------------------------

@router.get("/nylas/auth-url")
async def get_nylas_auth_url(
    user: User = Depends(get_current_user),
):
    from mercury.nylas_service import get_nylas_auth_url
    redirect_uri = f"{settings.base_url}/api/mercury/nylas/callback"
    url = get_nylas_auth_url(str(user.id), redirect_uri)
    if not url:
        raise HTTPException(
            status_code=503,
            detail="Nylas is not configured. Set NYLAS_API_KEY and NYLAS_CLIENT_ID in .env",
        )
    return {"auth_url": url}


@router.get("/nylas/callback")
async def nylas_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    from mercury.nylas_service import exchange_nylas_code

    result = await db.execute(select(User).where(User.id == state))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    redirect_uri = f"{settings.base_url}/api/mercury/nylas/callback"
    grant_id = await exchange_nylas_code(db, user, code, redirect_uri)
    if not grant_id:
        raise HTTPException(status_code=400, detail="Failed to exchange Nylas OAuth code")

    return RedirectResponse(url="http://localhost:3000/pipeline?nylas=connected")


# ---------------------------------------------------------------------------
# Nylas webhooks (open / reply tracking)
# ---------------------------------------------------------------------------

@router.get("/webhooks/nylas")
async def nylas_webhook_verify(challenge: str = Query(...)):
    """Nylas pings this with ?challenge= to verify the endpoint before activating."""
    return challenge


@router.post("/webhooks/nylas")
async def nylas_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    payload = await request.json()
    from mercury.nylas_service import process_nylas_webhook
    await process_nylas_webhook(db, payload)
    return {"status": "ok"}
