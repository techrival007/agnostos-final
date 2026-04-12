import uuid
from datetime import date, datetime
from sqlalchemy import String, Integer, BigInteger, Float, Boolean, Date, DateTime, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String, nullable=True)

    stage: Mapped[str | None] = mapped_column(String, nullable=True)
    funding_amount_usd: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    funding_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    investors: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    sector: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    hq_location: Mapped[str | None] = mapped_column(String, nullable=True)
    headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tech_stack: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    hiring_score: Mapped[int] = mapped_column(Integer, default=0)
    hiring_score_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    last_researched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    research_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped[str | None] = mapped_column(String, nullable=True)
    source_batch: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    research: Mapped["CompanyResearch"] = relationship(back_populates="company", uselist=False, lazy="selectin")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="company", lazy="selectin")
    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="company", lazy="selectin")
    signals: Mapped[list["LinkedInSignal"]] = relationship(back_populates="company", lazy="selectin")


class CompanyResearch(Base):
    __tablename__ = "company_research"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), unique=True)

    recent_news: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    blog_posts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    founder_posts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    product_updates: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    job_postings: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="research")


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"))

    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    seniority: Mapped[str | None] = mapped_column(String, nullable=True)

    linkedin_url: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    linkedin_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    professional_email: Mapped[str | None] = mapped_column(String, nullable=True)
    personal_email: Mapped[str | None] = mapped_column(String, nullable=True)
    email_confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    email_source: Mapped[str | None] = mapped_column(String, nullable=True)

    is_new_recruit: Mapped[bool] = mapped_column(Boolean, default=False)
    tenure_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_founder: Mapped[bool] = mapped_column(Boolean, default=False)

    recent_posts: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    last_enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="contacts")
    emails: Mapped[list["OutreachEmail"]] = relationship(back_populates="contact", lazy="selectin")


class LinkedInSignal(Base):
    __tablename__ = "linkedin_signals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_url: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    post_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    author_name: Mapped[str | None] = mapped_column(String, nullable=True)
    author_linkedin: Mapped[str | None] = mapped_column(String, nullable=True)

    signal_type: Mapped[str | None] = mapped_column(String, nullable=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company | None"] = relationship(back_populates="signals")


class JobListing(Base):
    __tablename__ = "job_listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)

    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    location: Mapped[str | None] = mapped_column(String, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String, nullable=True)
    experience_required: Mapped[str | None] = mapped_column(String, nullable=True)
    remote_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    source: Mapped[str | None] = mapped_column(String, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class JobListingRelevance(Base):
    __tablename__ = "job_listing_relevance"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    job_listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_listings.id", ondelete="CASCADE"), primary_key=True)
    relevance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GithubJobListing(Base):
    __tablename__ = "github_job_listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company: Mapped[str] = mapped_column(String, nullable=False)
    company_url: Mapped[str | None] = mapped_column(String, nullable=True)
    position: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    salary: Mapped[str | None] = mapped_column(String, nullable=True)
    apply_url: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    posted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    job_type: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str] = mapped_column(String, nullable=False)
    source_repo: Mapped[str] = mapped_column(String, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SearchJob(Base):
    __tablename__ = "search_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String, default="pending")
    parameters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_path: Mapped[str | None] = mapped_column(String, nullable=True)
    companies_found: Mapped[int] = mapped_column(Integer, default=0)
    langgraph_thread_id: Mapped[str | None] = mapped_column(String, nullable=True)
    langgraph_run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
