"""Select decision-time forecasts and measure their accuracy against actuals."""

import asyncio
from collections import defaultdict
from datetime import UTC, datetime, time, timedelta
from math import fsum, sqrt

from ..models import Analysis, AnalysisQuery, Dataset, Forecast, ForecastRow, Metrics
from ..models.forecast import ActualStatus
from ..repositories.elexon_repository import ElexonRepository

RETRIEVAL_TIMEOUT_SECONDS = 90
INTERVAL_DURATION = timedelta(minutes=30)
INTERVALS_PER_DAY = 48


class ForecastService:
    """Coordinate retrieval and run the forecast calculations."""

    def __init__(self, repository: ElexonRepository) -> None:
        self.repository = repository

    async def get_dataset(self, refresh: bool = False) -> Dataset:
        # Limit the entire retrieval, including retries and waiting for another load.
        async with asyncio.timeout(RETRIEVAL_TIMEOUT_SECONDS):
            return await self.repository.load(refresh)

    async def get_analytics(
        self, query: AnalysisQuery, refresh: bool = False
    ) -> Analysis:
        dataset = await self.get_dataset(refresh)
        return analyze(dataset, query)


def analyze(
    dataset: Dataset, query: AnalysisQuery, now: datetime | None = None
) -> Analysis:
    """Apply each day's cutoff independently, then score the matched intervals."""
    current_time = now or datetime.now(UTC)
    # Group revisions once so each interval only searches its own forecasts.
    forecasts_by_target: dict[datetime, list[Forecast]] = defaultdict(list)
    for forecast in dataset.forecasts:
        forecasts_by_target[forecast.target_time].append(forecast)

    actuals_by_target = {
        actual.target_time: actual.actual_mw for actual in dataset.actuals
    }
    rows: list[ForecastRow] = []
    decision_date = query.start

    while decision_date <= query.end:
        # Each decision day has its own cutoff; it predicts the following UTC day.
        decision_time = datetime.combine(decision_date, query.decision_time, UTC)
        delivery_date = decision_date + timedelta(days=1)
        delivery_start = datetime.combine(delivery_date, time.min, UTC)

        for interval_index in range(INTERVALS_PER_DAY):
            # Build all expected slots, even when Elexon has no matching record.
            target_time = delivery_start + interval_index * INTERVAL_DURATION
            row = build_interval_row(
                target_time=target_time,
                decision_time=decision_time,
                revisions=forecasts_by_target.get(target_time, []),
                actual_mw=actuals_by_target.get(target_time),
                hide_actuals=query.mode == "decision",
                current_time=current_time,
            )
            rows.append(row)

        decision_date += timedelta(days=1)

    return Analysis(
        rows=rows,
        metrics=calculate_metrics(rows),
        actuals_through=dataset.actuals_through,
        metadata=dataset.metadata,
    )


def build_interval_row(
    *,
    target_time: datetime,
    decision_time: datetime,
    revisions: list[Forecast],
    actual_mw: float | None,
    hide_actuals: bool,
    current_time: datetime,
) -> ForecastRow:
    """Keep missing intervals visible without filling them with invented values."""
    # A publication exactly at the cutoff is eligible. Later revisions are not.
    eligible_revisions = [
        revision for revision in revisions if revision.publish_time <= decision_time
    ]
    latest_forecast = max(
        eligible_revisions,
        # The ID makes selection deterministic if publication times are equal.
        key=lambda revision: (revision.publish_time, revision.id),
        default=None,
    )

    forecast_mw = None
    publish_time = None
    age_hours = None
    if latest_forecast is not None:
        forecast_mw = latest_forecast.forecast_mw
        publish_time = latest_forecast.publish_time
        # Age is measured at the decision, not when the dashboard was refreshed.
        age_hours = (decision_time - publish_time).total_seconds() / 3600

    # A decision replay must not reveal observations made after that decision.
    if hide_actuals:
        actual_mw = None

    actual_status = get_actual_status(
        actual_mw, target_time, current_time, hide_actuals=hide_actuals
    )
    error_mw = None
    absolute_error_mw = None
    # Check for None explicitly: 0 MW is a valid observation, not missing data.
    if forecast_mw is not None and actual_mw is not None:
        error_mw = forecast_mw - actual_mw
        absolute_error_mw = abs(error_mw)

    return ForecastRow(
        id=target_time.isoformat(),
        target_time=target_time,
        timestamp=int(target_time.timestamp() * 1000),
        decision_time=decision_time,
        publish_time=publish_time,
        forecast_mw=forecast_mw,
        actual_mw=actual_mw,
        actual_status=actual_status,
        error_mw=error_mw,
        absolute_error_mw=absolute_error_mw,
        age_hours=age_hours,
        eligible_revisions=len(eligible_revisions),
    )


def get_actual_status(
    actual_mw: float | None,
    target_time: datetime,
    current_time: datetime,
    *,
    hide_actuals: bool,
) -> ActualStatus:
    """Distinguish hidden observations, available values and unfinished intervals."""
    if hide_actuals:
        return "hidden"
    if actual_mw is not None:
        return "available"
    # An absent observation becomes missing once its half-hour interval has ended.
    if target_time + INTERVAL_DURATION > current_time:
        return "pending"
    return "missing"


def calculate_metrics(rows: list[ForecastRow]) -> Metrics | None:
    """Score only matched pairs; zero generation is valid and is included."""
    errors = [row.error_mw for row in rows if row.error_mw is not None]
    if not errors:
        # Returning zero here would incorrectly suggest a perfect forecast.
        return None

    matched_count = len(errors)
    absolute_error_sum = fsum(abs(error) for error in errors)
    squared_error_sum = fsum(error * error for error in errors)
    signed_error_sum = fsum(errors)

    return Metrics(
        # Positive bias means forecasts exceeded actual generation on average.
        mae=absolute_error_sum / matched_count,
        rmse=sqrt(squared_error_sum / matched_count),
        bias=signed_error_sum / matched_count,
        count=matched_count,
    )
