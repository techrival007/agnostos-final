import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, date
from pathlib import Path
from typing import AsyncGenerator

from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import async_session
from notifications.models import Notification
from theos.models import Company, SearchJob

logger = logging.getLogger("theos.deepsearch")
logger.setLevel(logging.DEBUG)

ANALYSIS_ROOT = Path(__file__).resolve().parent.parent.parent / "analysis" / "companies"

_active_streams: dict[str, list[dict]] = defaultdict(list)
_stream_complete: dict[str, bool] = {}
_cancelled_jobs: set[str] = set()


def _emit(job_id: str, event: dict):
    event.setdefault("timestamp", datetime.utcnow().isoformat())
    _active_streams[str(job_id)].append(event)


def get_events(job_id: str, after: int = 0) -> tuple[list[dict], bool]:
    key = str(job_id)
    events = _active_streams.get(key, [])
    is_done = _stream_complete.get(key, False)
    return events[after:], is_done


def cancel_job(job_id: str):
    _cancelled_jobs.add(str(job_id))


def is_cancelled(job_id: str) -> bool:
    return str(job_id) in _cancelled_jobs


def cleanup_job(job_id: str):
    key = str(job_id)
    _active_streams.pop(key, None)
    _stream_complete.pop(key, None)
    _cancelled_jobs.discard(key)


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


def _build_research_prompt(params: dict) -> str:
    count = params.get("company_count", 10)
    location = params.get("location", "Any")
    sector = params.get("sector", "Any")

    lines = [
        f"Find {count} recently funded startups/companies.",
        f"target_count: {count}",
        f"location: {location}",
        f"sector: {sector}",
        "",
        "Focus only on recently funded/recently added companies.",
        "Do not apply strict year-wise or fixed date-window filtering.",
    ]
    if location and location != "Any":
        lines.append(f"Focus on companies headquartered in or around {location}.")
    if sector and sector != "Any":
        lines.append(f"Focus on the {sector} sector/industry.")
    lines.append(
        "For each company provide: name, funding amount, round stage, investors, HQ location, sector, website, and a brief description."
    )
    return "\n".join(lines)


async def _stream_graph(job_key: str, params: dict):
    """Run graph with astream and collect all events + final state."""
    from theos.deepsearch.graph import graph

    research_prompt = _build_research_prompt(params)
    logger.info("Research prompt:\n%s", research_prompt)

    input_state = {"messages": [HumanMessage(content=research_prompt)]}
    config = {
        "configurable": {
            "number_of_initial_queries": min(int(params.get("company_count", 10)), 8),
            "max_research_loops": 3,
        }
    }

    research_loop = 0
    queries_generated = []
    sources_found = []
    web_results_collected = []
    final_answer = ""
    all_events = []

    async for event in graph.astream(input_state, config=config, stream_mode="updates"):
        if is_cancelled(job_key):
            logger.info("Job %s cancelled by user, aborting graph", job_key)
            raise InterruptedError("Search cancelled by user")

        for node_name, node_output in event.items():
            logger.info("┌─ Node: %s", node_name)

            if node_name == "generate_query":
                queries = node_output.get("search_query", [])
                queries_generated.extend(queries)
                logger.info("│  Generated %d queries:", len(queries))
                for i, q in enumerate(queries, 1):
                    logger.info("│    %d. %s", i, q)

                ev = {
                    "type": "queries_generated",
                    "phase": "generate_query",
                    "title": f"Generated {len(queries)} search queries",
                    "detail": "Targeting Crunchbase, TechCrunch, SEC filings, VC portfolios, and more",
                    "queries": queries,
                }
                all_events.append(ev)
                _emit(job_key, ev)

                ev2 = {
                    "type": "phase_start",
                    "phase": "web_research",
                    "title": "Researching the web",
                    "detail": f"Running {len(queries)} parallel searches with Gemini + Google Search...",
                }
                all_events.append(ev2)
                _emit(job_key, ev2)

            elif node_name == "web_research":
                result_text = node_output.get("web_research_result", [])
                new_sources = node_output.get("sources_gathered", [])
                search_query = node_output.get("search_query", [])

                sources_found.extend(new_sources)
                web_results_collected.extend(result_text)

                query_label = search_query[0] if search_query else "search"
                snippet = ""
                if result_text:
                    raw = result_text[0] if isinstance(result_text, list) and result_text else str(result_text)
                    snippet = raw[:300].replace("\n", " ").strip()

                logger.info("│  Query: %s", query_label)
                logger.info("│  Sources: %d new, %d total", len(new_sources), len(sources_found))

                ev = {
                    "type": "research_result",
                    "phase": "web_research",
                    "title": f"Search complete: {query_label[:80]}",
                    "detail": snippet[:200] + "..." if len(snippet) > 200 else snippet,
                    "sources_count": len(new_sources),
                    "total_sources": len(sources_found),
                    "query": query_label,
                }
                all_events.append(ev)
                _emit(job_key, ev)

            elif node_name == "reflection":
                research_loop += 1
                is_sufficient = node_output.get("is_sufficient", False)
                knowledge_gap = node_output.get("knowledge_gap", "")
                follow_ups = node_output.get("follow_up_queries", [])

                logger.info("│  Loop %d — Sufficient: %s", research_loop, is_sufficient)
                logger.info("│  Gap: %s", knowledge_gap[:200] if knowledge_gap else "None")

                if is_sufficient:
                    ev = {
                        "type": "reflection_done",
                        "phase": "reflection",
                        "title": f"Research sufficient after {research_loop} loop(s)",
                        "detail": "Enough data collected. Moving to final synthesis.",
                        "loop": research_loop,
                        "is_sufficient": True,
                    }
                    all_events.append(ev)
                    _emit(job_key, ev)

                    ev2 = {
                        "type": "phase_start",
                        "phase": "finalize_answer",
                        "title": "Synthesizing final report",
                        "detail": f"Compiling data from {len(sources_found)} sources into structured company profiles...",
                    }
                    all_events.append(ev2)
                    _emit(job_key, ev2)
                else:
                    ev = {
                        "type": "reflection_gap",
                        "phase": "reflection",
                        "title": f"Loop {research_loop}: Gaps identified",
                        "detail": knowledge_gap[:300] if knowledge_gap else "Needs more data",
                        "follow_up_queries": follow_ups,
                        "loop": research_loop,
                        "is_sufficient": False,
                    }
                    all_events.append(ev)
                    _emit(job_key, ev)

                    if follow_ups:
                        ev2 = {
                            "type": "phase_start",
                            "phase": "web_research",
                            "title": f"Follow-up research (loop {research_loop + 1})",
                            "detail": f"Running {len(follow_ups)} additional queries to fill gaps...",
                        }
                        all_events.append(ev2)
                        _emit(job_key, ev2)

            elif node_name == "finalize_answer":
                messages = node_output.get("messages", [])
                for msg in messages:
                    content = getattr(msg, "content", "") if not isinstance(msg, dict) else msg.get("content", "")
                    if content:
                        final_answer = content

                preview = final_answer[:500].replace("\n", " ").strip()
                logger.info("│  Final answer: %d chars", len(final_answer))

                ev = {
                    "type": "answer_ready",
                    "phase": "finalize_answer",
                    "title": "Research report compiled",
                    "detail": f"Generated {len(final_answer):,} character report with {len(sources_found)} sources",
                    "preview": preview,
                }
                all_events.append(ev)
                _emit(job_key, ev)

            logger.info("└─ Node %s complete", node_name)

    return {
        "final_answer": final_answer,
        "queries_generated": queries_generated,
        "sources_found": sources_found,
        "web_results": web_results_collected,
        "research_loops": research_loop,
        "events": all_events,
    }


async def run_deepsearch(job_id: uuid.UUID, user_id: uuid.UUID, params: dict):
    """Background task: run the graph in-process with full event streaming."""
    job_key = str(job_id)
    _active_streams[job_key] = []
    _stream_complete[job_key] = False

    logger.info("═" * 60)
    logger.info("DEEP SEARCH STARTED  job=%s  user=%s", job_id, user_id)
    logger.info("Parameters: %s", json.dumps(params, indent=2))
    logger.info("═" * 60)

    _emit(job_key, {
        "type": "search_started",
        "phase": "init",
        "title": "Deep Search initiated",
        "detail": f"Searching for {params.get('company_count', 10)} companies",
        "params": params,
    })

    async with async_session() as db:
        job = await db.get(SearchJob, job_id)
        if not job:
            logger.error("SearchJob %s not found, aborting", job_id)
            return
        job.status = "running"
        await db.commit()

        await _create_notification(
            db, user_id, "search_started", "Deep Search started",
            f"Searching for {params.get('company_count', 10)} companies...",
            {"job_id": job_key},
        )

    try:
        _emit(job_key, {
            "type": "phase_start",
            "phase": "generate_query",
            "title": "Generating search queries",
            "detail": "AI is crafting targeted queries across funding databases, media, and VC portfolios...",
        })

        result = await _stream_graph(job_key, params)

        final_answer = result["final_answer"]
        web_results = result["web_results"]

        _emit(job_key, {
            "type": "phase_start",
            "phase": "saving",
            "title": "Saving transcript",
            "detail": "Writing research data to disk...",
        })

        transcript = {
            "job_id": job_key,
            "user_id": str(user_id),
            "parameters": params,
            "timestamp": datetime.utcnow().isoformat(),
            "final_answer": final_answer,
            "queries_generated": result["queries_generated"],
            "web_research_results": web_results,
            "sources": [s for s in result["sources_found"] if isinstance(s, dict)],
            "research_loops": result["research_loops"],
        }

        transcript_dir = ANALYSIS_ROOT / str(user_id) / job_key
        transcript_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = transcript_dir / "transcript.json"
        transcript_path.write_text(json.dumps(transcript, indent=2, default=str), encoding="utf-8")
        logger.info("Transcript saved: %s", transcript_path)

        _emit(job_key, {"type": "transcript_saved", "phase": "saving", "title": "Transcript saved", "detail": str(transcript_path)})

        _emit(job_key, {
            "type": "phase_start",
            "phase": "analyzing",
            "title": "Extracting company data",
            "detail": "Using Gemini 2.5 Flash to parse structured company profiles...",
        })

        async with async_session() as db:
            await _create_notification(
                db, user_id, "search_progress", "Research complete",
                "Analyzing results and extracting company data...",
                {"job_id": job_key},
            )

        companies_count = await _analyze_and_upsert(
            final_answer, web_results, user_id, job_id, str(transcript_path), job_key
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
                f"Found {companies_count} companies.",
                {"job_id": job_key, "companies_found": companies_count},
            )

        _emit(job_key, {
            "type": "search_completed",
            "phase": "done",
            "title": "Deep Search complete",
            "detail": f"Found and saved {companies_count} companies to database",
            "companies_found": companies_count,
        })

        logger.info("═" * 60)
        logger.info("DEEP SEARCH COMPLETE  job=%s  companies=%d", job_id, companies_count)
        logger.info("═" * 60)

    except InterruptedError:
        logger.info("DEEP SEARCH CANCELLED  job=%s", job_id)

        _emit(job_key, {
            "type": "search_failed",
            "phase": "error",
            "title": "Deep Search cancelled",
            "detail": "Search was cancelled by user",
        })

        async with async_session() as db:
            job = await db.get(SearchJob, job_id)
            if job:
                job.status = "cancelled"
                await db.commit()

            await _create_notification(
                db, user_id, "search_failed", "Deep Search cancelled",
                "Search was cancelled by user.",
                {"job_id": job_key},
            )

    except Exception as e:
        logger.exception("DEEP SEARCH FAILED  job=%s", job_id)

        _emit(job_key, {
            "type": "search_failed",
            "phase": "error",
            "title": "Deep Search failed",
            "detail": str(e)[:500],
            "error": str(e),
        })

        async with async_session() as db:
            job = await db.get(SearchJob, job_id)
            if job:
                job.status = "failed"
                job.error_message = str(e)[:1000]
                await db.commit()

            await _create_notification(
                db, user_id, "search_failed", "Deep Search failed",
                f"Error: {str(e)[:200]}",
                {"job_id": job_key},
            )

    finally:
        _stream_complete[job_key] = True


async def _analyze_and_upsert(
    final_answer: str,
    web_results: list,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    transcript_path: str,
    job_key: str,
) -> int:
    """Use Gemini 2.5 Flash to extract structured company data and upsert into DB."""
    import google.generativeai as genai

    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)

    logger.info("─── ANALYZE & UPSERT ───")

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

    logger.info("Calling Gemini 2.5 Flash for extraction (%d chars input)", len(combined_text[:15000]))

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
        logger.error("Failed to parse extraction JSON: %s", raw_text[:200])
        companies_data = []

    if not isinstance(companies_data, list):
        companies_data = []

    logger.info("Extracted %d companies from research", len(companies_data))

    _emit(job_key, {
        "type": "companies_extracted",
        "phase": "analyzing",
        "title": f"Extracted {len(companies_data)} companies",
        "detail": ", ".join(c.get("name", "?") for c in companies_data[:10]),
        "companies": [{"name": c.get("name"), "stage": c.get("stage"), "hq_location": c.get("hq_location"), "funding_amount_usd": c.get("funding_amount_usd")} for c in companies_data],
    })

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

            existing = await db.execute(select(Company).where(Company.name.ilike(name)))
            company = existing.scalar_one_or_none()

            funding_date = None
            if c.get("funding_date"):
                try:
                    funding_date = date.fromisoformat(c["funding_date"])
                except (ValueError, TypeError):
                    pass

            if company:
                logger.info("  Updating: %s", name)
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
                logger.info("  Inserting: %s", name)
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

    logger.info("Upserted %d companies to database", count)

    _emit(job_key, {
        "type": "companies_saved",
        "phase": "analyzing",
        "title": f"Saved {count} companies to database",
        "detail": "Companies are now available in the Companies page",
    })

    return count
