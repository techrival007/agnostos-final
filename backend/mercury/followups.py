"""
Mercury follow-up scheduler: Day 3 / 5 / 7 sequences with smart signal injection.

schedule_followups   → call right after an email is marked "sent"
generate_followup_body → call when a scheduled follow-up is due
get_due_followups    → poll this periodically (cron / background task)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from config import get_settings
from mercury.models import OutreachEmail, FollowupSchedule
from theos.models import Contact, Company, CompanyResearch
from mercury.generator import pick_best_hook

settings = get_settings()

# Days after initial send for each follow-up
FOLLOWUP_DAYS: dict[int, int] = {1: 3, 2: 5, 3: 7}

FOLLOWUP_TONE_GUIDES: dict[int, str] = {
    1: (
        "Warm and brief. Reference the original email. "
        "If there's a new company signal, lead with it. One gentle push."
    ),
    2: (
        "Slightly more direct. Mention one specific way you can help them right now."
    ),
    3: (
        "Soft close. Acknowledge they're busy. Open door. No pressure. Last message."
    ),
}


async def schedule_followups(
    db: AsyncSession,
    outreach_email_id: uuid.UUID,
    sent_at: datetime,
) -> list[FollowupSchedule]:
    """
    Create FollowupSchedule rows for follow-up 1, 2, 3 (Day 3, 5, 7).
    Call this immediately after marking an email as 'sent'.
    """
    schedules: list[FollowupSchedule] = []
    for followup_num, days in FOLLOWUP_DAYS.items():
        fs = FollowupSchedule(
            outreach_email_id=outreach_email_id,
            followup_number=followup_num,
            scheduled_for=sent_at + timedelta(days=days),
            status="pending",
        )
        db.add(fs)
        schedules.append(fs)
    await db.flush()
    return schedules


async def generate_followup_body(
    db: AsyncSession,
    followup_id: uuid.UUID,
) -> str:
    """
    Generate the body text for a scheduled follow-up.
    Checks for new company signals since the original send and injects them
    when available (smart follow-up).  Stores the result on the schedule row.

    Returns the generated body string.
    """
    fs_result = await db.execute(
        select(FollowupSchedule).where(FollowupSchedule.id == followup_id)
    )
    followup = fs_result.scalar_one_or_none()
    if not followup:
        return ""

    email_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.id == followup.outreach_email_id)
    )
    original = email_result.scalar_one_or_none()
    if not original:
        return ""

    contact_result = await db.execute(
        select(Contact).where(Contact.id == original.contact_id)
    )
    contact = contact_result.scalar_one_or_none()

    company: Company | None = None
    new_hook = ""
    if contact:
        company_result = await db.execute(
            select(Company).where(Company.id == contact.company_id)
        )
        company = company_result.scalar_one_or_none()

    if company:
        research_result = await db.execute(
            select(CompanyResearch).where(CompanyResearch.company_id == company.id)
        )
        research = research_result.scalar_one_or_none()
        new_hook = pick_best_hook(research)

    body = await _build_body(followup, original, contact, company, new_hook)

    # Persist generated content on the schedule row
    await db.execute(
        update(FollowupSchedule)
        .where(FollowupSchedule.id == followup_id)
        .values(
            override_body=body,
            new_signal_found=bool(new_hook),
            new_signal_content=new_hook or None,
        )
    )
    await db.commit()
    return body


async def _build_body(
    followup: FollowupSchedule,
    original: OutreachEmail,
    contact: Contact | None,
    company: Company | None,
    new_hook: str,
) -> str:
    """Build the follow-up body via Gemini (or a deterministic mock)."""
    first_name = contact.name.split()[0] if contact and contact.name else "there"
    company_name = company.name if company else "your team"

    if not settings.gemini_api_key:
        mocks = {
            1: (
                f"{first_name} — just bumping this up. "
                f"Still interested in what {company_name} is building. "
                "Happy to keep it to 15 minutes whenever suits."
            ),
            2: (
                f"Hey {first_name}, one more thought — "
                "happy to come prepared with a few specific ideas on your stack. "
                "15 min?"
            ),
            3: (
                f"Totally get it if the timing's off, {first_name}. "
                "Leaving the door open for whenever it makes sense. "
                "No hard feelings either way."
            ),
        }
        return mocks.get(followup.followup_number, "Just following up.")

    from shared.gemini import analyze_with_pro

    days_since = (
        datetime.now(timezone.utc) - (original.sent_at or datetime.now(timezone.utc))
    ).days
    contact_desc = f"{contact.name}, {contact.role}" if contact else "the recipient"

    prompt = f"""Write follow-up #{followup.followup_number} to this cold outreach email.

ORIGINAL EMAIL:
Subject: {original.subject or "(no subject)"}
Body: {original.body or "(no body)"}

RECIPIENT: {contact_desc} at {company_name}
DAYS SINCE SENT: {days_since}

{"NEW SIGNAL TO REFERENCE: " + new_hook if new_hook else "No new signal available."}

TONE GUIDE: {FOLLOWUP_TONE_GUIDES[followup.followup_number]}
MAX LENGTH: 80 words. One paragraph. Do not repeat what was already said.

Return ONLY the follow-up body text. No subject line (this is a reply in-thread)."""

    try:
        body = await analyze_with_pro(prompt)
        return body.strip()
    except Exception:
        return (
            "Just wanted to follow up on my previous email. "
            "Would love to connect when you have a moment."
        )


async def get_due_followups(db: AsyncSession) -> list[FollowupSchedule]:
    """
    Return all pending FollowupSchedule rows whose scheduled_for is now or past.
    Poll this from a background task / Celery beat.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(FollowupSchedule).where(
            FollowupSchedule.status == "pending",
            FollowupSchedule.scheduled_for <= now,
        )
    )
    return result.scalars().all()
