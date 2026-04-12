import json
import os
import uuid
from datetime import datetime, date
from pathlib import Path

from langgraph_sdk import get_client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import async_session
from notifications.models import Notification
from theos.models import Company, SearchJob

ANALYSIS_ROOT = Path(__file__).resolve().parent.parent.parent / "analysis" / "companies"
LANGGRAPH_URL = os.getenv("LANGGRAPH_URL", "http://localhost:2024")


async def _create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notif_type: str,
    title: str,
    message: str | None = None,
    metadata: dict | None = None,
):
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        message=message,
        metadata_json=metadata,
    )
    db.add(notif)
    await db.commit()


async def run_deepsearch(job_id: uuid.UUID, user_id: uuid.UUID, params: dict):
    """Background task: run the LangGraph company-search agent, save transcript, analyze results."""
    async with async_session() as db:
        job = await db.get(SearchJob, job_id)
        if not job:
            return

        job.status = "running"
        await db.commit()

        await _create_notification(
            db, user_id, "search_started", "Deep Search started",
            f"Searching for {params.get('company_count', 10)} companies...",
            {"job_id": str(job_id)},
        )

    try:
        client = get_client(url=LANGGRAPH_URL)

        research_prompt = _build_research_prompt(params)

        thread = await client.threads.create()
        thread_id = thread["thread_id"]

        async with async_session() as db:
            job = await db.get(SearchJob, job_id)
            job.langgraph_thread_id = thread_id
            await db.commit()

        run = await client.runs.create(
            thread_id=thread_id,
            assistant_id="company-search",
            input={
                "messages": [{"role": "user", "content": research_prompt}],
            },
            config={
                "configurable": {
                    "number_of_initial_queries": min(int(params.get("company_count", 10)), 8),
                    "max_research_loops": 3,
                }
            },
        )
        run_id = run["run_id"]

        async with async_session() as db:
            job = await db.get(SearchJob, job_id)
            job.langgraph_run_id = run_id
            await db.commit()

        final_state = await client.runs.join(thread_id=thread_id, run_id=run_id)

        messages = final_state.get("messages", [])
        sources = final_state.get("sources_gathered", [])
        web_results = final_state.get("web_research_result", [])

        final_answer = ""
        for msg in reversed(messages):
            content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
            if content:
                final_answer = content
                break

        transcript = {
            "job_id": str(job_id),
            "user_id": str(user_id),
            "parameters": params,
            "timestamp": datetime.utcnow().isoformat(),
            "final_answer": final_answer,
            "web_research_results": web_results,
            "sources": sources,
        }

        transcript_dir = ANALYSIS_ROOT / str(user_id) / str(job_id)
        transcript_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = transcript_dir / "transcript.json"
        transcript_path.write_text(json.dumps(transcript, indent=2, default=str), encoding="utf-8")

        async with async_session() as db:
            await _create_notification(
                db, user_id, "search_progress", "Research complete",
                "Analyzing results and extracting company data...",
                {"job_id": str(job_id)},
            )

        companies_count = await _analyze_and_upsert(
            final_answer, web_results, user_id, job_id, str(transcript_path)
        )

        async with async_session() as db:
            job = await db.get(SearchJob, job_id)
            job.status = "completed"
            job.companies_found = companies_count
            job.transcript_path = str(transcript_path)
            job.result_summary = final_answer[:2000] if final_answer else None
            job.completed_at = datetime.utcnow()
            await db.commit()

            await _create_notification(
                db, user_id, "search_completed", "Deep Search complete",
                f"Found {companies_count} companies. View them in the Companies page.",
                {"job_id": str(job_id), "companies_found": companies_count},
            )

    except Exception as e:
        async with async_session() as db:
            job = await db.get(SearchJob, job_id)
            if job:
                job.status = "failed"
                job.error_message = str(e)[:1000]
                await db.commit()

            await _create_notification(
                db, user_id, "search_failed", "Deep Search failed",
                f"Error: {str(e)[:200]}",
                {"job_id": str(job_id)},
            )


def _build_research_prompt(params: dict) -> str:
    count = params.get("company_count", 10)
    location = params.get("location", "Any")
    recency = params.get("recency", "3 months")
    sector = params.get("sector", "Any")

    lines = [
        f"Find {count} recently funded startups/companies.",
        f"target_count: {count}",
        f"location: {location}",
        f"recency: {recency}",
        f"sector: {sector}",
        "",
        f"Focus on companies that received funding in the last {recency}.",
    ]
    if location and location != "Any":
        lines.append(f"Focus on companies headquartered in or around {location}.")
    if sector and sector != "Any":
        lines.append(f"Focus on the {sector} sector/industry.")
    lines.append(
        "For each company provide: name, funding amount, round stage, investors, HQ location, sector, website, and a brief description."
    )
    return "\n".join(lines)


async def _analyze_and_upsert(
    final_answer: str,
    web_results: list,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    transcript_path: str,
) -> int:
    """Use Gemini 2.5 Flash to extract structured company data and upsert into DB."""
    import google.generativeai as genai

    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)

    combined_text = final_answer
    if web_results:
        combined_text += "\n\n--- Raw research ---\n" + "\n---\n".join(
            r if isinstance(r, str) else str(r) for r in web_results[:5]
        )

    extraction_prompt = f"""Extract ALL companies with funding information from the text below.
Return a JSON array where each element has these fields:
- "name": string (company name, required)
- "website": string or null
- "stage": string or null (one of: "pre-seed", "seed", "series-a", "series-b", "series-c", "growth", "unknown")
- "funding_amount_usd": integer or null (in USD, convert if needed)
- "funding_date": string or null (ISO date YYYY-MM-DD)
- "investors": array of strings or null
- "sector": array of strings or null
- "hq_location": string or null
- "headcount": integer or null
- "description": string or null (1-2 sentence description)

Return ONLY the JSON array, no markdown fences, no explanation.
If no companies are found, return an empty array [].

Text:
{combined_text[:15000]}"""

    model = genai.GenerativeModel("gemini-2.5-flash-preview-04-17")
    response = model.generate_content(extraction_prompt)

    raw_text = response.text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

    try:
        companies_data = json.loads(raw_text)
    except json.JSONDecodeError:
        companies_data = []

    if not isinstance(companies_data, list):
        companies_data = []

    analysis_dir = Path(transcript_path).parent
    (analysis_dir / "extracted_companies.json").write_text(
        json.dumps(companies_data, indent=2, default=str), encoding="utf-8"
    )

    count = 0
    async with async_session() as db:
        for c in companies_data:
            name = c.get("name")
            if not name:
                continue

            existing = await db.execute(
                select(Company).where(Company.name.ilike(name))
            )
            company = existing.scalar_one_or_none()

            funding_date = None
            if c.get("funding_date"):
                try:
                    funding_date = date.fromisoformat(c["funding_date"])
                except (ValueError, TypeError):
                    pass

            if company:
                if c.get("funding_amount_usd"):
                    company.funding_amount_usd = c["funding_amount_usd"]
                if c.get("stage"):
                    company.stage = c["stage"]
                if c.get("investors"):
                    company.investors = c["investors"]
                if c.get("sector"):
                    company.sector = c["sector"]
                if c.get("hq_location"):
                    company.hq_location = c["hq_location"]
                if c.get("website"):
                    company.website = c["website"]
                if c.get("headcount"):
                    company.headcount = c["headcount"]
                if funding_date:
                    company.funding_date = funding_date
                if c.get("description"):
                    company.research_summary = c["description"]
                company.source = "deepsearch"
                company.source_batch = str(job_id)
                company.last_researched_at = datetime.utcnow()
            else:
                company = Company(
                    name=name,
                    website=c.get("website"),
                    stage=c.get("stage"),
                    funding_amount_usd=c.get("funding_amount_usd"),
                    funding_date=funding_date,
                    investors=c.get("investors"),
                    sector=c.get("sector"),
                    hq_location=c.get("hq_location"),
                    headcount=c.get("headcount"),
                    research_summary=c.get("description"),
                    source="deepsearch",
                    source_batch=str(job_id),
                    last_researched_at=datetime.utcnow(),
                )
                db.add(company)

            count += 1

        await db.commit()

    return count
