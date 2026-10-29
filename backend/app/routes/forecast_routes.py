"""HTTP endpoints; forecast calculations belong in the service layer."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from ..controllers.forecast_controller import ForecastController
from ..models import Analysis, Dataset
from ..models.forecast import (
    CUTOFF_PATTERN,
    DEFAULT_CUTOFF,
    FIRST_DECISION_DATE,
    LAST_DECISION_DATE,
    AnalysisMode,
)

router = APIRouter(prefix="/api/v1", tags=["Wind forecasts"])


def get_controller(request: Request) -> ForecastController:
    """Reuse the controller created during application startup."""
    return request.app.state.forecast_controller


Controller = Annotated[ForecastController, Depends(get_controller)]


@router.get("/dataset", response_model=Dataset)
async def dataset(controller: Controller, refresh: bool = False) -> Dataset:
    """Return the archive's revisions and actuals before cutoff selection."""
    return await controller.dataset(refresh)


@router.get("/analytics", response_model=Analysis)
async def analytics(
    controller: Controller,
    mode: AnalysisMode = "accuracy",
    start: date = FIRST_DECISION_DATE,
    end: date = LAST_DECISION_DATE,
    cutoff: str = Query(DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
    refresh: bool = False,
) -> Analysis:
    """Parse URL parameters and delegate selection to the controller."""
    return await controller.analytics(
        mode=mode,
        start=start,
        end=end,
        cutoff=cutoff,
        refresh=refresh,
    )
