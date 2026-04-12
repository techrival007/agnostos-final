"""
Mercury email draft generator.

Pulls rich context from Adam (UserProfile — projects, experience, skills, what_they_bring)
and Theos (Company, CompanyResearch, Contact) to write cover-letter-quality cold outreach.

Email structure (mirrors the cover-letter style):
  1. ONE specific company hook  (what they're building / hiring for / recent news)
  2. 1-2 sender projects with concrete metrics that map to company's work
  3. One clear, low-friction ask

Falls back to a deterministic mock when Gemini is not configured.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from typing import Any

from config import get_settings
from theos.models import Company, CompanyResearch, Contact
from shared.models import User
from adam.models import UserProfile

settings = get_settings()

# ---------------------------------------------------------------------------
# System prompt — defines the voice and format
# ---------------------------------------------------------------------------

MERCURY_SYSTEM = """You are Mercury. You write cold outreach emails in one specific human voice.
Study the examples below — they are real emails by this sender. Match the style exactly.

=== STYLE EXAMPLES (study these) ===

EXAMPLE 1 — to a startup founder (direct, dense):
---
I'm applying to [Company] because [specific mission/product] — exactly the kind of system I like working on.

My approach is simple: build end-to-end, make it reliable, make it repeatable — not just a one-off demo.

In Mercury (centralized content-sharing platform for IIT Delhi), I delivered a system serving 45+ clubs, 18 hostels, and 10,000+ students. Built an end-to-end messaging pipeline with FastAPI OAuth2 + WhatsApp websockets, implemented race-condition-safe queuing and singleton-session handling, and deployed with Docker. That's where I learned impact = reliability: if the pipeline breaks, the product doesn't exist.

In Coeus (AI-powered interview platform), I built webhook-driven FastAPI pipelines orchestrating STT→LLM→TTS in real time (~1 sec latency) using Deepgram + a Cerebras-hosted model (~1500 tok/s). Making it fast, stable, and debuggable was the actual engineering challenge.

In MetaMorphosis (AI monolith → microservices migrator), I built an automated toolchain that analyzed codebases, generated refactoring flows, and validated outputs via pytest/Jest loops. The goal wasn't "AI output" — it was reproducible, trustworthy outputs with guardrails.

I'm strongest in Python (FastAPI), SQL, Docker, and backend systems. GitHub: github.com/techrival007

Would 15 mins work to talk?
---

EXAMPLE 2 — to a hiring manager (slightly warmer):
---
Saw you're building [specific thing at company] — that's the kind of infrastructure/product problem I want to work on.

My work style: ship end-to-end, then make it reliable enough that other people can use it.

In Coeus, I built webhook-driven backend pipelines (FastAPI) connecting STT/TTS + LLM + real-time UI, hitting ~1 sec STT→LLM→TTS latency using Deepgram and a Cerebras-hosted GPT (~1500 tok/s). The product only works if orchestration is fast and stable — that's the part I focused on.

In Mercury, I helped ship a platform for IIT Delhi serving 10,000+ students across 45+ clubs, built on FastAPI OAuth2 + WhatsApp websockets with race-condition-safe queuing and Docker deployment.

Python (FastAPI), SQL, REST APIs, Docker. GitHub: github.com/techrival007

Would a quick call make sense?
---

EXAMPLE 3 — to a new recruit (peer-to-peer, shorter):
---
Noticed you recently joined [Company] — reaching out peer-to-peer.

I'm building toward [similar role/area] and [Company]'s work on [specific thing] is exactly the direction I'm looking at. Shipped a few things that map closely: Mercury (10,000+ users, FastAPI + WebSockets pipeline) and Coeus (~1 sec real-time AI orchestration, STT→LLM→TTS).

Would you be open to sharing advice on the team or who best to speak with?
---

=== RULES ===
1. START with the hook — no "Dear X", no "I hope this finds you well". Straight into it.
2. Always include the "My approach is simple:" or "My work style:" line — it's a signature.
3. Project format: "In **ProjectName** (brief context), I [what was built] [exact metric in parens]."
   - Metrics are non-negotiable: users, latency in ms/sec, throughput (tok/s), scale numbers.
   - Map every project to something the company is actually doing. Make the connection explicit.
4. Skills line is terse: "Python (FastAPI), SQL, Docker" — no paragraphs about skills.
5. End with GitHub line if there is one, then ONE ask (15-min call / advice / quick question).
6. For founders: even denser, skip warmth, lean technical. Show you understand their hard problems.
7. For new recruits: peer-to-peer, shorter, ask for advice not a job.
8. Under 200 words. No filler. Every sentence earns its place.
9. NEVER use: "I hope", "I am writing to express", "I came across", "I would love to",
   "Please feel free", "synergies", "exciting opportunity", "passionate about", "reach out".

Subject lines — 3 variants, each ≤ 8 words, specific, no clickbait:
  - One names a project + company signal: "Mercury-style pipeline → [Company]'s [thing]"
  - One is curiosity/question: "quick question on [Company]'s [specific challenge]"
  - One is direct: "[Sender name] → [Company] intro"

OUTPUT: valid JSON only, no markdown fences:
{
  "subject_lines": ["variant 1", "variant 2", "variant 3"],
  "body": "full email — starts with hook, no greeting, no sign-off name",
  "reasoning": "one sentence: which angle and why",
  "highlighted_proof_titles": ["Exact proof point title used", "second if applicable"]
}
highlighted_proof_titles must exactly match title fields from the proof_points provided."""


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

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
    return (datetime.now(timezone.utc).date() - d).days


# ---------------------------------------------------------------------------
# Context builders — extract the richest possible signals from Adam + Theos
# ---------------------------------------------------------------------------

def _build_sender_context(user: User, profile: UserProfile) -> dict[str, Any]:
    """
    Assemble a rich sender context dict from Adam's UserProfile.
    Prioritises proof_points (ranked highlights), then parsed_projects,
    then parsed_experience.
    """
    # Projects — proof_points are Adam's ranked highlights
    proof_points: list[dict] = [
        p for p in (profile.proof_points or []) if isinstance(p, dict)
    ]

    # Parsed projects provide raw project data if proof_points are sparse
    parsed_projects: list[dict] = [
        p for p in (profile.parsed_projects or []) if isinstance(p, dict)
    ]

    # Experience gives role / company / impact lines
    parsed_experience: list[dict] = [
        e for e in (profile.parsed_experience or []) if isinstance(e, dict)
    ]

    # Skills
    parsed_skills: dict = profile.parsed_skills or {}
    tech_skills: list[str] = []
    if isinstance(parsed_skills, dict):
        tech_skills = [s for s in (parsed_skills.get("technical") or []) if isinstance(s, str)]

    return {
        "name": user.name or "Sender",
        "email": user.email,
        "what_they_bring": profile.what_they_bring or "",
        "proof_points": proof_points,
        "parsed_projects": parsed_projects,
        "parsed_experience": parsed_experience,
        "tech_skills": tech_skills,
        "preferred_roles": profile.preferred_roles or [],
        "preferred_sectors": profile.preferred_sectors or [],
        "preferred_stages": profile.preferred_stages or [],
        "tone_formal": profile.tone_formal,
        "tone_technical": profile.tone_technical,
    }


def _build_company_context(
    company: Company,
    research: CompanyResearch | None,
    contact: Contact,
) -> dict[str, Any]:
    """
    Assemble the richest possible company + contact context from Theos.
    Includes: research summary, recent news, job postings, founder posts,
    tech stack, contact's recent posts.
    """
    job_postings: list[dict] = []
    recent_news: list[dict] = []
    founder_posts: list[dict] = []
    blog_posts: list[dict] = []
    product_updates: list[dict] = []

    if research:
        job_postings = [j for j in (research.job_postings or []) if isinstance(j, dict)]
        recent_news = [n for n in (research.recent_news or []) if isinstance(n, dict)]
        founder_posts = [p for p in (research.founder_posts or []) if isinstance(p, dict)]
        blog_posts = [p for p in (research.blog_posts or []) if isinstance(p, dict)]
        product_updates = [u for u in (research.product_updates or []) if isinstance(u, dict)]

    contact_recent_posts: list[dict] = [
        p for p in (contact.recent_posts or []) if isinstance(p, dict)
    ]

    return {
        "name": company.name,
        "website": company.website or "",
        "stage": company.stage or "",
        "sector": company.sector or [],
        "tech_stack": company.tech_stack or [],
        "headcount": company.headcount,
        "hiring_score": company.hiring_score,
        "research_summary": company.research_summary or "",
        "job_postings": job_postings,
        "recent_news": recent_news,
        "founder_posts": founder_posts,
        "blog_posts": blog_posts,
        "product_updates": product_updates,
        "contact_name": contact.name,
        "contact_role": contact.role or "",
        "contact_is_founder": contact.is_founder,
        "contact_is_new_recruit": contact.is_new_recruit,
        "contact_tenure_months": contact.tenure_months,
        "contact_recent_posts": contact_recent_posts,
    }


# ---------------------------------------------------------------------------
# Hook picker — best opening line from Theos signals
# ---------------------------------------------------------------------------

def pick_best_hook(
    company_ctx: dict[str, Any],
    sender_tech: set[str],
) -> str:
    """
    Return the most specific, recent hook sentence Mercury can open with.
    Priority: contact post → recent news (≤14d) → job posting matching sender tech
    → blog post (≤45d) → founder post (≤21d) → product update → research summary.
    """
    # 1. Contact's own recent post
    for post in company_ctx["contact_recent_posts"][:1]:
        snippet = (post.get("content") or post.get("text") or "")[:120].strip()
        if snippet:
            return f"Saw your post on {snippet[:80]}…"

    # 2. Very recent news (≤14 days)
    for item in company_ctx["recent_news"]:
        if _days_since(_parse_item_date(item.get("date"))) <= 14:
            h = item.get("headline") or item.get("summary") or ""
            if h:
                return f"Saw that {h.strip()}"

    # 3. Job posting that matches sender's tech stack
    for job in company_ctx["job_postings"]:
        title = job.get("title") or ""
        skills = " ".join(job.get("skills") or []).lower()
        desc = (job.get("description") or "").lower()
        combined = (title + " " + skills + " " + desc).lower()
        if any(t in combined for t in sender_tech) or title:
            return f"Saw you're hiring a {title}" if title else ""

    # 4. Recent blog post (≤45 days)
    for post in company_ctx["blog_posts"]:
        if _days_since(_parse_item_date(post.get("date"))) <= 45:
            t = post.get("title") or ""
            if t:
                return f"Read your post on \"{t}\""

    # 5. Founder post (≤21 days)
    for post in company_ctx["founder_posts"]:
        if _days_since(_parse_item_date(post.get("date"))) <= 21:
            author = post.get("author") or company_ctx["name"]
            snippet = (post.get("content") or "")[:100].strip()
            if snippet:
                return f"Noticed {author}'s note: \"{snippet[:80]}…\""

    # 6. Product update
    for u in company_ctx["product_updates"]:
        t = u.get("title") or ""
        if t:
            return f"Saw the update on {t}"

    # 7. Fallback to research summary
    summary = company_ctx["research_summary"]
    if summary:
        return summary[:200]

    return ""


# ---------------------------------------------------------------------------
# Proof point ranker — picks the 1-2 projects most relevant to the company
# ---------------------------------------------------------------------------

def _tech_tokens_from_sender(sender_ctx: dict[str, Any]) -> set[str]:
    tokens: set[str] = set()
    for skill in sender_ctx["tech_skills"]:
        tokens.add(skill.lower())
    for pp in sender_ctx["proof_points"]:
        for t in pp.get("tech") or []:
            if isinstance(t, str):
                tokens.add(t.lower())
    for proj in sender_ctx["parsed_projects"]:
        for t in (proj.get("tech") or proj.get("technologies") or []):
            if isinstance(t, str):
                tokens.add(t.lower())
    return tokens


def select_relevant_proof_points(
    sender_ctx: dict[str, Any],
    company_ctx: dict[str, Any],
    top_k: int = 2,
) -> list[dict[str, Any]]:
    """
    Rank proof_points + parsed_projects by:
      - Tech overlap with company stack
      - Sector/domain match
      - Scale/metrics presence (signals concrete proof)
      - Highlight flag from Adam
    Return top_k with a 'reason' key added.
    """
    company_tech = {t.lower() for t in company_ctx["tech_stack"]}
    company_sectors = {s.lower() for s in company_ctx["sector"]}
    sender_sectors = {s.lower() for s in sender_ctx["preferred_sectors"]}
    sector_overlap = bool(company_sectors & sender_sectors)

    candidates: list[dict] = []

    # Proof points (Adam's curated highlights)
    for pp in sender_ctx["proof_points"]:
        item = dict(pp)
        item["_source"] = "proof_point"
        item["title"] = pp.get("title") or pp.get("project") or "Project"
        candidates.append(item)

    # Parsed projects as fallback / supplement
    existing_titles = {c["title"].lower() for c in candidates}
    for proj in sender_ctx["parsed_projects"]:
        title = proj.get("name") or proj.get("title") or proj.get("project") or ""
        if title.lower() not in existing_titles:
            item = dict(proj)
            item["_source"] = "parsed_project"
            item["title"] = title
            # Normalise 'name' to 'title'
            candidates.append(item)

    def _score(item: dict) -> float:
        techs = set()
        for t in (item.get("tech") or item.get("technologies") or []):
            if isinstance(t, str):
                techs.add(t.lower())
        overlap = len(techs & company_tech)
        s = overlap * 3.0
        # Presence of metrics / impact signals credibility
        impact = item.get("impact") or item.get("metrics") or item.get("scale") or ""
        if impact:
            s += 3.0
        # Adam explicitly flagged it
        if item.get("highlight"):
            s += 2.5
        # Sector match
        if sector_overlap:
            s += 2.0
        # Prefer proof_points over raw parsed projects
        if item.get("_source") == "proof_point":
            s += 1.0
        return s

    ranked = sorted(candidates, key=_score, reverse=True)

    out: list[dict] = []
    for item in ranked[:top_k]:
        row = {k: v for k, v in item.items() if not k.startswith("_")}
        techs = {t.lower() for t in (item.get("tech") or item.get("technologies") or []) if isinstance(t, str)}
        reasons: list[str] = []
        if techs & company_tech:
            reasons.append(f"Tech overlap: {', '.join(sorted(techs & company_tech))}")
        if item.get("impact") or item.get("metrics"):
            reasons.append("Has concrete metrics")
        if item.get("highlight"):
            reasons.append("Adam-flagged highlight")
        if not reasons:
            reasons.append("Best available match")
        row["reason"] = "; ".join(reasons)
        out.append(row)

    return out


# ---------------------------------------------------------------------------
# Relevance score
# ---------------------------------------------------------------------------

def compute_relevance_score(
    sender_ctx: dict[str, Any],
    company_ctx: dict[str, Any],
) -> float:
    sender_tech = _tech_tokens_from_sender(sender_ctx)
    company_tech = {t.lower() for t in company_ctx["tech_stack"]}
    tech_overlap = len(sender_tech & company_tech)

    company_sectors = {s.lower() for s in company_ctx["sector"]}
    sender_sectors = {s.lower() for s in sender_ctx["preferred_sectors"]}
    sector_match = bool(company_sectors & sender_sectors)

    stage_pref = {s.lower() for s in sender_ctx["preferred_stages"]}
    stage_match = company_ctx["stage"].lower() in stage_pref if company_ctx["stage"] else False

    score = 45.0
    score += min(tech_overlap, 6) * 6.0
    if sector_match:
        score += 12.0
    if stage_match:
        score += 8.0
    score += min(max(company_ctx["hiring_score"] or 0, 0), 100) * 0.15
    return round(min(score, 100.0), 1)


# ---------------------------------------------------------------------------
# Mock generator — deterministic fallback (no Gemini key)
# ---------------------------------------------------------------------------

def _mock_generation(
    sender_ctx: dict[str, Any],
    company_ctx: dict[str, Any],
    hook: str,
    relevant: list[dict[str, Any]],
    relevance: float,
    tone: dict[str, int],
) -> dict[str, Any]:
    company_name = company_ctx["name"]
    sender_name = sender_ctx["name"]
    wtb = sender_ctx["what_they_bring"] or "I build reliable, high-scale systems."

    opener = hook or (
        f"Saw what {company_name} is building"
        if not company_ctx["research_summary"]
        else company_ctx["research_summary"][:160].rstrip() + "…"
    )

    # Build project paragraphs in the signature style
    project_paras: list[str] = []
    for pp in relevant[:2]:
        title = pp.get("title") or pp.get("project") or pp.get("name") or ""
        context = pp.get("context") or pp.get("description") or ""
        impact = pp.get("impact") or pp.get("metrics") or pp.get("scale") or ""
        tech_list = (pp.get("tech") or pp.get("technologies") or [])[:4]
        tech_str = ", ".join(tech_list) if tech_list else ""

        line = f"In {title}"
        if context:
            line += f" ({context[:80]})"
        line += ", "
        if impact:
            line += impact[:200]
        if tech_str:
            line += f" ({tech_str})"
        line += "."
        project_paras.append(line)

    lines: list[str] = [opener + "."]
    lines.append(f"\nMy approach is simple: {wtb}")
    lines.extend([f"\n{p}" for p in project_paras])

    # Terse skills
    skills = sender_ctx["tech_skills"][:5]
    if skills:
        lines.append(f"\n{', '.join(skills)}.")

    # Ask
    if company_ctx["contact_is_new_recruit"]:
        lines.append(f"\nWould you have 10 minutes to share advice on who to talk to at {company_name}?")
    elif company_ctx["contact_is_founder"]:
        lines.append("\nWould 15 mins work to compare notes?")
    else:
        lines.append("\nWould a quick call this week make sense?")

    body = " ".join(lines).strip()

    sub_a = f"{sender_name} → {company_name}"[:78]
    sub_b = f"Quick question on {company_name[:30]}'s stack"
    sub_c = f"{(relevant[0].get('title', '') if relevant else 'My work')} → {company_name[:30]}"

    return {
        "subject_lines": [sub_a, sub_b, sub_c],
        "body": body,
        "relevant_projects": relevant,
        "hook_used": hook,
        "relevance_score": relevance,
        "tone_settings": tone,
    }


# ---------------------------------------------------------------------------
# Gemini prompt builder
# ---------------------------------------------------------------------------

def _build_gemini_prompt(
    sender_ctx: dict[str, Any],
    company_ctx: dict[str, Any],
    hook: str,
    relevant: list[dict[str, Any]],
    tone: dict[str, int],
) -> str:
    """
    Build a dense, information-rich prompt for Gemini so it can produce
    a cover-letter-quality cold email.
    """
    # ---- Sender section ----
    proof_json = json.dumps(relevant, indent=2)[:5000]

    # Supplement with parsed experience (most recent 2 roles)
    exp_lines: list[str] = []
    for exp in sender_ctx["parsed_experience"][:2]:
        role = exp.get("role") or exp.get("title") or ""
        company = exp.get("company") or exp.get("employer") or ""
        achievements = exp.get("achievements") or exp.get("impact") or exp.get("description") or ""
        if role:
            line = f"  - {role} at {company}" if company else f"  - {role}"
            if achievements:
                if isinstance(achievements, list):
                    achievements = "; ".join(str(a) for a in achievements[:2])
                line += f": {str(achievements)[:200]}"
            exp_lines.append(line)
    exp_block = "\n".join(exp_lines) if exp_lines else "  (no experience data)"

    # Tech skills
    skills_line = ", ".join(sender_ctx["tech_skills"][:15]) if sender_ctx["tech_skills"] else "see proof points"

    # ---- Company section ----
    # Job postings (top 3 most relevant)
    job_lines: list[str] = []
    for j in company_ctx["job_postings"][:3]:
        title = j.get("title") or ""
        skills = ", ".join(j.get("skills") or [])
        if title:
            job_lines.append(f"  - {title}" + (f" (requires: {skills})" if skills else ""))
    jobs_block = "\n".join(job_lines) if job_lines else "  (no active postings in data)"

    # Recent signals
    signal_lines: list[str] = []
    for n in company_ctx["recent_news"][:2]:
        h = n.get("headline") or n.get("summary") or ""
        if h:
            signal_lines.append(f"  - News: {h[:150]}")
    for p in company_ctx["founder_posts"][:1]:
        c = (p.get("content") or "")[:150]
        author = p.get("author") or "Founder"
        if c:
            signal_lines.append(f"  - {author} post: {c}")
    signals_block = "\n".join(signal_lines) if signal_lines else "  (no recent signals)"

    # Contact recent posts
    contact_post_lines: list[str] = []
    for post in company_ctx["contact_recent_posts"][:1]:
        snippet = (post.get("content") or post.get("text") or "")[:200]
        if snippet:
            contact_post_lines.append(f"  - \"{snippet}\"")
    contact_post_block = "\n".join(contact_post_lines) if contact_post_lines else "  (none)"

    special_notes: list[str] = []
    if company_ctx["contact_is_new_recruit"]:
        tenure = company_ctx.get("contact_tenure_months") or 0
        special_notes.append(
            f"Contact joined {tenure} months ago — use peer-to-peer tone; ask for advice or intro, NOT a direct job ask."
        )
    if company_ctx["contact_is_founder"]:
        special_notes.append(
            "Contact is a founder — be maximally direct and dense; skip pleasantries; show you understand their technical challenges."
        )
    special_block = "\n".join(special_notes) if special_notes else "None"

    return f"""{MERCURY_SYSTEM}

---

SENDER:
Name: {sender_ctx['name']}
What they bring (one-line brand): {sender_ctx['what_they_bring'] or '(not set)'}
Primary tech skills: {skills_line}
Recent experience:
{exp_block}

Top proof points to reference (use exact title strings in highlighted_proof_titles):
{proof_json}

RECIPIENT:
Name: {company_ctx['contact_name']}
Role: {company_ctx['contact_role'] or 'Unknown'}
Is founder: {company_ctx['contact_is_founder']}
Is new recruit (< 1 year): {company_ctx['contact_is_new_recruit']}
Recent LinkedIn posts by this person:
{contact_post_block}

COMPANY:
Name: {company_ctx['name']}
Stage: {company_ctx['stage']}
Sector: {', '.join(company_ctx['sector'])}
Tech stack: {', '.join(company_ctx['tech_stack'])}
Headcount: {company_ctx['headcount'] or 'unknown'}
Research summary: {company_ctx['research_summary'][:600] if company_ctx['research_summary'] else 'Not available'}

Active job postings:
{jobs_block}

Recent signals:
{signals_block}

SUGGESTED HOOK (weave in or improve upon):
{hook or 'Find the most specific opening from the signals / summary above.'}

TONE:
Formality (1=casual, 10=formal): {tone.get('formal', 5)}
Technical depth (1=light, 10=deep): {tone.get('technical', 5)}

SPECIAL INSTRUCTIONS:
{special_block}

---
Write the email now. Remember: under 150 words, no filler, project-first, metrics where possible.
Return ONLY the JSON object."""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def generate_mercury_draft_payload(
    user: User,
    profile: UserProfile,
    contact: Contact,
    company: Company,
    research: CompanyResearch | None,
    campaign_tone: dict[str, int] | None,
) -> dict[str, Any]:
    """
    Generate a full draft payload for one contact.

    Returns a dict with:
      subject_lines, body, relevant_projects, hook_used, relevance_score, tone_settings
    """
    tone: dict[str, int] = campaign_tone or {
        "formal": profile.tone_formal,
        "technical": profile.tone_technical,
    }

    sender_ctx = _build_sender_context(user, profile)
    company_ctx = _build_company_context(company, research, contact)

    sender_tech = _tech_tokens_from_sender(sender_ctx)
    hook = pick_best_hook(company_ctx, sender_tech)
    relevant = select_relevant_proof_points(sender_ctx, company_ctx, top_k=2)
    relevance = compute_relevance_score(sender_ctx, company_ctx)

    if not settings.gemini_api_key:
        return _mock_generation(sender_ctx, company_ctx, hook, relevant, relevance, tone)

    from shared.gemini import generate_structured

    full_prompt = _build_gemini_prompt(sender_ctx, company_ctx, hook, relevant, tone)

    try:
        data = await generate_structured(full_prompt)
    except Exception:
        return _mock_generation(sender_ctx, company_ctx, hook, relevant, relevance, tone)

    subjects = data.get("subject_lines") or []
    body = (data.get("body") or "").strip()

    if not subjects or not body:
        return _mock_generation(sender_ctx, company_ctx, hook, relevant, relevance, tone)

    # Map highlighted titles back to full proof point dicts
    titles = data.get("highlighted_proof_titles") or []
    all_proofs = {
        (p.get("title") or p.get("project") or p.get("name") or ""): p
        for p in (profile.proof_points or [])
        if isinstance(p, dict)
    }
    relevant_projects: list[dict] = []
    for t in titles[:2]:
        if t and t in all_proofs:
            row = dict(all_proofs[t])
            row["reason"] = "Selected by Gemini for this company angle"
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
