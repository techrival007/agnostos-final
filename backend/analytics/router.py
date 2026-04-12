from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from shared.models import User, ActivityLog
from adam.models import UserProfile
from mercury.models import OutreachEmail, Campaign
from theos.models import Company, LinkedInSignal
from analytics.schemas import AnalyticsOut, TopCampaign, LogOut
from auth.service import get_current_user

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics", response_model=AnalyticsOut)
async def get_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaigns_result = await db.execute(
        select(Campaign).where(Campaign.user_id == user.id)
    )
    campaigns = campaigns_result.scalars().all()
    campaign_ids = [c.id for c in campaigns]

    if not campaign_ids:
        return AnalyticsOut()

    emails_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.campaign_id.in_(campaign_ids))
    )
    emails = emails_result.scalars().all()

    sent = [e for e in emails if e.status in ("sent", "opened", "replied")]
    opened = [e for e in emails if e.status in ("opened", "replied")]
    replied = [e for e in emails if e.status == "replied"]
    bounced = [e for e in emails if e.status == "bounced"]
    draft = [e for e in emails if e.status == "draft"]

    total_sent = len(sent)
    open_rate = (len(opened) / total_sent * 100) if total_sent > 0 else 0
    reply_rate = (len(replied) / total_sent * 100) if total_sent > 0 else 0

    companies_count = await db.execute(select(func.count(Company.id)))
    signals_count = await db.execute(select(func.count(LinkedInSignal.id)))

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    completeness = 0.0
    if profile:
        fields = [profile.parsed_skills, profile.parsed_experience, profile.parsed_projects,
                  profile.proof_points, profile.preferred_roles, profile.location]
        completeness = sum(1 for f in fields if f) / len(fields) * 100

    active_campaigns = len([c for c in campaigns if c.status in ("queued", "active")])

    top_campaigns = []
    for c in campaigns:
        c_emails = [e for e in emails if e.campaign_id == c.id]
        c_sent = len([e for e in c_emails if e.status in ("sent", "opened", "replied")])
        c_opened = len([e for e in c_emails if e.status in ("opened", "replied")])
        c_replied = len([e for e in c_emails if e.status == "replied"])
        cn = await db.execute(select(Company.name).where(Company.id == c.company_id))
        company_name = cn.scalar_one_or_none() or "Unknown"
        if c_sent > 0:
            top_campaigns.append(TopCampaign(
                campaign_id=str(c.id), company_name=company_name,
                sent=c_sent, opened=c_opened, replied=c_replied,
                reply_rate=(c_replied / c_sent * 100) if c_sent > 0 else 0,
            ))

    top_campaigns.sort(key=lambda x: x.reply_rate, reverse=True)

    return AnalyticsOut(
        total_sent=total_sent, total_opened=len(opened), total_replied=len(replied),
        total_bounced=len(bounced), total_draft=len(draft),
        open_rate=round(open_rate, 1), reply_rate=round(reply_rate, 1),
        active_campaigns=active_campaigns,
        companies_discovered=companies_count.scalar() or 0,
        signals_detected=signals_count.scalar() or 0,
        profile_completeness=round(completeness, 1),
        top_campaigns=top_campaigns[:5],
    )


@router.get("/logs", response_model=list[LogOut])
async def get_logs(
    actor: str | None = None,
    entity_type: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ActivityLog).where(ActivityLog.user_id == user.id)

    if actor:
        query = query.where(ActivityLog.actor == actor)
    if entity_type:
        query = query.where(ActivityLog.entity_type == entity_type)

    query = query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        LogOut(
            id=str(l.id), actor=l.actor, action=l.action,
            entity_type=l.entity_type,
            entity_id=str(l.entity_id) if l.entity_id else None,
            metadata=l.metadata_, created_at=l.created_at,
        ) for l in logs
    ]
