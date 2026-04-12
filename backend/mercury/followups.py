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
from mercury.generator import pick_hook_from_research

settings = get_settings()

# Days after initial send for each follow-up
FOLLOWUP_DAYS: dict[int, int] = {1: 3, 2: 5, 3: 7}

FOLLOWUP_TONE_GUIDES: dict[int, str] = {
    1: (
        "Warm and brief. Reference the original email by subject or a single line from it. "
        "If a new company signal is available, lead with it specifically — 'Saw that [signal]'. "
        "One clear, gentle push. Address them by first name. "
        "End with the same ask from the original email. Under 80 words."
    ),
    2: (
        "Slightly more direct. Acknowledge they are busy but mention one concrete, specific "
        "way you can contribute to their current work right now — reference a project from "
        "the original email and connect it to something in the company's stack or what they "
        "are building. No fluff. Under 80 words."
    ),
    3: (
        "Soft close. Acknowledge the timing may not be right. Leave the door fully open "
        "with no pressure — 'Totally understand if the timing is off.' "
        "One final, low-friction offer. This is the last message. Under 60 words."
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
        new_hook = pick_hook_from_research(research)

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
        signal_line = f" Saw that {new_hook.rstrip('.')}." if new_hook else ""
        mocks = {
            1: (
                f"Dear {first_name},\n\n"
                f"Just following up on my previous email.{signal_line} "
                f"Still very interested in what {company_name} is building and "
                f"believe the work I described maps well to your current challenges. "
                f"Happy to keep it to 15 minutes whenever suits you.\n\n"
                f"Sincerely,\n[Sender Name]"
            ),
            2: (
                f"Dear {first_name},\n\n"
                f"One more thought — I am happy to come prepared with specific ideas "
                f"on how my experience applies to {company_name}'s stack and current work. "
                f"No need for a lengthy call; even 15 focused minutes would be valuable.\n\n"
                f"Sincerely,\n[Sender Name]"
            ),
            3: (
                f"Dear {first_name},\n\n"
                f"Totally understand if the timing is not right. "
                f"I will leave this here — if it ever makes sense to connect, "
                f"I would be glad to. No pressure at all.\n\n"
                f"Sincerely,\n[Sender Name]"
            ),
        }
        return mocks.get(followup.followup_number, "Just following up.")

    from shared.gemini import analyze_with_pro

    days_since = (
        datetime.now(timezone.utc) - (original.sent_at or datetime.now(timezone.utc))
    ).days
    contact_desc = f"{contact.name}, {contact.role}" if contact else "the recipient"

    first_name = contact.name.split()[0] if contact and contact.name else "there"

    prompt = f"""Write follow-up #{followup.followup_number} to this cold outreach email.

ORIGINAL EMAIL:
Subject: {original.subject or "(no subject)"}
Body: {original.body or "(no body)"}

RECIPIENT: {contact_desc} at {company_name}
DAYS SINCE SENT: {days_since}

{"NEW SIGNAL TO REFERENCE: " + new_hook if new_hook else "No new signal available — do not fabricate one."}

TONE GUIDE: {FOLLOWUP_TONE_GUIDES[followup.followup_number]}

FORMATTING RULES:
- Start with "Dear {first_name},"
- One paragraph only. No bullet points.
- End with "Sincerely,\\n[Sender Name]"
- Do NOT repeat the full project descriptions from the original email.
- Do NOT use: "I hope this finds you well", "I just wanted to", "I wanted to circle back", "reach out", "touching base".
- Sound like a confident, respectful human — not a template.

Return ONLY the follow-up body text (no subject line — this is a reply in the same thread)."""

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
