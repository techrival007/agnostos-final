from pydantic import BaseModel
from datetime import date, datetime


class CompanyOut(BaseModel):
    id: str
    name: str
    website: str | None = None
    linkedin_url: str | None = None
    stage: str | None = None
    funding_amount_usd: int | None = None
    funding_date: date | None = None
    investors: list[str] | None = None
    sector: list[str] | None = None
    hq_location: str | None = None
    headcount: int | None = None
    tech_stack: list[str] | None = None
    hiring_score: int = 0
    research_summary: str | None = None
    source: str | None = None
    source_batch: str | None = None
    contact_count: int = 0
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class CompanyResearchOut(BaseModel):
    recent_news: list | None = None
    blog_posts: list | None = None
    founder_posts: list | None = None
    product_updates: list | None = None
    job_postings: list | None = None

    class Config:
        from_attributes = True


class ContactOut(BaseModel):
    id: str
    name: str
    role: str | None = None
    seniority: str | None = None
    linkedin_url: str | None = None
    professional_email: str | None = None
    personal_email: str | None = None
    email_confidence_score: float | None = None
    is_new_recruit: bool = False
    tenure_months: int | None = None
    is_founder: bool = False
    recent_posts: list | None = None

    class Config:
        from_attributes = True


class CompanyDetailOut(BaseModel):
    company: CompanyOut
    research: CompanyResearchOut | None = None
    contacts: list[ContactOut] = []


class SignalOut(BaseModel):
    id: str
    post_url: str | None = None
    post_content: str | None = None
    author_name: str | None = None
    author_linkedin: str | None = None
    signal_type: str | None = None
    company_name: str | None = None
    company_id: str | None = None
    resolved: bool = False
    detected_at: datetime | None = None

    class Config:
        from_attributes = True


class JobListingOut(BaseModel):
    id: str
    title: str
    url: str
    description: str | None = None
    location: str | None = None
    employment_type: str | None = None
    remote_ok: bool | None = None
    source: str | None = None
    posted_at: datetime | None = None
    company_name: str | None = None

    class Config:
        from_attributes = True


class DeepSearchParams(BaseModel):
    company_count: int = 10
    location: str = "Any"
    recency: str = "3 months"
    sector: str = "Any"


class SearchJobOut(BaseModel):
    id: str
    status: str
    parameters: dict | None = None
    result_summary: str | None = None
    companies_found: int = 0
    error_message: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True
