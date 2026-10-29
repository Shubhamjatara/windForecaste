"""Request and response models shared by the API and business logic."""

import re
from datetime import date, time
from typing import Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

AnalysisMode = Literal["decision", "accuracy"]
ActualStatus = Literal["available", "pending", "missing", "hidden"]

FIRST_DECISION_DATE = date(2026, 1, 1)
LAST_DECISION_DATE = date(2026, 1, 31)
DEFAULT_CUTOFF = "10:00"
CUTOFF_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class Model(BaseModel):
    """Use Python names internally and camelCase in the JSON API."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Forecast(Model):
    """One forecast revision for a delivery timestamp."""

    id: str
    target_time: AwareDatetime
    publish_time: AwareDatetime
    # Explicit MW aliases preserve the existing frontend contract's capitalization.
    forecast_mw: FiniteFloat = Field(alias="forecastMW")


class Actual(Model):
    target_time: AwareDatetime
    actual_mw: FiniteFloat = Field(alias="actualMW")


class SourceMetadata(Model):
    """Retrieval provenance, separate from the publication age of a forecast."""

    source: Literal["elexon"] = "elexon"
    fetched_at: AwareDatetime
    cached: bool
    forecast_publications_from: AwareDatetime
    forecast_publications_to: AwareDatetime
    alignment: str = "Exact UTC target timestamps; no interpolation or forward filling."
    warnings: list[str] = Field(default_factory=list)


class Dataset(Model):
    """The normalized archive before decision-time filtering is applied."""

    forecasts: list[Forecast]
    actuals: list[Actual]
    actuals_through: AwareDatetime | None
    metadata: SourceMetadata


class AnalysisQuery(Model):
    """Decision dates are inclusive; delivery is always the following day."""

    mode: AnalysisMode = "accuracy"
    start: date = FIRST_DECISION_DATE
    end: date = LAST_DECISION_DATE
    cutoff: str = DEFAULT_CUTOFF

    @field_validator("cutoff")
    @classmethod
    def validate_cutoff(cls, value: str) -> str:
        if not re.fullmatch(CUTOFF_PATTERN, value):
            raise ValueError("cutoff must be HH:MM in UTC")
        return value

    @model_validator(mode="after")
    def validate_period(self) -> Self:
        if self.start > self.end:
            raise ValueError("start must be on or before end")
        if self.start < FIRST_DECISION_DATE or self.end > LAST_DECISION_DATE:
            raise ValueError("Decision dates must be within January 2026")
        if self.mode == "decision" and self.start != self.end:
            raise ValueError("Decision mode requires a single decision date")
        return self

    @property
    def decision_time(self) -> time:
        # The service combines this clock time with each decision date in UTC.
        return time.fromisoformat(self.cutoff)


class ForecastRow(Model):
    """One expected half-hour interval, including gaps in either source."""

    id: str
    # AwareDatetime rejects timestamps without a timezone at model boundaries.
    target_time: AwareDatetime
    timestamp: int
    decision_time: AwareDatetime
    publish_time: AwareDatetime | None
    forecast_mw: FiniteFloat | None = Field(alias="forecastMW")
    actual_mw: FiniteFloat | None = Field(alias="actualMW")
    actual_status: ActualStatus
    error_mw: FiniteFloat | None = Field(alias="errorMW")
    absolute_error_mw: FiniteFloat | None = Field(alias="absoluteErrorMW")
    age_hours: float | None
    eligible_revisions: int


class Metrics(Model):
    """Accuracy in MW, calculated only from the count of matched pairs."""

    mae: float
    rmse: float
    bias: float
    count: int


class Analysis(Model):
    rows: list[ForecastRow]
    metrics: Metrics | None
    actuals_through: AwareDatetime | None
    metadata: SourceMetadata
