"""
Mercury Nylas service: Gmail / Outlook OAuth + email sending + webhook tracking.

If NYLAS_API_KEY is not set, send operations simulate a send and mark the
email as "sent" so the rest of the pipeline (follow-up scheduling, pipeline
view) still works during local development.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from config import get_settings
from shared.models import User, ActivityLog
from mercury.models import Campaign, OutreachEmail, FollowupSchedule
from theos.models import Contact

settings = get_settings()
log = logging.getLogger("mercury.nylas")


def _get_nylas_client():
    if not settings.nylas_api_key:
        log.debug("NYLAS_API_KEY not set — Nylas disabled")
        return None
    try:
        from nylas import Client  # type: ignore[import-untyped]
        return Client(
            api_key=settings.nylas_api_key,
            api_uri=settings.nylas_api_uri,
        )
    except ImportError:
        log.warning("nylas package not installed — pip install nylas")
        return None


# ---------------------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------------------

def get_nylas_auth_url(user_id: str, redirect_uri: str) -> str | None:
    """Return the Nylas OAuth URL the user visits to connect their inbox."""
    client = _get_nylas_client()
    if not client or not settings.nylas_client_id:
        return None
    try:
        from nylas.models.auth import URLForAuthenticationConfig  # type: ignore[import-untyped]
        config = URLForAuthenticationConfig({
            "client_id": settings.nylas_client_id,
            "redirect_uri": redirect_uri,
            "state": user_id,
        })
        return client.auth.url_for_oauth2(config)
    except Exception:
        return None


async def exchange_nylas_code(
    db: AsyncSession,
    user: User,
    code: str,
    redirect_uri: str,
) -> str | None:
    """Exchange OAuth code for a Nylas grant_id and persist it on the user."""
    client = _get_nylas_client()
    if not client:
        return None
    try:
        from nylas.models.auth import CodeExchangeRequest  # type: ignore[import-untyped]
        exchange = client.auth.exchange_code_for_token(
            CodeExchangeRequest({"redirect_uri": redirect_uri, "code": code})
        )
        grant_id: str = exchange.grant_id
        await db.execute(
            update(User).where(User.id == user.id).values(nylas_grant_id=grant_id)
        )
        await db.commit()
        return grant_id
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------

async def send_outreach_email(
    db: AsyncSession,
    user: User,
    outreach_email_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Send a single approved OutreachEmail via Nylas (or simulate if unconfigured).

    Returns a dict with at minimum {"status": "sent"|"error", ...}.
    """
    email_result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.id == outreach_email_id)
    )
    email = email_result.scalar_one_or_none()
    if not email:
        return {"status": "error", "detail": "Email not found"}
    if email.status != "approved":
        return {"status": "error", "detail": f"Email status is '{email.status}', must be 'approved' to send"}

    contact_result = await db.execute(select(Contact).where(Contact.id == email.contact_id))
    contact = contact_result.scalar_one_or_none()
    if not contact:
        return {"status": "error", "detail": "Contact not found"}

    recipient_email = contact.professional_email or contact.personal_email
    if not recipient_email:
        return {"status": "error", "detail": "No email address on file for this contact"}

    now = datetime.now(timezone.utc)
    client = _get_nylas_client()

    if not client:
        # Nylas SDK not available at all — simulate for local dev only
        log.warning("Simulated send for email %s — Nylas not installed/configured", outreach_email_id)
        await db.execute(
            update(OutreachEmail)
            .where(OutreachEmail.id == outreach_email_id)
            .values(status="sent", sent_at=now)
        )
        await db.commit()
        return {
            "status": "sent",
            "message_id": None,
            "note": "Nylas not configured — simulated send only",
        }

    if not user.nylas_grant_id:
        return {
            "status": "error",
            "detail": "Connect your email inbox before sending. Use the Nylas connect button to link Gmail or Outlook.",
            "code": "NYLAS_NOT_CONNECTED",
        }

    # Nylas SDK is synchronous — run in a thread to avoid blocking the event loop
    def _do_send() -> Any:
        return client.messages.send(
            identifier=user.nylas_grant_id,
            request_body={
                "to": [{"name": contact.name, "email": recipient_email}],
                "subject": email.subject or "",
                "body": email.body or "",
                "reply_to": [{"name": user.name or "", "email": user.email}],
                "tracking_options": {"opens": True, "thread_replies": True},
            },
        )

    try:
        message = await asyncio.to_thread(_do_send)
        message_id = getattr(message, "id", None)
        thread_id = getattr(message, "thread_id", None)
        log.info(
            "Email sent via Nylas — email_id=%s message_id=%s thread_id=%s to=%s",
            outreach_email_id, message_id, thread_id, recipient_email,
        )
    except Exception as exc:
        log.error("Nylas send failed for email %s: %s", outreach_email_id, exc)
        return {"status": "error", "detail": str(exc)}

    await db.execute(
        update(OutreachEmail)
        .where(OutreachEmail.id == outreach_email_id)
        .values(
            status="sent",
            sent_at=now,
            thread_id=thread_id,
            message_id=message_id,
        )
    )

    activity = ActivityLog(
        user_id=user.id,
        actor="mercury",
        action="email_sent",
        entity_type="email",
        entity_id=outreach_email_id,
        metadata_={"contact": contact.name, "to": recipient_email},
    )
    db.add(activity)
    await db.commit()
    return {"status": "sent", "message_id": message_id, "thread_id": thread_id}


# ---------------------------------------------------------------------------
# Webhook processing
# ---------------------------------------------------------------------------

async def process_nylas_webhook(db: AsyncSession, payload: dict) -> None:
    """
    Handle Nylas webhook events for open tracking and reply detection.

    Expected payload shape (Nylas v3):
    {
      "data": {
        "payload": [
          { "type": "message.opened"|"message.created", "data": { "thread_id": "..." } }
        ]
      }
    }
    """
    notifications: list[dict] = (
        (payload.get("data") or {}).get("payload") or []
    )

    for notification in notifications:
        event_type: str = notification.get("type", "")
        data: dict = notification.get("data") or {}
        thread_id: str | None = data.get("thread_id")

        if not thread_id:
            continue

        if event_type == "message.opened":
            await db.execute(
                update(OutreachEmail)
                .where(
                    OutreachEmail.thread_id == thread_id,
                    OutreachEmail.status == "sent",
                )
                .values(status="opened", opened_at=datetime.now(timezone.utc))
            )
            await db.commit()

        elif event_type == "message.created":
            email_result = await db.execute(
                select(OutreachEmail).where(OutreachEmail.thread_id == thread_id)
            )
            original = email_result.scalar_one_or_none()
            if not original or original.status == "replied":
                continue

            original.status = "replied"
            original.replied_at = datetime.now(timezone.utc)

            # Cancel any pending follow-ups for this thread
            await db.execute(
                update(FollowupSchedule)
                .where(
                    FollowupSchedule.outreach_email_id == original.id,
                    FollowupSchedule.status == "pending",
                )
                .values(status="cancelled")
            )

            # Resolve the campaign's user_id for the activity log
            campaign_result = await db.execute(
                select(Campaign).where(Campaign.id == original.campaign_id)
            )
            campaign = campaign_result.scalar_one_or_none()
            if campaign:
                log = ActivityLog(
                    user_id=campaign.user_id,
                    actor="mercury",
                    action="reply_received",
                    entity_type="email",
                    entity_id=original.id,
                    metadata_={"thread_id": thread_id},
                )
                db.add(log)

            await db.commit()
