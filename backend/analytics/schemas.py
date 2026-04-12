from pydantic import BaseModel
from datetime import datetime


class AnalyticsOut(BaseModel):
    total_sent: int = 0
    total_opened: int = 0
    total_replied: int = 0
    total_bounced: int = 0
    total_draft: int = 0
    open_rate: float = 0.0
    reply_rate: float = 0.0
    active_campaigns: int = 0
    companies_discovered: int = 0
    signals_detected: int = 0
    profile_completeness: float = 0.0
    daily_sends: list["DailySend"] = []
    top_campaigns: list["TopCampaign"] = []


class DailySend(BaseModel):
    date: str
    count: int


class TopCampaign(BaseModel):
    campaign_id: str
    company_name: str
    sent: int
    opened: int
    replied: int
    reply_rate: float


class LogOut(BaseModel):
    id: str
    actor: str
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    metadata: dict | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
