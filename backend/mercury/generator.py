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
# System prompt — defines the voice, structure, and format
# ---------------------------------------------------------------------------

MERCURY_SYSTEM = """You are Mercury. You write personalised, cover-letter-quality cold outreach emails on behalf of talented engineers and builders to companies they want to work at.

Study the examples below carefully — they define the exact style, structure, length, and voice you must produce.

=== STYLE EXAMPLES ===

EXAMPLE 1 — to a startup founder (dense, technical, direct):
---
Dear [Founder Name],

I'm applying to [Company] because [specific mission/product — what they're building and why it's a real technical challenge] — exactly the kind of system I want to work on.

My approach is simple: build end-to-end, make it reliable, make it repeatable — not just a one-off demo.

In **Mercury** (centralized content-sharing platform for IIT Delhi — 45+ clubs, 18 hostels, 10,000+ students), I delivered an end-to-end messaging pipeline with FastAPI OAuth2 + WhatsApp websockets, implemented race-condition-safe queuing and singleton-session handling, and deployed with Docker on an intranet server. That's where I learned impact = reliability: if the pipeline breaks, the product doesn't exist. This maps directly to [Company]'s challenge of [specific technical problem the company faces].

In **Coeus** (AI-powered interview platform), I built webhook-driven FastAPI pipelines orchestrating STT→LLM→TTS in real time (~1 sec latency) using Deepgram + a Cerebras-hosted model (~1500 tok/s). Making it fast, stable, and debuggable under iteration was the actual engineering challenge — the same kind of systems problem [Company] is working on with [their specific stack or domain].

In **MetaMorphosis** (AI monolith → microservices migrator), I built an automated toolchain that analysed codebases, generated structured refactoring flows, and validated outputs via pytest/Jest loops. The goal wasn't "AI output" — it was reproducible, trustworthy outputs with guardrails. That thinking directly applies to [Company]'s need for [reliable/structured outputs / pipeline correctness / etc.].

I'm strongest in Python (FastAPI), SQL, Docker, and backend systems. GitHub: github.com/techrival007

Would 15 minutes work to compare notes?

Sincerely,
[Sender Name]
---

EXAMPLE 2 — to a hiring manager (slightly warmer, still technical):
---
Dear [Name],

[Specific hook — saw a recent news item, job posting, or product update that caught my eye]. That's exactly the kind of [infrastructure / product / engineering] problem I want to work on.

My work style: ship end-to-end, then make it reliable enough that other people can depend on it.

In **Coeus** (AI interview platform), I built webhook-driven backend pipelines (FastAPI) connecting STT/TTS + LLM + real-time UI, hitting ~1 sec STT→LLM→TTS latency using Deepgram and a Cerebras-hosted GPT (~1500 tok/s). The product only works if orchestration is fast and stable — that's the part I focused on, and it's what [Company]'s [specific stack/challenge] needs most.

In **Mercury** (IIT Delhi's content-sharing platform — 10,000+ students, 45+ clubs), I helped ship a platform built on FastAPI OAuth2 + WhatsApp websockets with race-condition-safe queuing and Docker deployment. This gave me hands-on experience with reliability at real scale, edge case handling, and thinking through failure modes before they happen.

I'm strongest in Python (FastAPI), SQL, REST APIs, and Docker. GitHub: github.com/techrival007

Would a quick call this week make sense?

Sincerely,
[Sender Name]
---

EXAMPLE 3 — to a new recruit (peer-to-peer, shorter, advice-seeking):
---
Dear [Name],

Noticed you recently joined [Company] — reaching out peer-to-peer.

I'm building toward [similar role/area] and [Company]'s work on [specific product/engineering challenge] is exactly the direction I want to go. I've shipped things that map closely: **Mercury** (serving 10,000+ users, FastAPI + WebSockets pipeline, Docker deployment) and **Coeus** (~1 sec real-time AI orchestration, STT→LLM→TTS, microservices architecture).

I'm not asking for a referral — just genuine advice on the team, what the engineering culture is like, and who I might best speak with.

Would you be open to a 10-minute conversation?

Sincerely,
[Sender Name]
---

=== RULES ===

1. ALWAYS start with "Dear [First Name]," — address them by first name. Use "Dear Founders," or "Dear Hiring Team," only if no name is available.

2. OPENING PARAGRAPH: One specific, researched reason you're reaching out to THIS company right now. Reference: a recent news item, the specific product they're building, a job posting that maps to the sender's skills, or their funding/mission angle. Never generic praise. Make it clear you did your homework.

3. APPROACH LINE (NON-NEGOTIABLE): After the opening, always include either:
   "My approach is simple: build end-to-end, make it reliable, make it repeatable — not just a one-off demo."
   or "My work style: ship end-to-end, then make it reliable enough that other people can depend on it."
   This is a signature element. It must appear.

4. PROJECT PARAGRAPHS — the format is sacred:
   "In **[ProjectName]** ([brief context — what it is, one key metric]), I [built/worked on] [specific technical work with exact numbers where possible]. [ONE sentence explicitly connecting this project to what the company is building or the problem they're solving.]"
   Rules within this:
   - Bold the project name always.
   - Metrics are non-negotiable: users served, latency numbers, throughput (tok/s), scale, test coverage, API call volumes.
   - The connection to the company must be explicit in plain English, not implied.
   - 2 project paragraphs for founders/managers. 1–2 for new recruits.

5. SKILLS LINE: Terse. "I'm strongest in [languages/tools, comma-separated]. GitHub: [link if provided]." One line only. No paragraphs about skills.

6. CLOSING ASK: ONE sentence. No options. Context-matched:
   - Founder: "Would 15 minutes work to compare notes?"
   - Hiring manager: "Would a quick call this week make sense?"
   - New recruit: "Would you be open to a 10-minute conversation?"

7. SIGN-OFF: Always end with "Sincerely,\\n[Sender Name]"

8. LENGTH: 250–350 words for founders and managers. 150–200 words for new recruits. Every sentence earns its place. No filler.

9. TONE: Formal but human. Confident, not arrogant. Direct, not stiff. The reader should feel like a capable, self-aware person reached out — not a template.

10. NEVER USE: "I hope this finds you well", "I am writing to express my interest", "I came across your profile", "I would love to", "Please feel free", "synergies", "exciting opportunity", "passionate about", "I believe I would be a great fit", "I am reaching out because".

11. For FOUNDERS: Maximum density and technical depth. Show you understand their hardest engineering problems. Zero warmth filler.

12. For NEW RECRUITS: Peer-to-peer register. Shorter. Ask for advice and insight, not a job.

Subject lines — 3 variants, each ≤ 10 words, specific, no clickbait:
  - One maps a project to a company challenge: "[ProjectName]-style pipeline → [Company]'s [specific thing]"
  - One is a direct intro: "[Sender Name] → [Company] — quick intro"
  - One is curiosity-driven: "quick question on [Company]'s [specific technical challenge]"

OUTPUT: valid JSON only — no markdown fences, no explanation outside the JSON object:
{
  "subject_lines": ["variant 1", "variant 2", "variant 3"],
  "body": "full email — starts with Dear [Name],  ends with Sincerely\\n[Sender Name]",
  "reasoning": "one sentence: which angle you chose and why",
  "highlighted_proof_titles": ["Exact proof point title used", "second if applicable"]
}
highlighted_proof_titles must exactly match the title fields from the proof_points provided."""


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


def pick_hook_from_research(research: Any) -> str:
    """
    Adapter for followups.py — takes a CompanyResearch ORM object directly
    (rather than the full company_ctx dict) and returns the best hook string.
    """
    if not research:
        return ""
    ctx: dict[str, Any] = {
        "contact_recent_posts": [],
        "recent_news": [n for n in (research.recent_news or []) if isinstance(n, dict)],
        "job_postings": [j for j in (research.job_postings or []) if isinstance(j, dict)],
        "blog_posts": [p for p in (research.blog_posts or []) if isinstance(p, dict)],
        "founder_posts": [p for p in (research.founder_posts or []) if isinstance(p, dict)],
        "product_updates": [u for u in (research.product_updates or []) if isinstance(u, dict)],
        "research_summary": "",
    }
    return pick_best_hook(ctx, set())


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
    contact_name = company_ctx["contact_name"]
    is_founder = company_ctx["contact_is_founder"]
    is_new_recruit = company_ctx["contact_is_new_recruit"]
    sector = company_ctx["sector"]
    tech_stack = company_ctx["tech_stack"]
    stage = company_ctx["stage"]
    research_summary = company_ctx["research_summary"]
    job_postings = company_ctx["job_postings"]

    # --- Greeting ---
    first_name = contact_name.split()[0] if contact_name else ""
    if first_name:
        greeting = f"Dear {first_name},"
    elif is_founder:
        greeting = "Dear Founders,"
    else:
        greeting = "Dear Hiring Team,"

    # --- Opening paragraph ---
    # Use the hook if available, otherwise build one from research/job postings
    if hook:
        opening = hook.rstrip(".") + "."
        if not opening[0].isupper():
            opening = opening[0].upper() + opening[1:]
        opening_para = (
            f"{opening} That is exactly the kind of "
            f"{'engineering challenge' if is_founder else 'product problem'} "
            f"I want to work on — and why I am reaching out to {company_name}."
        )
    elif job_postings:
        role_title = job_postings[0].get("title") or "a role"
        opening_para = (
            f"I came across {company_name}'s opening for {role_title} and it maps "
            f"precisely to the kind of systems work I have been doing. "
            f"{'Your focus on ' + research_summary[:120] + '...' if research_summary else ''}"
        ).strip()
    elif research_summary:
        opening_para = (
            f"{research_summary[:200].rstrip()}. "
            f"That is the kind of work I want to contribute to, which is why I am "
            f"reaching out directly."
        )
    else:
        sector_str = f"in the {sector[0]} space" if sector else "at this stage"
        stage_str = f"a {stage} company" if stage else "a fast-moving team"
        opening_para = (
            f"I have been following {company_name}'s work closely — "
            f"{stage_str} {sector_str} is exactly the kind of environment "
            f"where I want to build. I am reaching out because I believe my "
            f"background maps directly to the problems you are solving."
        )

    # --- Approach line ---
    if is_founder:
        approach_line = (
            "My approach is simple: build end-to-end, make it reliable, "
            "make it repeatable — not just a one-off demo."
        )
    else:
        approach_line = (
            "My work style: ship end-to-end, then make it reliable enough "
            "that other people can depend on it."
        )

    # --- Project paragraphs ---
    project_paras: list[str] = []
    company_tech_lower = {t.lower() for t in tech_stack}
    sector_str = sector[0] if sector else ""

    for pp in relevant[:2]:
        title = pp.get("title") or pp.get("project") or pp.get("name") or "a key project"
        context = pp.get("context") or pp.get("description") or ""
        impact = pp.get("impact") or pp.get("metrics") or pp.get("scale") or ""
        problem = pp.get("problem") or ""
        tech_list = [
            t for t in (pp.get("tech") or pp.get("technologies") or [])
            if isinstance(t, str)
        ][:5]
        tech_str = ", ".join(tech_list)

        # Build the project line
        line = f"In **{title}**"
        if context:
            line += f" ({context[:100].rstrip()})"
        line += ", I "

        if impact:
            line += impact[:220].rstrip()
        elif problem:
            line += f"worked on {problem[:180].rstrip()}"
        else:
            line += "designed and shipped the core systems"

        if tech_str:
            line += f", using {tech_str}"
        line += "."

        # Explicit connection to company
        overlap = [t for t in tech_list if t.lower() in company_tech_lower]
        if overlap:
            line += (
                f" The overlap with {company_name}'s stack ({', '.join(overlap)}) "
                f"means I can contribute to your existing systems from day one."
            )
        elif sector_str and problem:
            line += (
                f" This experience is directly relevant to what {company_name} "
                f"is building in the {sector_str} space."
            )
        elif research_summary:
            line += (
                f" This is precisely the kind of reliability and systems thinking "
                f"that {company_name}'s work demands."
            )
        else:
            line += (
                f" This is directly applicable to the challenges {company_name} "
                f"is tackling at this stage."
            )

        project_paras.append(line)

    # If no relevant projects were found, build a generic but structured placeholder
    if not project_paras:
        wtb = sender_ctx["what_they_bring"] or "I build reliable, high-scale backend systems."
        project_paras.append(
            f"My recent work has focused on {wtb.lower().rstrip('.')}. "
            f"The systems I have built deal with scale, reliability, and real user impact — "
            f"which aligns with what {company_name} is working on."
        )

    # --- Skills line ---
    skills = [s for s in sender_ctx["tech_skills"][:7] if isinstance(s, str)]
    skills_line = (
        f"I am strongest in {', '.join(skills)}." if skills
        else "My core stack is Python, SQL, and backend systems."
    )

    # --- Closing ask ---
    if is_new_recruit:
        ask = (
            f"I am not asking for a referral — just genuine advice on the team at "
            f"{company_name} and who I might best speak with. "
            f"Would you be open to a 10-minute conversation?"
        )
    elif is_founder:
        ask = "Would 15 minutes work to compare notes?"
    else:
        ask = "Would a quick call this week make sense?"

    # --- Assemble body ---
    if is_new_recruit:
        # Shorter peer-to-peer format
        body_parts = [
            greeting,
            "",
            opening_para,
            "",
        ]
        if project_paras:
            body_parts.append(project_paras[0])
            body_parts.append("")
        body_parts += [
            ask,
            "",
            f"Sincerely,\n{sender_name}",
        ]
    else:
        # Full cover-letter-quality format
        body_parts = [
            greeting,
            "",
            opening_para,
            "",
            approach_line,
            "",
        ]
        for para in project_paras:
            body_parts.append(para)
            body_parts.append("")
        body_parts += [
            skills_line,
            "",
            ask,
            "",
            f"Sincerely,\n{sender_name}",
        ]

    body = "\n".join(body_parts).strip()

    # --- Subject lines ---
    proj_title = relevant[0].get("title", "") if relevant else ""
    sub_a = (
        f"{proj_title} → {company_name}"[:78]
        if proj_title
        else f"{sender_name} → {company_name}"[:78]
    )
    job_title = job_postings[0].get("title", "") if job_postings else ""
    sub_b = (
        f"Quick intro — {sender_name} re: {job_title[:30]}"
        if job_title
        else f"Quick intro — {sender_name} → {company_name[:35]}"
    )
    sub_c = (
        f"Quick question on {company_name[:30]}'s engineering challenges"
        if is_founder
        else f"Quick question on {company_name[:30]}'s stack"
    )

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
One-line brand: {sender_ctx['what_they_bring'] or '(not set)'}
Primary tech skills: {skills_line}
Recent experience:
{exp_block}

Top proof points (use exact title strings in highlighted_proof_titles):
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
Research summary: {company_ctx['research_summary'][:800] if company_ctx['research_summary'] else 'Not available'}

Active job postings:
{jobs_block}

Recent signals (news, posts, updates):
{signals_block}

SUGGESTED HOOK (use this or find something more specific from the signals/summary):
{hook or 'Find the most specific and recent signal from company data above to open with.'}

TONE:
Formality (1=very casual, 10=very formal): {tone.get('formal', 6)}
Technical depth (1=light/story-driven, 10=highly technical): {tone.get('technical', 6)}

SPECIAL INSTRUCTIONS:
{special_block}

---
CRITICAL REQUIREMENTS FOR THIS EMAIL:
- Start with "Dear [First Name]," (use recipient name above)
- Include "My approach is simple:" or "My work style:" as the second paragraph — do NOT skip this
- 2 project paragraphs with bold project names, metrics, and an EXPLICIT connection to what {company_ctx['name']} is building
- End with a terse skills line, one closing ask, then "Sincerely,\\n{sender_ctx['name']}"
- LENGTH: {"150–200 words (new recruit — peer-to-peer, advice-seeking)" if company_ctx['contact_is_new_recruit'] else "250–350 words (cover-letter quality — formal, detailed, every sentence earns its place)"}
- Every project paragraph must explicitly name why it is relevant to {company_ctx['name']}'s specific work

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
