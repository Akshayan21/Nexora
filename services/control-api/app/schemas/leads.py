from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class EvidenceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    field_name: str = Field(min_length=1, max_length=100)
    field_value: str = Field(min_length=1, max_length=5000)
    source_url: HttpUrl
    summary: str | None = Field(default=None, max_length=2000)
    confidence: float = Field(ge=0, le=1)
    observed_at: datetime

    @field_validator("observed_at")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("observed_at must include a timezone")
        return value


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=250)
    title: str | None = Field(default=None, max_length=250)
    email: str | None = Field(default=None, max_length=320, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    company_name: str = Field(min_length=1, max_length=250)
    company_domain: str = Field(
        min_length=1,
        max_length=253,
        pattern=r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$",
    )
    evidence: list[EvidenceInput] = Field(default_factory=list, max_length=20)

    @field_validator("email", "company_domain", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    field_name: str
    field_value: str
    source_url: str
    summary: str | None
    confidence: float
    observed_at: datetime


class LeadOut(BaseModel):
    id: UUID
    name: str
    title: str | None
    email: str | None
    email_status: str
    company_id: UUID | None
    company_name: str | None
    company_domain: str | None
    approved_at: datetime | None
    status: Literal["approved", "needs_review"]
    created_at: datetime


class LeadDetail(LeadOut):
    evidence: list[EvidenceOut]


class LeadPage(BaseModel):
    items: list[LeadOut]
    total: int
    limit: int
    offset: int


class ApproveLeads(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_ids: list[UUID] = Field(min_length=1, max_length=100)

    @field_validator("contact_ids")
    @classmethod
    def no_duplicates(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Duplicate contact IDs are not allowed")
        return value


class ApprovalResult(BaseModel):
    approved_ids: list[UUID]
    changed_count: int
