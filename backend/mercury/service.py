"""
Mercury service: campaign creation and email generation orchestration.

create_campaign_with_drafts is the main entry point — it creates a Campaign
record, finds all contactable contacts at the target company, and generates
a draft OutreachEmail for each one.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from shared.models import User, ActivityLog
from adam.models import UserProfile
from theos.models import Company, Contact, CompanyResearch
from mercury.models import Campaign, OutreachEmail
from mercury.generator import generate_mercury_draft_payload


async def _get_or_create_campaign(
    db: AsyncSession,
    user_id: uuid.UUID,
    company_id: uuid.UUID,
    tone_settings: dict | None,
) -> tuple[Campaign, bool]:
    """Return (campaign, is_new). Existing campaigns are returned as-is."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.user_id == user_id,
            Campaign.company_id == company_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing, False

    campaign = Campaign(
        user_id=user_id,
        company_id=company_id,
        status="active",
        tone_settings=tone_settings,
    )
    db.add(campaign)
    await db.flush()
    return campaign, True


async def _generate_email_for_contact(
    db: AsyncSession,
    user: User,
    profile: UserProfile,
    campaign: Campaign,
    contact: Contact,
    company: Company,
    research: CompanyResearch | None,
) -> OutreachEmail | None:
    """
    Generate (or skip if already exists) a draft email for one contact.
    Returns the OutreachEmail or None if skipped.
    """
    existing = await db.execute(
        select(OutreachEmail).where(
            OutreachEmail.campaign_id == campaign.id,
            OutreachEmail.contact_id == contact.id,
            OutreachEmail.followup_number == 0,
        )
    )
    if existing.scalar_one_or_none():
        return None

    payload = await generate_mercury_draft_payload(
        user=user,
        profile=profile,
        contact=contact,
        company=company,
        research=research,
        campaign_tone=campaign.tone_settings,
    )

    email = OutreachEmail(
        campaign_id=campaign.id,
        contact_id=contact.id,
        subject=payload["subject_lines"][0],
        subject_options=payload["subject_lines"],
        body=payload["body"],
        tone_settings=payload["tone_settings"],
        relevance_score=payload["relevance_score"],
        relevant_projects=payload["relevant_projects"],
        hook_used=payload["hook_used"],
        status="draft",
        followup_number=0,
    )
    db.add(email)
    await db.flush()
    return email


async def create_campaign_with_drafts(
    db: AsyncSession,
    user: User,
    company_id: uuid.UUID,
    tone_settings: dict | None = None,
) -> tuple[Campaign, list[OutreachEmail]]:
    """
    Create (or fetch) a campaign for a company and generate draft emails
    for every contact that has a known email address.

    Returns (campaign, newly_created_drafts).
    Raises ValueError if user profile or company is missing.
    """
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise ValueError("User profile not found — complete onboarding first.")

    company_result = await db.execute(select(Company).where(Company.id == company_id))
    company = company_result.scalar_one_or_none()
    if not company:
        raise ValueError("Company not found.")

    research_result = await db.execute(
        select(CompanyResearch).where(CompanyResearch.company_id == company_id)
    )
    research = research_result.scalar_one_or_none()

    contacts_result = await db.execute(
        select(Contact).where(Contact.company_id == company_id)
    )
    contacts = contacts_result.scalars().all()

    reachable = [c for c in contacts if c.professional_email or c.personal_email]

    campaign, is_new = await _get_or_create_campaign(
        db, user.id, company_id, tone_settings
    )

    emails: list[OutreachEmail] = []
    for contact in reachable:
        email = await _generate_email_for_contact(
            db, user, profile, campaign, contact, company, research
        )
        if email:
            emails.append(email)

    campaign.last_activity_at = datetime.now(timezone.utc)

    log = ActivityLog(
        user_id=user.id,
        actor="mercury",
        action="campaign_created" if is_new else "drafts_regenerated",
        entity_type="campaign",
        entity_id=campaign.id,
        metadata_={
            "company": company.name,
            "new_draft_count": len(emails),
            "reachable_contacts": len(reachable),
        },
    )
    db.add(log)
    await db.commit()
    await db.refresh(campaign)
    return campaign, emails
