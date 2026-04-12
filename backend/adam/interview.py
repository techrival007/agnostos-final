import json
import logging
import uuid
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from adam.models import UserProfile, InterviewTranscript
from adam.rstt import transcribe
from adam.rtts import synthesize
from knowledge.service import add_knowledge_entry, clear_user_knowledge
from shared.gemini import chat_with_gemini, generate_structured
from config import get_settings

logger = logging.getLogger("interview")
settings = get_settings()

INTERVIEW_QUESTIONS = [
    "Give me your professional story in a nutshell -- what's the thread that connects your career?",
    "What accomplishment are you most proud of, and what made it meaningful to you?",
    "What kind of work environment brings out the best in you?",
    "Walk me through a tough problem you solved -- what was your approach?",
    "Where do you see your career heading in the next 2-3 years?",
    "What skills or areas are you actively developing right now?",
    "What truly motivates you in your professional life beyond the paycheck?",
    "How would your closest colleagues describe your working style?",
    "What industries or company types excite you most, and why?",
    "What's something unique about you that never shows up on a resume?",
]

INTERVIEW_SYSTEM_PROMPT = """
You are Adam conducting a 10-minute professional get-to-know-you interview.
You have a set of guiding questions but should adapt naturally based on answers.

Your current question framework:
{questions}

Current question number: {current_q} of {total_q}

Rules:
- Ask ONE question at a time
- Keep responses under 2 sentences + the question
- If they say something interesting, briefly acknowledge before the next question
- Be warm and genuine, not robotic
- Adapt follow-ups based on their answers
- Do NOT repeat questions already asked
- When all questions are done, thank them warmly and say the interview is complete

Previous conversation:
{history}
"""


async def _generate_adam_reply(conversation_history, current_question, total_questions, user_text=None):
    if not settings.gemini_api_key:
        return INTERVIEW_QUESTIONS[min(current_question - 1, len(INTERVIEW_QUESTIONS) - 1)]

    history_str = "\n".join(f"{h['role']}: {h['content']}" for h in conversation_history)

    if current_question > total_questions:
        system = (
            f"The interview is COMPLETE. All {total_questions} questions have been answered. "
            "Thank the user warmly and naturally. Keep it to 2 sentences.\n\n"
            f"Conversation so far:\n{history_str}"
        )
    else:
        system = INTERVIEW_SYSTEM_PROMPT.format(
            questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(INTERVIEW_QUESTIONS)),
            current_q=current_question, total_q=total_questions,
            history=history_str
        )

    messages = [{"role": "user", "content": user_text or "Start the interview."}]
    return await chat_with_gemini(system, messages, model_name="gemini-2.5-flash")


async def _send_adam_turn(websocket, text, question_number, total_questions, is_complete=False):
    """Generate TTS via rtts.synthesize, send JSON metadata + audio bytes."""
    msg_type = "interview_complete" if is_complete else "adam_response"
    audio_bytes = None

    if settings.deepgram_api_key:
        try:
            audio_bytes = await synthesize(text)
        except Exception as e:
            logger.error(f"[RTTS] synthesis failed: {e}")

    payload = {
        "type": msg_type,
        "text": text,
        "question_number": question_number,
        "total_questions": total_questions,
        "has_audio": audio_bytes is not None,
    }

    await websocket.send_json(payload)

    if audio_bytes:
        await websocket.send_bytes(audio_bytes)


async def handle_interview_ws(websocket: WebSocket, user_id: uuid.UUID, db: AsyncSession):
    await websocket.accept()
    logger.info(f"[interview] ws connected for user {user_id}")

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    conversation_history = []
    transcript_parts = []
    current_question = 0
    total_questions = len(INTERVIEW_QUESTIONS)

    try:
        # Opening turn - Adam speaks first
        opening = INTERVIEW_QUESTIONS[0]
        if settings.gemini_api_key:
            context = ""
            if profile and profile.parsed_skills:
                context = f"\nYou know about them: Skills: {profile.parsed_skills}"
            messages = [{"role": "user", "content": "Start the interview."}]
            system = INTERVIEW_SYSTEM_PROMPT.format(
                questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(INTERVIEW_QUESTIONS)),
                current_q=1, total_q=total_questions,
                history="(just starting)"
            ) + context
            opening = await chat_with_gemini(system, messages, model_name="gemini-2.5-flash")

        conversation_history.append({"role": "adam", "content": opening})
        transcript_parts.append(f"Adam: {opening}")
        await _send_adam_turn(websocket, opening, 1, total_questions)
        current_question = 1

        # Main interview loop: receive audio → rstt.transcribe → reply → rtts.synthesize
        while True:
            data = await websocket.receive()
            user_text = ""

            if "bytes" in data and data["bytes"]:
                audio_data = data["bytes"]

                if len(audio_data) < 5_000:
                    logger.debug(f"[RSTT] ignoring tiny chunk: {len(audio_data)} bytes")
                    continue

                if not settings.deepgram_api_key:
                    await websocket.send_json({"type": "error", "message": "Deepgram not configured"})
                    continue

                try:
                    user_text = await transcribe(audio_data)
                except Exception as e:
                    logger.error(f"[RSTT] transcription failed: {e}")
                    await websocket.send_json({"type": "error", "message": f"Transcription failed: {str(e)}"})
                    continue

                if not user_text.strip():
                    await websocket.send_json({"type": "no_speech"})
                    continue

                await websocket.send_json({"type": "transcript", "text": user_text})

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])
                if msg.get("type") == "end_interview":
                    break
                else:
                    continue
            else:
                continue

            if not user_text.strip():
                continue

            conversation_history.append({"role": "user", "content": user_text})
            transcript_parts.append(f"User: {user_text}")
            current_question += 1
            logger.info(f"[interview] Q{current_question}/{total_questions} user: '{user_text[:60]}'")

            if current_question > total_questions:
                closing = await _generate_adam_reply(
                    conversation_history, current_question, total_questions, user_text
                )
                conversation_history.append({"role": "adam", "content": closing})
                transcript_parts.append(f"Adam: {closing}")
                await _send_adam_turn(websocket, closing, current_question, total_questions, is_complete=True)
                break

            adam_reply = await _generate_adam_reply(
                conversation_history, current_question, total_questions, user_text
            )
            conversation_history.append({"role": "adam", "content": adam_reply})
            transcript_parts.append(f"Adam: {adam_reply}")
            await _send_adam_turn(websocket, adam_reply, current_question, total_questions)

    except WebSocketDisconnect:
        logger.info(f"[interview] ws disconnected for user {user_id}")
    except Exception as e:
        logger.error(f"[interview] error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

    # Save transcript & analysis
    raw_transcript = "\n".join(transcript_parts)
    if not raw_transcript.strip():
        return

    analyzed_qa = None
    analysis_summary = None

    if settings.gemini_api_key and len(conversation_history) > 2:
        try:
            analysis_prompt = f"""
            Analyze this interview transcript and extract structured Q&A pairs.
            Return ONLY valid JSON:
            {{
                "qa_pairs": [
                    {{
                        "question": "the question asked",
                        "answer": "the user's answer",
                        "key_insights": ["insight1", "insight2"]
                    }}
                ],
                "summary": {{
                    "personality_traits": ["trait1", "trait2"],
                    "career_goals": ["goal1", "goal2"],
                    "unique_strengths": ["strength1", "strength2"],
                    "communication_style": "description",
                    "ideal_role_type": "description",
                    "key_motivators": ["motivator1", "motivator2"]
                }}
            }}

            Transcript:
            {raw_transcript[:6000]}
            """
            analysis = await generate_structured(analysis_prompt)
            analyzed_qa = analysis.get("qa_pairs", [])
            analysis_summary = analysis.get("summary", {})
        except Exception as e:
            logger.error(f"[interview] analysis failed: {e}")

    transcript = InterviewTranscript(
        user_id=user_id,
        session_type="onboarding",
        raw_transcript=raw_transcript,
        analyzed_qa=analyzed_qa,
        analysis_summary=analysis_summary,
    )
    db.add(transcript)

    if analyzed_qa:
        await clear_user_knowledge(db, user_id, source="interview")
        for qa in analyzed_qa:
            await add_knowledge_entry(
                db=db, user_id=user_id,
                content=f"Q: {qa['question']}\nA: {qa['answer']}",
                source="interview",
                category="interview_qa",
                title=qa["question"][:100],
                metadata={"key_insights": qa.get("key_insights", [])},
            )

        if analysis_summary:
            for trait in analysis_summary.get("personality_traits", []):
                await add_knowledge_entry(
                    db=db, user_id=user_id,
                    content=trait, source="interview",
                    category="personality", title="Personality Trait",
                )
            for goal in analysis_summary.get("career_goals", []):
                await add_knowledge_entry(
                    db=db, user_id=user_id,
                    content=goal, source="interview",
                    category="goals", title="Career Goal",
                )
            for strength in analysis_summary.get("unique_strengths", []):
                await add_knowledge_entry(
                    db=db, user_id=user_id,
                    content=strength, source="interview",
                    category="skills", title="Unique Strength",
                )

    await db.execute(
        update(UserProfile)
        .where(UserProfile.user_id == user_id)
        .values(
            interview_completed=True,
            interview_turns=len([h for h in conversation_history if h["role"] == "user"]),
            soft_profile=analysis_summary,
        )
    )
    await db.commit()
    logger.info(f"[interview] saved transcript for user {user_id}, {len(conversation_history)} turns")
