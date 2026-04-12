import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    raw_cv_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_linkedin_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    cv_file_url: Mapped[str | None] = mapped_column(String, nullable=True)

    parsed_skills: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    parsed_experience: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    parsed_projects: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    parsed_education: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    proof_points: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    soft_profile: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    what_they_bring: Mapped[str | None] = mapped_column(Text, nullable=True)

    preferred_roles: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    preferred_stages: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    preferred_sectors: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    open_to_relocation: Mapped[bool] = mapped_column(Boolean, default=False)
    visa_status: Mapped[str | None] = mapped_column(String, nullable=True)

    tone_formal: Mapped[int] = mapped_column(Integer, default=5)
    tone_technical: Mapped[int] = mapped_column(Integer, default=5)

    interview_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    interview_turns: Mapped[int] = mapped_column(Integer, default=0)

    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="profile")


class AdamConversation(Base):
    __tablename__ = "adam_conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="conversations")


class InterviewTranscript(Base):
    __tablename__ = "interview_transcripts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    session_type: Mapped[str] = mapped_column(String, nullable=False, default="onboarding")
    raw_transcript: Mapped[str] = mapped_column(Text, nullable=False, default="")
    analyzed_qa: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    analysis_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="interview_transcripts")
