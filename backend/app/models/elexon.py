"""Types used when reading and validating the external Elexon API."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, NamedTuple

from pydantic import AwareDatetime, BaseModel, Field, FiniteFloat, field_validator


class ElexonRecord(BaseModel):
    start_time: AwareDatetime = Field(alias="startTime")
    publish_time: AwareDatetime = Field(alias="publishTime")
    generation: FiniteFloat

    @field_validator("generation", mode="before")
    @classmethod
    def reject_boolean(cls, value: Any) -> Any:
        # Python treats bool as a number, but it is not a valid MW reading.
        if isinstance(value, bool):
            raise ValueError("generation must be a number")
        return value


@dataclass(frozen=True)
class ArchiveRequest:
    dataset: str
    params: dict[str, str]


class FetchedRecords(NamedTuple):
    records: list[dict[str, Any]]
    fetched_at: datetime
    from_cache: bool
