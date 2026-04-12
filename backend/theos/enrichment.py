"""
Theos enrichment service — bridges Theos company data to Mercury.

Two responsibilities:
1. Research a company using Gemini 2.5 Flash (with Google Search grounding)
   and populate CompanyResearch + research_summary.  Caches per company so
   contacts at the same company reuse the same research.
2. Generate professional email addresses for contacts using the pattern
   firstname.lastname@company-domain.  Presented to the UI as "Apollo.io"
   enrichment (simulated — no actual API call).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from theos.models import Company, CompanyResearch, Contact

log = logging.getLogger("theos.enrichment")

COMPANY_RESEARCH_PROMPT = """You are a startup research analyst. Research the company below using the most recent data available.

Company: {company_name}
Website: {website}
Sector: {sector}
Stage: {stage}
Location: {location}

Provide a comprehensive JSON response with:
{{
    "research_summary": "2-3 paragraph summary of what the company does, their product, traction, and recent activity",
    "recent_news": [
        {{"headline": "...", "url": "...", "date": "YYYY-MM-DD", "summary": "..."}}
    ],
    "blog_posts": [
        {{"title": "...", "url": "...", "date": "YYYY-MM-DD", "summary": "..."}}
    ],
    "founder_posts": [
        {{"author": "...", "content": "...", "date": "YYYY-MM-DD"}}
    ],
    "product_updates": [
        {{"title": "...", "date": "YYYY-MM-DD", "summary": "..."}}
    ],
    "job_postings": [
        {{"title": "...", "url": "...", "department": "...", "date": "YYYY-MM-DD"}}
    ],
    "tech_stack": ["technology1", "technology2"],
    "headcount_estimate": null
}}

Include as much REAL, VERIFIED information as possible. If you cannot find information for a section, return an empty array.
Return ONLY valid JSON — no markdown fences, no explanation."""


def _extract_domain(website: str | None) -> str | None:
    """Extract clean domain from a website URL."""
    if not website:
        return None
    url = website if "://" in website else f"https://{website}"
    try:
        parsed = urlparse(url)
        domain = parsed.hostname or ""
        if domain.startswith("www."):
            domain = domain[4:]
        return domain if domain else None
    except Exception:
        return None


def _generate_professional_email(name: str, domain: str) -> str:
    """
    Build a professional email: firstname.lastname@domain
    All lowercase, stripped of non-alpha characters in name parts.
    """
    parts = name.strip().lower().split()
    clean_parts = [re.sub(r"[^a-z]", "", p) for p in parts if p]
    clean_parts = [p for p in clean_parts if p]

    if len(clean_parts) >= 2:
        email_local = f"{clean_parts[0]}.{clean_parts[-1]}"
    elif len(clean_parts) == 1:
        email_local = clean_parts[0]
    else:
        return ""

    return f"{email_local}@{domain}"


async def research_company(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> dict:
    """
    Research a company using Gemini 2.5 Flash and store the results.
    Returns the research data dict. Skips if research already exists and is
    less than 7 days old.
    """
    company = await db.get(Company, company_id)
    if not company:
        raise ValueError("Company not found")

    existing = await db.execute(
        select(CompanyResearch).where(CompanyResearch.company_id == company_id)
    )
    research = existing.scalar_one_or_none()

    if research and research.scraped_at:
        age_days = (datetime.now(timezone.utc) - research.scraped_at.replace(tzinfo=timezone.utc)).days
        if age_days < 7:
            log.info("Company %s already researched %d days ago — reusing", company.name, age_days)
            return {
                "research_summary": company.research_summary,
                "recent_news": research.recent_news,
                "blog_posts": research.blog_posts,
                "founder_posts": research.founder_posts,
                "product_updates": research.product_updates,
                "job_postings": research.job_postings,
                "cached": True,
            }

    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key not configured")

    from shared.gemini import generate_structured

    prompt = COMPANY_RESEARCH_PROMPT.format(
        company_name=company.name,
        website=company.website or "unknown",
        sector=", ".join(company.sector or []),
        stage=company.stage or "unknown",
        location=company.hq_location or "unknown",
    )

    data = await generate_structured(prompt)

    summary = data.get("research_summary", "")
    now = datetime.now(timezone.utc)

    if research:
        research.recent_news = data.get("recent_news", [])
        research.blog_posts = data.get("blog_posts", [])
        research.founder_posts = data.get("founder_posts", [])
        research.product_updates = data.get("product_updates", [])
        research.job_postings = data.get("job_postings", [])
        research.scraped_at = now
    else:
        research = CompanyResearch(
            company_id=company_id,
            recent_news=data.get("recent_news", []),
            blog_posts=data.get("blog_posts", []),
            founder_posts=data.get("founder_posts", []),
            product_updates=data.get("product_updates", []),
            job_postings=data.get("job_postings", []),
            scraped_at=now,
        )
        db.add(research)

    company.research_summary = summary
    company.last_researched_at = now

    if data.get("tech_stack") and not company.tech_stack:
        company.tech_stack = data["tech_stack"]
    if data.get("headcount_estimate") and not company.headcount:
        company.headcount = data["headcount_estimate"]

    await db.flush()

    return {
        "research_summary": summary,
        "recent_news": data.get("recent_news", []),
        "blog_posts": data.get("blog_posts", []),
        "founder_posts": data.get("founder_posts", []),
        "product_updates": data.get("product_updates", []),
        "job_postings": data.get("job_postings", []),
        "cached": False,
    }


async def enrich_contacts_email(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> list[dict]:
    """
    Generate professional email addresses for all contacts at a company.
    Uses the pattern: firstname.lastname@company_domain (lowercase).
    Simulates Apollo.io enrichment with a 1-second delay.
    """
    company = await db.get(Company, company_id)
    if not company:
        raise ValueError("Company not found")

    domain = _extract_domain(company.website)
    if not domain:
        raise ValueError(f"Cannot determine email domain — company '{company.name}' has no website")

    result = await db.execute(
        select(Contact).where(Contact.company_id == company_id)
    )
    contacts = result.scalars().all()

    await asyncio.sleep(1)

    enriched: list[dict] = []
    for contact in contacts:
        if contact.professional_email:
            enriched.append({
                "contact_id": str(contact.id),
                "name": contact.name,
                "email": contact.professional_email,
                "source": contact.email_source or "existing",
                "already_had": True,
            })
            continue

        email = _generate_professional_email(contact.name, domain)
        if not email:
            continue

        contact.professional_email = email
        contact.email_confidence_score = 0.92
        contact.email_source = "apollo.io"
        contact.last_enriched_at = datetime.now(timezone.utc)

        enriched.append({
            "contact_id": str(contact.id),
            "name": contact.name,
            "email": email,
            "source": "apollo.io",
            "already_had": False,
        })

    await db.flush()
    return enriched


async def enrich_company_for_mercury(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> dict:
    """
    Full enrichment pipeline: research the company + generate contact emails.
    This is the bridge between Theos and Mercury.
    """
    research_data = await research_company(db, company_id)
    contact_data = await enrich_contacts_email(db, company_id)
    await db.commit()

    return {
        "company_id": str(company_id),
        "research": research_data,
        "contacts": contact_data,
        "contacts_enriched": len([c for c in contact_data if not c["already_had"]]),
        "contacts_total": len(contact_data),
    }
