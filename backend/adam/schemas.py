from pydantic import BaseModel
from datetime import datetime


class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    turn_number: int


class ConversationTurn(BaseModel):
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileOut(BaseModel):
    id: str
    parsed_skills: dict | None = None
    parsed_experience: list | None = None
    parsed_projects: list | None = None
    parsed_education: list | None = None
    proof_points: list | None = None
    soft_profile: dict | None = None
    what_they_bring: str | None = None
    preferred_roles: list[str] | None = None
    preferred_stages: list[str] | None = None
    preferred_sectors: list[str] | None = None
    location: str | None = None
    open_to_relocation: bool = False
    visa_status: str | None = None
    tone_formal: int = 5
    tone_technical: int = 5
    interview_completed: bool = False
    interview_turns: int = 0
    onboarding_completed: bool = False
    onboarding_step: int = 0

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    parsed_skills: dict | None = None
    parsed_experience: list | None = None
    parsed_projects: list | None = None
    proof_points: list | None = None
    preferred_roles: list[str] | None = None
    preferred_stages: list[str] | None = None
    preferred_sectors: list[str] | None = None
    location: str | None = None
    open_to_relocation: bool | None = None
    visa_status: str | None = None
    tone_formal: int | None = None
    tone_technical: int | None = None


class UploadResponse(BaseModel):
    parsed_skills: dict | None = None
    parsed_experience: list | None = None
    parsed_projects: list | None = None
    parsed_education: list | None = None
    proof_points: list | None = None


class InterviewStatus(BaseModel):
    interview_completed: bool
    interview_turns: int


class OnboardingStatus(BaseModel):
    onboarding_completed: bool
    onboarding_step: int
    has_cv: bool = False
    has_linkedin: bool = False
    has_interview: bool = False


class ResumeUploadRequest(BaseModel):
    linkedin_url: str | None = None


class InterviewTranscriptOut(BaseModel):
    id: str
    session_type: str
    raw_transcript: str
    analyzed_qa: list | None = None
    analysis_summary: dict | None = None
    duration_seconds: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class InterviewAnswerUpdate(BaseModel):
    analyzed_qa: list
