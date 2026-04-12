"""
Mercury: personalized outreach drafts from Adam profile + Theos company context.
Uses Gemini when configured; otherwise deterministic mock drafts for local dev.
"""
from __future__ import annotations

import asyncio
import json
import re
from datetime import date, datetime, timezone
from typing import Any

from config import get_settings
from models.company import Company
from models.company_research import CompanyResearch
from models.contact import Contact
from models.user import User
from models.user_profile import UserProfile

settings = get_settings()

MERCURY_SYSTEM = """You are Mercury, a precision email writer. You write cold outreach emails
on behalf of talented people trying to find opportunities at great companies.

Your emails must:
- Sound like they were written by a thoughtful human, not generated
- Open with something SPECIFIC about the company (recent news, what they're building,
  a founder post) — never generic praise
- Connect 1-2 of the sender's concrete proof points to what the company is doing
- Have one clear, low-friction ask at the end
- Be under 150 words. Every sentence must earn its place.
- Never use: "I hope this finds you well", "I am writing to express my interest",
  "I came across your profile", "I would love to", "Please feel free to"
- Sound like a confident, curious human who did their homework

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "subject_lines": ["option 1", "option 2", "option 3"],
  "body": "the email body",
  "reasoning": "one sentence on why you chose this angle",
  "highlighted_proof_titles": ["title from sender proof list", "optional second"]
}
The highlighted_proof_titles must match title fields from the proof points provided."""


def _parse_item_date(value: str | None) -> date | None:
    if not value or not isinstance(value, str):
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", value.strip())
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None


def _days_since(d: date | None) -> int:
    if d is None:
        return 9999
    today = datetime.now(timezone.utc).date()
    return (today - d).days


def pick_best_hook(research: CompanyResearch | None) -> str:
    """Pick a concrete opening line from Theos research (news > blog > founder > product > jobs)."""
    if not research:
        return ""

    for item in research.recent_news or []:
        if isinstance(item, dict) and _days_since(_parse_item_date(item.get("date"))) <= 14:
            h = item.get("headline") or item.get("summary")
            if h:
                return f"Saw that {h}"

    for post in research.blog_posts or []:
        if isinstance(post, dict) and _days_since(_parse_item_date(post.get("date"))) <= 45:
            t = post.get("title")
            if t:
                return f"Read your post on {t}"

    for post in research.founder_posts or []:
        if isinstance(post, dict) and _days_since(_parse_item_date(post.get("date"))) <= 21:
            author = post.get("author", "your team")
            content = (post.get("content") or "")[:120].strip()
            if content:
                return f"Noticed {author}'s note about {content}…"
            return f"Noticed {author}'s recent update"

    for u in research.product_updates or []:
        if isinstance(u, dict):
            t = u.get("title")
            if t:
                return f"Saw the update on {t}"

    for j in research.job_postings or []:
        if isinstance(j, dict):
            t = j.get("title")
            if t:
                return f"Saw you're hiring for {t}"

    return ""


def _tech_tokens(profile: UserProfile, company: Company) -> tuple[set[str], set[str]]:
    user_tech: set[str] = set()
    skills = profile.parsed_skills or {}
    if isinstance(skills, dict):
        for k in ("technical", "soft"):
            for s in skills.get(k) or []:
                if isinstance(s, str):
                    user_tech.add(s.lower())
    for pp in profile.proof_points or []:
        if isinstance(pp, dict):
            for t in pp.get("tech") or []:
                if isinstance(t, str):
                    user_tech.add(t.lower())
    company_tech = {t.lower() for t in (company.tech_stack or []) if isinstance(t, str)}
    return user_tech, company_tech


def select_relevant_proof_points(
    profile: UserProfile,
    company: Company,
    top_k: int = 2,
) -> list[dict[str, Any]]:
    proof_points = [p for p in (profile.proof_points or []) if isinstance(p, dict)]
    if not proof_points:
        return []

    user_tech, company_tech = _tech_tokens(profile, company)
    sectors = {s.lower() for s in (company.sector or []) if isinstance(s, str)}
    preferred = {s.lower() for s in (profile.preferred_sectors or []) if isinstance(s, str)}
    sector_boost = 3.0 if sectors & preferred else 0.0

    def score_pp(pp: dict) -> float:
        techs = {t.lower() for t in (pp.get("tech") or []) if isinstance(t, str)}
        overlap = len(techs & company_tech)
        base = overlap * 2.0
        if pp.get("highlight"):
            base += 2.0
        return base + sector_boost

    ranked = sorted(proof_points, key=score_pp, reverse=True)
    _, company_tech = _tech_tokens(profile, company)
    out: list[dict[str, Any]] = []
    for pp in ranked[:top_k]:
        title = pp.get("title") or pp.get("project") or "Proof point"
        reason_parts: list[str] = []
        techs = {t.lower() for t in (pp.get("tech") or []) if isinstance(t, str)}
        if techs & company_tech:
            reason_parts.append("Overlaps with company's stack")
        if pp.get("highlight"):
            reason_parts.append("Highlighted strength")
        if not reason_parts:
            reason_parts.append("Strong fit for narrative")
        row = dict(pp)
        row["title"] = title
        row["reason"] = "; ".join(reason_parts)
        out.append(row)
    return out


def compute_relevance_score(profile: UserProfile, company: Company) -> float:
    """0–100 heuristic when embeddings are not available."""
    user_tech, company_tech = _tech_tokens(profile, company)
    tech_overlap = len(user_tech & company_tech)
    sector_match = bool(
        set(s.lower() for s in (profile.preferred_sectors or []) if isinstance(s, str))
        & set(s.lower() for s in (company.sector or []) if isinstance(s, str))
    )
    stage_pref = {s.lower() for s in (profile.preferred_stages or []) if isinstance(s, str)}
    stage = (company.stage or "").lower()
    stage_match = stage in stage_pref if stage else False

    score = 45.0
    score += min(tech_overlap, 6) * 6.0
    if sector_match:
        score += 12.0
    if stage_match:
        score += 8.0
    score += min(max(company.hiring_score or 0, 0), 100) * 0.15
    return round(min(score, 100.0), 1)


def _mock_generation(
    user: User,
    profile: UserProfile,
    contact: Contact,
    company: Company,
    research: CompanyResearch | None,
    tone: dict[str, int],
    hook: str,
    relevant: list[dict[str, Any]],
    relevance: float,
) -> dict[str, Any]:
    first = contact.name.split()[0] if contact.name else "there"
    company_name = company.name
    wtb = profile.what_they_bring or "I build reliable backend systems at scale."
    proof_line = ""
    if relevant:
        p0 = relevant[0]
        proof_line = f"Recently I shipped work similar to what you're tackling — {p0.get('project', p0.get('title', 'a high-scale system'))}: {p0.get('impact', '')}".strip()

    opener = hook or (company.research_summary or f"what {company_name} is building")[:200]
    body = (
        f"{first} — {opener}.\n\n"
        f"{wtb}\n"
    )
    if proof_line:
        body += f"{proof_line}\n\n"
    if contact.is_new_recruit:
        body += "I'm reaching out peer-to-peer — would you have 10 minutes for advice on who best to talk to?\n"
    elif contact.is_founder:
        body += "I'd love 15 minutes to compare notes on architecture and where you're taking things next.\n"
    else:
        body += "Would you be open to a short call this week?\n"

    sub_a = f"{company_name} + {user.name or 'quick intro'}"[:78]
    sub_b = f"Thought on {company_name}'s stack"
    sub_c = f"Re: {company_name}"

    return {
        "subject_lines": [sub_a, sub_b, sub_c],
        "body": body.strip(),
        "relevant_projects": relevant,
        "hook_used": hook or (company.research_summary or "")[:200],
        "relevance_score": relevance,
        "tone_settings": tone,
    }


async def generate_mercury_draft_payload(
    user: User,
    profile: UserProfile,
    contact: Contact,
    company: Company,
    research: CompanyResearch | None,
    campaign_tone: dict[str, int] | None,
) -> dict[str, Any]:
    tone = campaign_tone or {
        "formal": profile.tone_formal,
        "technical": profile.tone_technical,
    }
    hook = pick_best_hook(research)
    relevant = select_relevant_proof_points(profile, company, top_k=2)
    relevance = compute_relevance_score(profile, company)

    if not settings.gemini_api_key:
        return _mock_generation(
            user, profile, contact, company, research, tone, hook, relevant, relevance
        )

    from services.gemini import generate_structured

    sender = user.name or "Sender"
    wtb = profile.what_they_bring or ""
    proof_json = json.dumps(relevant, indent=2)[:6000]
    summary = company.research_summary or "No summary available."
    tech = ", ".join(company.tech_stack or [])

    special = []
    if contact.is_new_recruit:
        special.append(
            "Recipient is a new recruit — peer-to-peer tone; ask for advice or intro, not a direct job ask."
        )
    if contact.is_founder:
        special.append("Recipient is a founder — direct, dense, no fluff; show serious research.")

    user_prompt = f"""Write one cold outreach email.

SENDER:
Name: {sender}
What they bring: {wtb}
Proof points (use titles in highlighted_proof_titles):
{proof_json}

RECIPIENT:
Name: {contact.name}
Role: {contact.role or "Unknown"}
Company: {company.name}
Is founder: {contact.is_founder}
Is new recruit: {contact.is_new_recruit}

COMPANY CONTEXT:
Research summary: {summary}
Suggested hook to weave in (use or adapt): {hook or "Pick something specific from summary or proof points."}
Tech stack: {tech}

TONE:
Formality 1-10: {tone.get("formal", 5)}
Technical depth 1-10: {tone.get("technical", 5)}

SPECIAL:
{chr(10).join(special) if special else "None"}
"""

    def _call() -> dict[str, Any]:
        full = MERCURY_SYSTEM + "\n\n" + user_prompt
        return generate_structured(full, max_tokens=2048)

    try:
        data = await asyncio.to_thread(_call)
    except Exception:
        return _mock_generation(
            user, profile, contact, company, research, tone, hook, relevant, relevance
        )

    subjects = data.get("subject_lines") or []
    body = (data.get("body") or "").strip()
    if not subjects or not body:
        return _mock_generation(
            user, profile, contact, company, research, tone, hook, relevant, relevance
        )

    titles = data.get("highlighted_proof_titles") or []
    by_title = {p.get("title"): p for p in (profile.proof_points or []) if isinstance(p, dict)}
    relevant_projects: list[dict[str, Any]] = []
    for t in titles[:2]:
        if t and t in by_title:
            row = dict(by_title[t])
            row["reason"] = "Selected for this company angle"
            relevant_projects.append(row)
    if not relevant_projects:
        relevant_projects = relevant

    subs = subjects[:3]
    while len(subs) < 3:
        subs.append(subs[-1] if subs else "Quick introduction")

    return {
        "subject_lines": subs,
        "body": body,
        "relevant_projects": relevant_projects,
        "hook_used": hook,
        "relevance_score": relevance,
        "tone_settings": tone,
    }
