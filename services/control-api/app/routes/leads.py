import hashlib
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, or_, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, current_principal
from app.database import get_session
from app.models import AuditEvent, Company, Contact, ContactEvidence, SuppressionEntry
from app.schemas.leads import (
    ApprovalResult,
    ApproveLeads,
    EvidenceOut,
    LeadCreate,
    LeadDetail,
    LeadOut,
    LeadPage,
)

router = APIRouter(prefix="/leads", tags=["leads"])


def serialize(contact: Contact, company: Company | None) -> LeadOut:
    return LeadOut(
        id=contact.id,
        name=contact.name,
        title=contact.title,
        email=contact.email,
        email_status=contact.email_status,
        company_id=contact.company_id,
        company_name=company.name if company else None,
        company_domain=company.domain if company else None,
        approved_at=contact.approved_at,
        status="approved" if contact.approved_at else "needs_review",
        created_at=contact.created_at,
    )


def detail(session: Session, contact: Contact) -> LeadDetail:
    company = session.scalar(
        select(Company).where(
            Company.id == contact.company_id, Company.workspace_id == contact.workspace_id
        )
    )
    evidence = session.scalars(
        select(ContactEvidence)
        .where(
            ContactEvidence.workspace_id == contact.workspace_id,
            ContactEvidence.contact_id == contact.id,
        )
        .order_by(ContactEvidence.observed_at.desc(), ContactEvidence.id)
    ).all()
    return LeadDetail(
        **serialize(contact, company).model_dump(),
        evidence=[EvidenceOut.model_validate(e) for e in evidence],
    )


@router.get("", response_model=LeadPage)
def list_leads(
    query: str = Query(default="", max_length=200),
    status: Literal["approved", "needs_review"] | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    conditions = [Contact.workspace_id == principal.workspace_id]
    if status == "approved":
        conditions.append(Contact.approved_at.is_not(None))
    elif status == "needs_review":
        conditions.append(Contact.approved_at.is_(None))
    if query.strip():
        pattern = "%" + query.strip().replace("/", "//").replace("%", "/%").replace("_", "/_") + "%"
        conditions.append(
            or_(
                Contact.name.ilike(pattern, escape="/"),
                Contact.title.ilike(pattern, escape="/"),
                Company.name.ilike(pattern, escape="/"),
            )
        )
    joined = select(Contact, Company).outerjoin(
        Company, (Company.id == Contact.company_id) & (Company.workspace_id == Contact.workspace_id)
    )
    statement = joined.where(*conditions)
    total = session.scalar(select(func.count()).select_from(statement.subquery()))
    rows = session.execute(
        statement.order_by(Contact.created_at.desc(), Contact.id).limit(limit).offset(offset)
    ).all()
    return LeadPage(
        items=[serialize(c, co) for c, co in rows], total=total, limit=limit, offset=offset
    )


@router.post("", response_model=LeadDetail, status_code=201)
def create_lead(
    payload: LeadCreate,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=1, max_length=100),
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    digest = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    # Serialize retries within this workspace without exposing keys or contact data in logs.
    lock = int.from_bytes(
        hashlib.sha256(f"{principal.workspace_id}:{idempotency_key}".encode()).digest()[:8],
        "big",
        signed=True,
    )
    session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
    existing = session.scalar(
        select(Contact).where(
            Contact.workspace_id == principal.workspace_id,
            Contact.client_request_id == idempotency_key,
        )
    )
    if existing:
        if existing.request_hash != digest:
            raise HTTPException(409, "Idempotency key already used with a different request")
        return detail(session, existing)
    company_id = session.scalar(
        insert(Company)
        .values(
            workspace_id=principal.workspace_id,
            domain=payload.company_domain,
            name=payload.company_name,
        )
        .on_conflict_do_nothing(index_elements=[Company.workspace_id, Company.domain])
        .returning(Company.id)
    )
    if company_id is None:
        company_id = session.scalar(
            select(Company.id).where(
                Company.workspace_id == principal.workspace_id,
                Company.domain == payload.company_domain,
            )
        )
    contact = Contact(
        workspace_id=principal.workspace_id,
        company_id=company_id,
        name=payload.name,
        title=payload.title,
        email=payload.email,
        email_status="unknown",
        client_request_id=idempotency_key,
        request_hash=digest,
    )
    session.add(contact)
    session.flush()
    for evidence in payload.evidence:
        values = evidence.model_dump()
        values["source_url"] = str(evidence.source_url)
        session.add(
            ContactEvidence(workspace_id=principal.workspace_id, contact_id=contact.id, **values)
        )
    session.add(
        AuditEvent(
            workspace_id=principal.workspace_id,
            actor_id=principal.user_id,
            action="lead.created",
            metadata_json={"contact_id": str(contact.id)},
        )
    )
    session.flush()
    result = detail(session, contact)
    session.commit()
    return result


@router.post("/approve", response_model=ApprovalResult)
def approve_leads(
    payload: ApproveLeads,
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    contacts = session.scalars(
        select(Contact)
        .where(Contact.workspace_id == principal.workspace_id, Contact.id.in_(payload.contact_ids))
        .order_by(Contact.id)
        .with_for_update()
    ).all()
    if len(contacts) != len(payload.contact_ids):
        raise HTTPException(404, "One or more leads were not found")
    ids_with_evidence = set(
        session.scalars(
            select(ContactEvidence.contact_id).where(
                ContactEvidence.workspace_id == principal.workspace_id,
                ContactEvidence.contact_id.in_(payload.contact_ids),
            )
        )
    )
    suppressed = set(
        session.scalars(
            select(SuppressionEntry.normalized_email).where(
                SuppressionEntry.workspace_id == principal.workspace_id,
                SuppressionEntry.normalized_email.in_(
                    [c.email.strip().lower() for c in contacts if c.email]
                ),
            )
        )
    )
    if any(c.id not in ids_with_evidence for c in contacts):
        raise HTTPException(409, "All leads must have source evidence before approval")
    if any(
        c.email_status in ("invalid", "bounced")
        or (c.email and c.email.strip().lower() in suppressed)
        for c in contacts
    ):
        raise HTTPException(409, "Suppressed or invalid contacts cannot be approved")
    changed = 0
    now = datetime.now(UTC)
    for contact in contacts:
        if contact.approved_at is None:
            contact.approved_at, contact.approved_by = now, principal.user_id
            changed += 1
            session.add(
                AuditEvent(
                    workspace_id=principal.workspace_id,
                    actor_id=principal.user_id,
                    action="lead.approved",
                    metadata_json={"contact_id": str(contact.id)},
                )
            )
    session.commit()
    return ApprovalResult(approved_ids=payload.contact_ids, changed_count=changed)


@router.get("/summary")
def lead_summary(
    principal: Principal = Depends(current_principal), session: Session = Depends(get_session)
):
    total, approved = session.execute(
        select(func.count(Contact.id), func.count(Contact.approved_at)).where(
            Contact.workspace_id == principal.workspace_id
        )
    ).one()
    return {"total": total, "approved": approved, "needs_review": total - approved}


@router.get("/{contact_id}", response_model=LeadDetail)
def get_lead(
    contact_id: UUID,
    principal: Principal = Depends(current_principal),
    session: Session = Depends(get_session),
):
    contact = session.scalar(
        select(Contact).where(
            Contact.id == contact_id, Contact.workspace_id == principal.workspace_id
        )
    )
    if contact is None:
        raise HTTPException(404, "Lead not found")
    return detail(session, contact)
