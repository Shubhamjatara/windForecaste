"""Validate HTTP selections before passing them to the forecast service."""

from datetime import date

from fastapi import HTTPException
from pydantic import ValidationError

from ..models import Analysis, AnalysisQuery, Dataset
from ..models.forecast import AnalysisMode
from ..services.forecast_service import ForecastService


class ForecastController:
    def __init__(self, service: ForecastService) -> None:
        self.service = service

    async def dataset(self, refresh: bool) -> Dataset:
        return await self.service.get_dataset(refresh)

    async def analytics(
        self,
        mode: AnalysisMode,
        start: date,
        end: date,
        cutoff: str,
        refresh: bool,
    ) -> Analysis:
        try:
            query = AnalysisQuery(mode=mode, start=start, end=end, cutoff=cutoff)
        except ValidationError as error:
            # Report invalid date combinations as client errors before fetching data.
            messages = [issue["msg"] for issue in error.errors()]
            raise HTTPException(
                status_code=422,
                detail="; ".join(messages),
            ) from error

        # Keep eligibility rules and calculations in the service, not the controller.
        return await self.service.get_analytics(query, refresh)
