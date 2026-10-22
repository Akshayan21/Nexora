from datetime import time
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timezone: str = "Asia/Kolkata"
    daily_limit: int = Field(default=10, ge=1, le=10)
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], min_length=1, max_length=7)
    window_start: time = time(9)
    window_end: time = time(17)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use a valid IANA timezone") from None
        return value

    @field_validator("weekdays")
    @classmethod
    def valid_days(cls, value):
        if len(set(value)) != len(value) or any(d < 0 or d > 6 for d in value):
            raise ValueError("Weekdays must be unique integers from 0 (Monday) to 6 (Sunday)")
        return sorted(value)

    @model_validator(mode="after")
    def valid_window(self):
        if (
            self.window_start.tzinfo
            or self.window_end.tzinfo
            or self.window_start >= self.window_end
        ):
            raise ValueError("Sending window must use local times and end after it starts")
        return self


class StepInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    delay_days: int = Field(ge=0, le=90)


class CampaignInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=250)
    audience: str = Field(min_length=1, max_length=3000)
    objective: str = Field(min_length=1, max_length=5000)
    contact_ids: list[UUID] = Field(default_factory=list, max_length=500)
    steps: list[StepInput] = Field(min_length=1, max_length=8)
    schedule: Schedule = Field(default_factory=Schedule)

    @model_validator(mode="after")
    def valid_sequence(self):
        if len(set(self.contact_ids)) != len(self.contact_ids):
            raise ValueError("Duplicate recipients")
        if self.steps[0].delay_days != 0:
            raise ValueError("The first step must have zero delay")
        if any(s.delay_days == 0 for s in self.steps[1:]):
            raise ValueError("Follow-ups must wait at least one day")
        return self


class CampaignUpdate(CampaignInput):
    expected_version: int = Field(ge=1)
