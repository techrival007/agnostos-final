import json
import os
import pathlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, HTTPException, WebSocket
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_db, async_session
from shared.models import User, ActivityLog
from adam.models import UserProfile, AdamConversation, InterviewTranscript
from adam.schemas import (
    ChatMessage, ChatResponse, ConversationTurn,
    ProfileOut, ProfileUpdate, UploadResponse, InterviewStatus,
    OnboardingStatus, InterviewTranscriptOut, InterviewAnswerUpdate,
)
from auth.service import get_current_user, decode_token
from shared.gemini import chat_with_gemini, get_mock_adam_response, generate_structured
from adam.parser import extract_pdf_text, parse_cv, extract_proof_points
from knowledge.service import add_knowledge_entry, clear_user_knowledge, bulk_ingest_knowledge
from shared.linkedin import scrape_linkedin_profile, format_linkedin_for_analysis
from config import get_settings

ANALYSIS_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent / "analysis"

router = APIRouter(prefix="/api/adam", tags=["adam"])
settings = get_settings()

ADAM_SYSTEM_PROMPT = """
You are Adam. You are a warm, deeply curious AI whose only purpose is to
understand this person so you can help them present their absolute best self
to the world.

You already have their CV and LinkedIn data. Do NOT ask about things already
there. Dig beneath the surface.

You are NOT an interviewer. You are a smart, caring friend who asks one
thoughtful question at a time and genuinely listens.

Your goal across 15-20 turns is to understand:
- The story BEHIND their best work
- What kind of problems light them up vs drain them
- What they're genuinely proud of that their CV undersells
- What they want next, and the real reason why
- What makes them different from 100 others with the same skills
- Their communication personality

Rules:
- ONE question per turn. Never two.
- Keep your responses under 3 sentences + the question.
- If they say something interesting, explore it before moving on.
- Do NOT use corporate language. Talk like a smart human.
- Never say "Great answer!" -- just respond naturally.
"""


@router.post("/chat", response_model=ChatResponse)
async def adam_chat(
    req: ChatMessage,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdamConversation)
        .where(AdamConversation.user_id == user.id)
        .order_by(AdamConversation.created_at)
    )
    history = result.scalars().all()

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()

    turn_number = len([h for h in history if h.role == "user"]) + 1

    if settings.gemini_api_key:
        messages = []
        for turn in history:
            role = "user" if turn.role == "user" else "assistant"
            messages.append({"role": role, "content": turn.content})
        messages.append({"role": "user", "content": req.message})

        context = ""
        if profile:
            context = f"\n\nWhat you know about them:\nSkills: {profile.parsed_skills}\nExperience: {profile.parsed_experience}\nProjects: {profile.parsed_projects}\nInterview turns: {turn_number}"

        reply = await chat_with_gemini(
            system_prompt=ADAM_SYSTEM_PROMPT + context,
            messages=messages,
        )
    else:
        reply = get_mock_adam_response(turn_number)

    user_turn = AdamConversation(user_id=user.id, role="user", content=req.message)
    adam_turn = AdamConversation(user_id=user.id, role="adam", content=reply)
    db.add(user_turn)
    db.add(adam_turn)

    if profile:
        await db.execute(
            update(UserProfile)
            .where(UserProfile.user_id == user.id)
            .values(interview_turns=turn_number)
        )

    await db.commit()
    return ChatResponse(reply=reply, turn_number=turn_number)


@router.get("/chat/history", response_model=list[ConversationTurn])
async def get_chat_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdamConversation)
        .where(AdamConversation.user_id == user.id)
        .order_by(AdamConversation.created_at)
    )
    turns = result.scalars().all()
    return [
        ConversationTurn(role=t.role, content=t.content, created_at=t.created_at)
        for t in turns
    ]


@router.post("/upload", response_model=UploadResponse)
async def upload_cv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    cv_text = extract_pdf_text(pdf_bytes)

    parsed = await parse_cv(cv_text)
    proof_points = await extract_proof_points(parsed, cv_text)

    await db.execute(
        update(UserProfile)
        .where(UserProfile.user_id == user.id)
        .values(
            raw_cv_text=cv_text,
            parsed_skills=parsed.get("skills"),
            parsed_experience=parsed.get("experience"),
            parsed_projects=parsed.get("projects"),
            parsed_education=parsed.get("education"),
            proof_points=proof_points,
        )
    )
    await db.commit()

    return UploadResponse(
        parsed_skills=parsed.get("skills"),
        parsed_experience=parsed.get("experience"),
        parsed_projects=parsed.get("projects"),
        parsed_education=parsed.get("education"),
        proof_points=proof_points,
    )


@router.get("/profile", response_model=ProfileOut)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileOut(
        id=str(profile.id),
        parsed_skills=profile.parsed_skills,
        parsed_experience=profile.parsed_experience,
        parsed_projects=profile.parsed_projects,
        parsed_education=profile.parsed_education,
        proof_points=profile.proof_points,
        soft_profile=profile.soft_profile,
        what_they_bring=profile.what_they_bring,
        preferred_roles=profile.preferred_roles,
        preferred_stages=profile.preferred_stages,
        preferred_sectors=profile.preferred_sectors,
        location=profile.location,
        open_to_relocation=profile.open_to_relocation,
        visa_status=profile.visa_status,
        tone_formal=profile.tone_formal,
        tone_technical=profile.tone_technical,
        interview_completed=profile.interview_completed,
        interview_turns=profile.interview_turns,
        onboarding_completed=profile.onboarding_completed,
        onboarding_step=profile.onboarding_step,
    )


@router.patch("/profile", response_model=ProfileOut)
async def update_profile(
    updates: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    values = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not values:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.execute(
        update(UserProfile).where(UserProfile.user_id == user.id).values(**values)
    )
    await db.commit()
    return await get_profile(user=user, db=db)


@router.get("/interview/status", response_model=InterviewStatus)
async def interview_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return InterviewStatus(
        interview_completed=profile.interview_completed,
        interview_turns=profile.interview_turns,
    )


@router.get("/onboarding/status", response_model=OnboardingStatus)
async def get_onboarding_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return OnboardingStatus(
        onboarding_completed=profile.onboarding_completed,
        onboarding_step=profile.onboarding_step,
        has_cv=bool(profile.raw_cv_text),
        has_linkedin=bool(profile.raw_linkedin_text),
        has_interview=profile.interview_completed,
    )


@router.patch("/onboarding/step")
async def advance_onboarding_step(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    new_step = profile.onboarding_step + 1
    completed = new_step >= 3

    await db.execute(
        update(UserProfile)
        .where(UserProfile.user_id == user.id)
        .values(onboarding_step=new_step, onboarding_completed=completed)
    )
    await db.commit()
    return {"onboarding_step": new_step, "onboarding_completed": completed}


def _sse_event(step: str, status: str, message: str, data: dict | None = None) -> str:
    payload = {
        "step": step,
        "status": status,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if data:
        payload["data"] = data
    return f"data: {json.dumps(payload)}\n\n"


def _save_analysis_file(user_id: str, filename: str, content):
    user_dir = ANALYSIS_ROOT / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filepath = user_dir / filename
    if isinstance(content, str):
        filepath.write_text(content, encoding="utf-8")
    else:
        filepath.write_text(json.dumps(content, indent=2, default=str), encoding="utf-8")


async def _log_activity(db: AsyncSession, user_id, action: str, metadata: dict | None = None):
    db.add(ActivityLog(user_id=user_id, actor="adam", action=action, metadata_=metadata))
    await db.commit()


@router.post("/upload-resume")
async def upload_resume_and_linkedin(
    request: Request,
    file: UploadFile = File(...),
    linkedin_url: str = Form(default=""),
    user: User = Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    has_linkedin = bool(linkedin_url.strip())
    uid = user.id

    async def stream_processing():
        async with async_session() as db:
            try:
                # --- Step 1: PDF text extraction ---
                yield _sse_event("pdf_extract", "in_progress", "Extracting text from PDF...")
                cv_text = extract_pdf_text(pdf_bytes)
                char_count = len(cv_text)

                await db.execute(
                    update(UserProfile).where(UserProfile.user_id == uid)
                    .values(raw_cv_text=cv_text)
                )
                await _log_activity(db, uid, "cv_text_extracted", {"characters": char_count})
                _save_analysis_file(str(uid), "cv_raw_text.txt", cv_text)
                yield _sse_event("pdf_extract", "done", f"PDF text extracted ({char_count:,} characters)")

                # --- Step 2: LinkedIn scraping ---
                linkedin_text = ""
                linkedin_data = None
                if has_linkedin:
                    yield _sse_event("linkedin_scrape", "in_progress", f"Scraping LinkedIn profile...")
                    try:
                        linkedin_data = await scrape_linkedin_profile(linkedin_url.strip())
                        if linkedin_data:
                            linkedin_text = format_linkedin_for_analysis(linkedin_data)
                            await db.execute(
                                update(UserProfile).where(UserProfile.user_id == uid)
                                .values(raw_linkedin_text=linkedin_text)
                            )
                            await _log_activity(db, uid, "linkedin_scraped", {"url": linkedin_url.strip(), "fields": list(linkedin_data.keys())})
                            _save_analysis_file(str(uid), "linkedin_raw.json", linkedin_data)
                            _save_analysis_file(str(uid), "linkedin_formatted.txt", linkedin_text)
                            yield _sse_event("linkedin_scrape", "done", "LinkedIn profile scraped successfully")
                        else:
                            await _log_activity(db, uid, "linkedin_scrape_empty", {"url": linkedin_url.strip()})
                            yield _sse_event("linkedin_scrape", "done", "LinkedIn scrape returned no data -- continuing with CV only")
                    except Exception as e:
                        await _log_activity(db, uid, "linkedin_scrape_failed", {"error": str(e)})
                        yield _sse_event("linkedin_scrape", "error", f"LinkedIn scrape failed: {str(e)[:100]} -- continuing with CV only")
                else:
                    yield _sse_event("linkedin_scrape", "skipped", "No LinkedIn URL provided -- skipping")

                # --- Step 3: CV analysis with Gemini ---
                yield _sse_event("cv_analysis", "in_progress", "Analyzing CV with Gemini 2.5 Flash...")
                parsed = await parse_cv(cv_text)

                skill_count = len(parsed.get("skills", {}).get("technical", []))
                exp_count = len(parsed.get("experience", []))
                proj_count = len(parsed.get("projects", []))

                await db.execute(
                    update(UserProfile).where(UserProfile.user_id == uid)
                    .values(
                        parsed_skills=parsed.get("skills"),
                        parsed_experience=parsed.get("experience"),
                        parsed_projects=parsed.get("projects"),
                        parsed_education=parsed.get("education"),
                    )
                )
                await _log_activity(db, uid, "cv_parsed", {
                    "technical_skills": skill_count,
                    "experiences": exp_count,
                    "projects": proj_count,
                })
                _save_analysis_file(str(uid), "cv_analysis.json", parsed)
                yield _sse_event("cv_analysis", "done",
                    f"CV parsed: {skill_count} technical skills, {exp_count} experiences, {proj_count} projects",
                    {"skills": skill_count, "experiences": exp_count, "projects": proj_count})

                # --- Step 4: Proof point extraction ---
                yield _sse_event("proof_points", "in_progress", "Extracting proof points with Gemini 2.5 Flash...")
                proof_points = await extract_proof_points(parsed, cv_text)
                pp_count = len(proof_points) if proof_points else 0
                highlights = len([p for p in (proof_points or []) if p.get("highlight")])

                await db.execute(
                    update(UserProfile).where(UserProfile.user_id == uid)
                    .values(proof_points=proof_points)
                )
                await _log_activity(db, uid, "proof_points_extracted", {"count": pp_count, "highlights": highlights})
                _save_analysis_file(str(uid), "proof_points.json", proof_points)
                yield _sse_event("proof_points", "done",
                    f"Extracted {pp_count} proof points ({highlights} highlights)",
                    {"count": pp_count, "highlights": highlights})

                # --- Step 5: Knowledge base ingestion ---
                yield _sse_event("knowledge_base", "in_progress", "Building knowledge base entries...")
                await clear_user_knowledge(db, uid, source="cv")
                await clear_user_knowledge(db, uid, source="linkedin")

                kb_entries = []
                if parsed.get("skills"):
                    technical = parsed["skills"].get("technical", [])
                    if technical:
                        kb_entries.append({
                            "content": f"Technical skills: {', '.join(technical)}",
                            "category": "skills",
                            "title": "Technical Skills",
                        })
                    soft = parsed["skills"].get("soft", [])
                    if soft:
                        kb_entries.append({
                            "content": f"Soft skills: {', '.join(soft)}",
                            "category": "skills",
                            "title": "Soft Skills",
                        })

                for exp in (parsed.get("experience") or []):
                    kb_entries.append({
                        "content": f"{exp.get('role', '')} at {exp.get('company', '')} - {exp.get('description', '')}. Tech: {', '.join(exp.get('tech_used', []))}",
                        "category": "experience",
                        "title": f"{exp.get('role', '')} at {exp.get('company', '')}",
                    })

                for proj in (parsed.get("projects") or []):
                    kb_entries.append({
                        "content": f"Project: {proj.get('name', '')} - {proj.get('description', '')}. Tech: {', '.join(proj.get('tech', []))}. Context: {proj.get('context', '')}",
                        "category": "projects",
                        "title": proj.get("name", ""),
                    })

                for pp in (proof_points or []):
                    kb_entries.append({
                        "content": f"{pp.get('title', '')}: Built {pp.get('project', '')} to solve {pp.get('problem', '')}. Impact: {pp.get('impact', '')}",
                        "category": "proof_points",
                        "title": pp.get("title", ""),
                    })

                if kb_entries:
                    await bulk_ingest_knowledge(db, uid, kb_entries, source="cv")

                if linkedin_text:
                    await add_knowledge_entry(
                        db=db, user_id=uid, content=linkedin_text,
                        source="linkedin", category="profile",
                        title="LinkedIn Profile",
                    )

                total_kb = len(kb_entries) + (1 if linkedin_text else 0)
                await _log_activity(db, uid, "knowledge_base_ingested", {"entries": total_kb})
                await db.commit()
                yield _sse_event("knowledge_base", "done",
                    f"Ingested {total_kb} knowledge base entries with embeddings",
                    {"entries": total_kb})

                # --- Step 6: Save combined analysis ---
                full_analysis = {
                    "user_id": str(uid),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "cv_analysis": parsed,
                    "proof_points": proof_points,
                    "linkedin_data": linkedin_data,
                    "linkedin_text": linkedin_text or None,
                    "stats": {
                        "cv_characters": char_count,
                        "technical_skills": skill_count,
                        "experiences": exp_count,
                        "projects": proj_count,
                        "proof_points": pp_count,
                        "kb_entries": total_kb,
                    },
                }
                _save_analysis_file(str(uid), "full_analysis.json", full_analysis)
                yield _sse_event("local_save", "done", f"Analysis saved to analysis/{uid}/")

                # --- Complete ---
                yield _sse_event("complete", "done", "All processing complete", {
                    "parsed_skills": parsed.get("skills"),
                    "parsed_experience": parsed.get("experience"),
                    "parsed_projects": parsed.get("projects"),
                    "parsed_education": parsed.get("education"),
                    "proof_points": proof_points,
                })

            except Exception as e:
                yield _sse_event("error", "error", f"Processing failed: {str(e)}")

    return StreamingResponse(stream_processing(), media_type="text/event-stream")


@router.websocket("/interview/ws")
async def interview_websocket(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    from adam.interview import handle_interview_ws
    import uuid
    await handle_interview_ws(websocket, uuid.UUID(user_id), db)


@router.get("/interview/transcript", response_model=InterviewTranscriptOut | None)
async def get_interview_transcript(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewTranscript)
        .where(InterviewTranscript.user_id == user.id)
        .order_by(InterviewTranscript.created_at.desc())
        .limit(1)
    )
    transcript = result.scalar_one_or_none()
    if not transcript:
        return None
    return InterviewTranscriptOut(
        id=str(transcript.id),
        session_type=transcript.session_type,
        raw_transcript=transcript.raw_transcript,
        analyzed_qa=transcript.analyzed_qa,
        analysis_summary=transcript.analysis_summary,
        duration_seconds=transcript.duration_seconds,
        created_at=transcript.created_at,
    )


@router.post("/suggest-preferences")
async def suggest_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    skills = profile.parsed_skills or {}
    experience = profile.parsed_experience or []
    projects = profile.parsed_projects or []

    prompt = f"""Based on this person's professional profile, suggest job search preferences.

Skills: {json.dumps(skills)}
Experience (last 3): {json.dumps(experience[:3])}
Projects (last 3): {json.dumps(projects[:3])}

Return a JSON object with exactly these keys:
- "roles": list of 5-8 specific job titles they'd be a strong fit for
- "stages": list of company stages from ONLY these options: ["Seed", "Series A", "Series B", "Series C+", "Growth / Public", "Bootstrapped"]
- "sectors": list of 4-6 industry sectors that match their background

Only return valid JSON, no markdown fences, no extra text."""

    try:
        suggestions = await generate_structured(prompt)
        return suggestions
    except Exception:
        return {
            "roles": ["Software Engineer", "Full Stack Developer", "Backend Engineer"],
            "stages": ["Seed", "Series A", "Series B"],
            "sectors": ["SaaS", "FinTech", "Developer Tools"],
        }


@router.patch("/interview/answers")
async def update_interview_answers(
    req: InterviewAnswerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewTranscript)
        .where(InterviewTranscript.user_id == user.id)
        .order_by(InterviewTranscript.created_at.desc())
        .limit(1)
    )
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="No transcript found")

    from sqlalchemy import update as sql_update
    await db.execute(
        sql_update(InterviewTranscript)
        .where(InterviewTranscript.id == transcript.id)
        .values(analyzed_qa=req.analyzed_qa)
    )

    await clear_user_knowledge(db, user.id, source="interview")

    for qa in req.analyzed_qa:
        await add_knowledge_entry(
            db=db, user_id=user.id,
            content=f"Q: {qa.get('question', '')}\nA: {qa.get('answer', '')}",
            source="interview",
            category="interview_qa",
            title=qa.get("question", "")[:100],
            metadata={"key_insights": qa.get("key_insights", [])},
        )

    await db.commit()
    return {"status": "updated"}
