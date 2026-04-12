from pydantic import BaseModel
from datetime import datetime
from theos.schemas import CompanyOut


class CampaignCreate(BaseModel):
    company_id: str
    tone_settings: dict | None = None


class CampaignOut(BaseModel):
    id: str
    company_id: str
    company_name: str | None = None
    status: str = "queued"
    tone_settings: dict | None = None
    created_at: datetime | None = None
    last_activity_at: datetime | None = None
    next_followup_at: datetime | None = None
    email_count: int = 0
    draft_count: int = 0
    sent_count: int = 0
    opened_count: int = 0
    replied_count: int = 0

    class Config:
        from_attributes = True


class EmailOut(BaseModel):
    id: str
    campaign_id: str
    contact_id: str
    contact_name: str | None = None
    contact_role: str | None = None
    contact_email: str | None = None
    contact_is_founder: bool = False
    contact_is_new_recruit: bool = False
    subject: str | None = None
    body: str | None = None
    subject_options: list[str] | None = None
    tone_settings: dict | None = None
    relevance_score: float | None = None
    relevant_projects: list | None = None
    hook_used: str | None = None
    status: str = "draft"
    followup_number: int = 0
    sent_at: datetime | None = None
    opened_at: datetime | None = None
    replied_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class CampaignDetailOut(BaseModel):
    campaign: CampaignOut
    emails: list[EmailOut] = []
    company: CompanyOut | None = None


class EmailUpdate(BaseModel):
    subject: str | None = None
    body: str | None = None


class FollowupOut(BaseModel):
    id: str
    followup_number: int
    scheduled_for: datetime
    status: str = "pending"
    new_signal_found: bool = False
    new_signal_content: str | None = None

    class Config:
        from_attributes = True


class PipelineColumn(BaseModel):
    status: str
    label: str
    cards: list["PipelineCard"] = []


class ContactEmailStatus(BaseModel):
    contact_id: str
    email_id: str | None = None
    campaign_id: str | None = None
    status: str = "none"
    subject: str | None = None
    body: str | None = None
    subject_options: list[str] | None = None
    relevance_score: float | None = None
    hook_used: str | None = None
    sent_at: datetime | None = None
    opened_at: datetime | None = None
    replied_at: datetime | None = None

    class Config:
        from_attributes = True


class SingleContactDraftRequest(BaseModel):
    company_id: str
    contact_id: str
    tone_settings: dict | None = None


class PipelineCard(BaseModel):
    email_id: str
    campaign_id: str
    company_name: str
    contact_name: str
    contact_role: str | None = None
    status: str
    last_activity: datetime | None = None
    next_followup: datetime | None = None
    followup_number: int = 0

    class Config:
        from_attributes = True
