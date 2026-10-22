from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Record, TenantRecord, tenant_args


def ref(table, column):
    return ForeignKeyConstraint(["workspace_id", column], [f"{table}.workspace_id", f"{table}.id"])


def state_check(values):
    return CheckConstraint("state IN (" + ",".join(repr(v) for v in values) + ")", name="state")


class Workspace(Record, Base):
    __tablename__ = "workspaces"
    name: Mapped[str] = mapped_column(String(200))
    campaigns_paused: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class User(Record, Base):
    __tablename__ = "users"
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(320))


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), server_default="member")
    __table_args__ = (CheckConstraint("role IN ('owner','admin','member')", name="role"),)


class Company(TenantRecord, Base):
    __tablename__ = "companies"
    domain: Mapped[str] = mapped_column(String(253))
    name: Mapped[str] = mapped_column(String(250))
    industry: Mapped[str | None] = mapped_column(String(200))
    size: Mapped[int | None] = mapped_column(Integer)
    __table_args__ = tenant_args(
        UniqueConstraint("workspace_id", "domain"),
        CheckConstraint("size IS NULL OR size >= 0", name="size"),
        CheckConstraint("domain = lower(trim(domain)) AND domain <> ''", name="domain"),
    )


class Contact(TenantRecord, Base):
    __tablename__ = "contacts"
    company_id: Mapped[UUID | None]
    name: Mapped[str] = mapped_column(String(250))
    title: Mapped[str | None] = mapped_column(String(250))
    email: Mapped[str | None] = mapped_column(String(320))
    email_status: Mapped[str] = mapped_column(String(30), server_default="unknown")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    client_request_id: Mapped[str | None] = mapped_column(String(100))
    request_hash: Mapped[str | None] = mapped_column(String(64))
    __table_args__ = tenant_args(
        ref("companies", "company_id"),
        UniqueConstraint("workspace_id", "client_request_id"),
        CheckConstraint("(approved_at IS NULL) = (approved_by IS NULL)", name="approval_pair"),
        CheckConstraint(
            "email_status IN ('unknown','published','invalid','bounced')", name="email_status"
        ),
    )


class ContactEvidence(TenantRecord, Base):
    __tablename__ = "contact_evidence"
    contact_id: Mapped[UUID]
    field_name: Mapped[str] = mapped_column(String(100))
    field_value: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = tenant_args(
        ref("contacts", "contact_id"),
        CheckConstraint("confidence BETWEEN 0 AND 1", name="confidence"),
    )


class LeadSearch(TenantRecord, Base):
    __tablename__ = "lead_searches"
    criteria_json: Mapped[dict] = mapped_column(JSONB)
    state: Mapped[str] = mapped_column(String(20), server_default="pending")
    __table_args__ = tenant_args(state_check(["pending", "running", "completed", "failed"]))


class LeadScore(TenantRecord, Base):
    __tablename__ = "lead_scores"
    contact_id: Mapped[UUID]
    search_id: Mapped[UUID]
    fit_score: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    explanation: Mapped[str] = mapped_column(Text)
    __table_args__ = tenant_args(
        ref("contacts", "contact_id"),
        ref("lead_searches", "search_id"),
        UniqueConstraint("contact_id", "search_id"),
        CheckConstraint("fit_score BETWEEN 0 AND 100", name="fit_score"),
        CheckConstraint("confidence BETWEEN 0 AND 1", name="confidence"),
    )


class Mailbox(TenantRecord, Base):
    __tablename__ = "mailboxes"
    provider: Mapped[str] = mapped_column(String(20), server_default="gmail")
    address: Mapped[str] = mapped_column(String(320))
    encrypted_credential_ref: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20), server_default="disconnected")
    history_cursor: Mapped[str | None] = mapped_column(Text)
    __table_args__ = tenant_args(
        UniqueConstraint("workspace_id", "address"),
        CheckConstraint("provider = 'gmail'", name="provider"),
        state_check(["disconnected", "active", "revoked", "error"]),
    )


class Campaign(TenantRecord, Base):
    __tablename__ = "campaigns"
    mailbox_id: Mapped[UUID | None]
    name: Mapped[str] = mapped_column(String(250))
    audience: Mapped[str] = mapped_column(Text, server_default="")
    objective: Mapped[str] = mapped_column(Text, server_default="")
    settings_json: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    version: Mapped[int] = mapped_column(Integer, server_default="1")
    client_request_id: Mapped[str | None] = mapped_column(String(100))
    request_hash: Mapped[str | None] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(20), server_default="draft")
    __table_args__ = tenant_args(
        ref("mailboxes", "mailbox_id"),
        UniqueConstraint("workspace_id", "client_request_id"),
        state_check(["draft", "active", "paused", "completed", "failed"]),
    )


class CampaignStep(TenantRecord, Base):
    __tablename__ = "campaign_steps"
    campaign_id: Mapped[UUID]
    position: Mapped[int] = mapped_column(Integer)
    delay_seconds: Mapped[int] = mapped_column(Integer, server_default="0")
    instructions: Mapped[str] = mapped_column(Text)
    subject: Mapped[str] = mapped_column(String(200), server_default="")
    __table_args__ = tenant_args(
        ref("campaigns", "campaign_id"),
        UniqueConstraint("campaign_id", "position"),
        UniqueConstraint("workspace_id", "campaign_id", "id"),
        CheckConstraint("position >= 0 AND delay_seconds >= 0", name="sequence"),
    )


class CampaignLead(TenantRecord, Base):
    __tablename__ = "campaign_leads"
    campaign_id: Mapped[UUID]
    contact_id: Mapped[UUID]
    state: Mapped[str] = mapped_column(String(20), server_default="draft")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = tenant_args(
        ref("campaigns", "campaign_id"),
        ref("contacts", "contact_id"),
        UniqueConstraint("campaign_id", "contact_id"),
        UniqueConstraint("workspace_id", "campaign_id", "id"),
        state_check(
            [
                "draft",
                "approved",
                "active",
                "paused",
                "replied",
                "completed",
                "suppressed",
                "failed",
            ]
        ),
        CheckConstraint(
            "state NOT IN ('approved','active') OR approved_at IS NOT NULL", name="approval"
        ),
        Index("ix_campaign_leads_due", "state", "next_due_at"),
    )


class Message(TenantRecord, Base):
    __tablename__ = "messages"
    campaign_id: Mapped[UUID]
    campaign_lead_id: Mapped[UUID]
    step_id: Mapped[UUID]
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    thread_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), server_default="draft")
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)
    __table_args__ = tenant_args(
        ForeignKeyConstraint(
            ["workspace_id", "campaign_id", "campaign_lead_id"],
            ["campaign_leads.workspace_id", "campaign_leads.campaign_id", "campaign_leads.id"],
        ),
        ForeignKeyConstraint(
            ["workspace_id", "campaign_id", "step_id"],
            ["campaign_steps.workspace_id", "campaign_steps.campaign_id", "campaign_steps.id"],
        ),
        UniqueConstraint("campaign_lead_id", "step_id"),
        CheckConstraint(
            "status IN ('draft','reserved','sending','sent','uncertain','failed','canceled')",
            name="status",
        ),
    )


class Job(TenantRecord, Base):
    __tablename__ = "jobs"
    kind: Mapped[str] = mapped_column(String(100))
    payload_json: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    state: Mapped[str] = mapped_column(String(20), server_default="pending")
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    lease_token: Mapped[UUID | None]
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    __table_args__ = tenant_args(
        state_check(["pending", "leased", "running", "completed", "retry_wait", "failed"]),
        CheckConstraint("attempts >= 0", name="attempts"),
        CheckConstraint("(lease_token IS NULL) = (lease_until IS NULL)", name="lease_pair"),
        CheckConstraint(
            "state NOT IN ('leased','running') OR lease_token IS NOT NULL", name="active_lease"
        ),
        Index("ix_jobs_due", "state", "available_at"),
        Index("ix_jobs_lease_until", "lease_until"),
    )


class SuppressionEntry(TenantRecord, Base):
    __tablename__ = "suppression_entries"
    normalized_email: Mapped[str] = mapped_column(String(320))
    reason: Mapped[str] = mapped_column(String(100))
    # Deliberately no contact FK: suppression survives contact deletion.
    __table_args__ = tenant_args(
        UniqueConstraint("workspace_id", "normalized_email"),
        CheckConstraint(
            "normalized_email = lower(trim(normalized_email)) AND normalized_email <> ''",
            name="normalized_email",
        ),
    )


class AuditEvent(TenantRecord, Base):
    __tablename__ = "audit_events"
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    metadata_json: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    __table_args__ = tenant_args(
        Index("ix_audit_events_workspace_created", "workspace_id", "created_at")
    )
