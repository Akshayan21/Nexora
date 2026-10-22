import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, current_principal
from app.database import get_session
from app.models import (
    AuditEvent,
    Campaign,
    CampaignLead,
    CampaignStep,
    Contact,
    Message,
    SuppressionEntry,
)
from app.schemas.campaigns import CampaignInput, CampaignUpdate

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def get_campaign(session, principal, campaign_id, lock=False):
    query = select(Campaign).where(
        Campaign.id == campaign_id, Campaign.workspace_id == principal.workspace_id
    )
    if lock:
        query = query.with_for_update()
    campaign = session.scalar(query)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    return campaign


def overview(session, c):
    count = session.scalar(
        select(func.count())
        .select_from(CampaignLead)
        .where(CampaignLead.workspace_id == c.workspace_id, CampaignLead.campaign_id == c.id)
    )
    sent = session.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.workspace_id == c.workspace_id,
            Message.campaign_id == c.id,
            Message.status == "sent",
        )
    )
    replies = session.scalar(
        select(func.count())
        .select_from(CampaignLead)
        .where(
            CampaignLead.workspace_id == c.workspace_id,
            CampaignLead.campaign_id == c.id,
            CampaignLead.state == "replied",
        )
    )
    return {
        "id": c.id,
        "name": c.name,
        "audience": c.audience,
        "objective": c.objective,
        "state": c.state,
        "version": c.version,
        "created_at": c.created_at,
        "recipient_count": count,
        "sent": sent,
        "replies": replies,
    }


def details(session, c):
    result = overview(session, c)
    steps = session.scalars(
        select(CampaignStep)
        .where(CampaignStep.workspace_id == c.workspace_id, CampaignStep.campaign_id == c.id)
        .order_by(CampaignStep.position)
    ).all()
    recipients = session.execute(
        select(Contact, CampaignLead)
        .join(
            CampaignLead,
            (Contact.id == CampaignLead.contact_id)
            & (Contact.workspace_id == CampaignLead.workspace_id),
        )
        .where(CampaignLead.campaign_id == c.id, CampaignLead.workspace_id == c.workspace_id)
        .order_by(Contact.name)
    ).all()
    activity = session.scalars(
        select(AuditEvent)
        .where(
            AuditEvent.workspace_id == c.workspace_id,
            AuditEvent.metadata_json["campaign_id"].astext == str(c.id),
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(20)
    ).all()
    result.update(
        {
            "schedule": c.settings_json,
            "steps": [
                {
                    "id": s.id,
                    "subject": s.subject,
                    "body": s.instructions,
                    "delay_days": s.delay_seconds // 86400,
                }
                for s in steps
            ],
            "recipients": [
                {
                    "id": contact.id,
                    "name": contact.name,
                    "email": contact.email,
                    "state": enrollment.state,
                }
                for contact, enrollment in recipients
            ],
            "activity": [{"action": a.action, "created_at": a.created_at} for a in activity],
            "sending_enabled": False,
            "blockers": [
                "Gmail sending is not connected",
                "Campaign worker and message dispatch are not implemented",
            ]
            + (["Add approved recipients"] if not recipients else []),
        }
    )
    return result


def validate_contacts(session, principal, ids):
    contacts = session.scalars(
        select(Contact)
        .where(Contact.workspace_id == principal.workspace_id, Contact.id.in_(ids))
        .order_by(Contact.id)
        .with_for_update()
    ).all()
    if len(contacts) != len(ids):
        raise HTTPException(404, "One or more recipients were not found")
    if any(c.approved_at is None for c in contacts):
        raise HTTPException(409, "Only approved contacts can be added")
    suppressed = set(
        session.scalars(
            select(SuppressionEntry.normalized_email).where(
                SuppressionEntry.workspace_id == principal.workspace_id
            )
        )
    )
    if any(
        c.email_status in ("invalid", "bounced")
        or (c.email and c.email.lower().strip() in suppressed)
        for c in contacts
    ):
        raise HTTPException(409, "Suppressed or invalid contacts cannot be added")
    return contacts


def save_content(session, c, payload, contacts):
    c.name, c.audience, c.objective = payload.name, payload.audience, payload.objective
    c.settings_json = payload.schedule.model_dump(mode="json")
    session.execute(
        delete(CampaignStep).where(
            CampaignStep.campaign_id == c.id, CampaignStep.workspace_id == c.workspace_id
        )
    )
    session.execute(
        delete(CampaignLead).where(
            CampaignLead.campaign_id == c.id, CampaignLead.workspace_id == c.workspace_id
        )
    )
    for i, step in enumerate(payload.steps):
        session.add(
            CampaignStep(
                workspace_id=c.workspace_id,
                campaign_id=c.id,
                position=i,
                delay_seconds=step.delay_days * 86400,
                instructions=step.body,
                subject=step.subject,
            )
        )
    for contact in contacts:
        session.add(
            CampaignLead(
                workspace_id=c.workspace_id,
                campaign_id=c.id,
                contact_id=contact.id,
                state="approved",
                approved_at=contact.approved_at,
            )
        )


@router.get("")
def list_campaigns(
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    query = select(Campaign).where(Campaign.workspace_id == principal.workspace_id)
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    rows = session.scalars(
        query.order_by(Campaign.created_at.desc(), Campaign.id).limit(limit).offset(offset)
    ).all()
    return {"items": [overview(session, c) for c in rows], "total": total}


@router.post("", status_code=201)
def create_campaign(
    payload: CampaignInput,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=1, max_length=100),
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    digest = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    lock = int.from_bytes(
        hashlib.sha256(f"campaign:{principal.workspace_id}:{idempotency_key}".encode()).digest()[
            :8
        ],
        "big",
        signed=True,
    )
    session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
    existing = session.scalar(
        select(Campaign).where(
            Campaign.workspace_id == principal.workspace_id,
            Campaign.client_request_id == idempotency_key,
        )
    )
    if existing:
        if existing.request_hash != digest:
            raise HTTPException(409, "Idempotency key reused with a different request")
        return details(session, existing)
    contacts = validate_contacts(session, principal, payload.contact_ids)
    campaign = Campaign(
        workspace_id=principal.workspace_id,
        name=payload.name,
        audience=payload.audience,
        objective=payload.objective,
        state="draft",
        settings_json={},
        client_request_id=idempotency_key,
        request_hash=digest,
    )
    session.add(campaign)
    session.flush()
    save_content(session, campaign, payload, contacts)
    session.add(
        AuditEvent(
            workspace_id=principal.workspace_id,
            actor_id=principal.user_id,
            action="campaign.created",
            metadata_json={"campaign_id": str(campaign.id)},
        )
    )
    session.flush()
    result = details(session, campaign)
    session.commit()
    return result


@router.get("/{campaign_id}")
def get_details(
    campaign_id: UUID,
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    return details(session, get_campaign(session, principal, campaign_id))


@router.put("/{campaign_id}")
def edit_campaign(
    campaign_id: UUID,
    payload: CampaignUpdate,
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    campaign = get_campaign(session, principal, campaign_id, True)
    if campaign.version != payload.expected_version:
        raise HTTPException(409, "Campaign changed in another session. Reload it before saving.")
    has_messages = session.scalar(
        select(Message.id)
        .where(Message.workspace_id == principal.workspace_id, Message.campaign_id == campaign.id)
        .limit(1)
    )
    if campaign.state not in ("draft", "paused") or has_messages:
        raise HTTPException(409, "Only unsent draft or paused campaigns can be edited")
    contacts = validate_contacts(session, principal, payload.contact_ids)
    save_content(session, campaign, payload, contacts)
    campaign.version += 1
    session.add(
        AuditEvent(
            workspace_id=principal.workspace_id,
            actor_id=principal.user_id,
            action="campaign.updated",
            metadata_json={"campaign_id": str(campaign.id), "version": campaign.version},
        )
    )
    session.flush()
    result = details(session, campaign)
    session.commit()
    return result
