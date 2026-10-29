"""Fetch the challenge archive and translate Elexon records into app models."""

import asyncio
import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from pydantic import ValidationError

from ..models import Actual, Dataset, Forecast, SourceMetadata
from ..models.elexon import ArchiveRequest, ElexonRecord, FetchedRecords
from .cache_repository import ResponseCache

logger = logging.getLogger(__name__)
BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/"

# The archive has a seven-day publication lookback before the first decision.
# Upper bounds are exclusive; January 31 decisions deliver on February 1.
PUBLICATIONS_FROM = datetime(2025, 12, 25, tzinfo=UTC)
PUBLICATIONS_TO = datetime(2026, 2, 1, tzinfo=UTC)
DELIVERY_FROM = datetime(2026, 1, 2, tzinfo=UTC)
DELIVERY_TO = datetime(2026, 2, 2, tzinfo=UTC)
REQUEST_CHUNK = timedelta(days=7)
MAX_CONCURRENT_REQUESTS = 3
MAX_REQUEST_ATTEMPTS = 3
MAX_RETRY_DELAY_SECONDS = 5


class UpstreamError(Exception):
    """Elexon could not provide a complete, valid response."""


def normalize(
    forecasts: list[dict[str, Any]],
    actuals: list[dict[str, Any]],
    metadata: SourceMetadata,
) -> Dataset:
    """Validate both sources before returning any data to the dashboard."""
    try:
        normalized_forecasts = normalize_forecasts(forecasts)
        normalized_actuals = normalize_actuals(actuals)
    except ValidationError as error:
        raise UpstreamError(
            "Elexon returned an invalid timestamp or generation value. "
            "No partial dataset was substituted."
        ) from error

    forecast_minutes = {forecast.target_time.minute for forecast in normalized_forecasts}
    # Warn about hourly source coverage rather than manufacturing half-hour values.
    if forecast_minutes == {0}:
        metadata.warnings.append(
            "WINDFOR targets are hourly in this archive. Half-hour slots without "
            "an exact forecast remain unavailable; metrics use exact timestamp "
            "matches only."
        )
    if not normalized_forecasts or not normalized_actuals:
        metadata.warnings.append(
            "One or both Elexon datasets contain no records in the delivery "
            "window. Coverage and metrics reflect only returned observations."
        )

    latest_actual_time = max(
        (actual.target_time for actual in normalized_actuals), default=None
    )
    return Dataset(
        forecasts=normalized_forecasts,
        actuals=normalized_actuals,
        actuals_through=latest_actual_time,
        metadata=metadata,
    )


def normalize_forecasts(records: list[dict[str, Any]]) -> list[Forecast]:
    """Collapse identical revisions and reject contradictory duplicates."""
    revisions: dict[tuple[datetime, datetime], Forecast] = {}
    for raw_record in records:
        record = ElexonRecord.model_validate(raw_record)
        target_time = record.start_time.astimezone(UTC)
        publish_time = record.publish_time.astimezone(UTC)
        if not DELIVERY_FROM <= target_time < DELIVERY_TO:
            continue

        revision_key = (target_time, publish_time)
        # Chunk boundaries may return the same revision more than once.
        existing = revisions.get(revision_key)
        if existing is not None and existing.forecast_mw != record.generation:
            raise UpstreamError(
                "Elexon returned conflicting forecast revisions for the same "
                "target and publication time."
            )

        # Stable IDs let the frontend keep the same identity across refreshes.
        identity = f"{target_time.isoformat()}|{publish_time.isoformat()}"
        record_id = hashlib.sha256(identity.encode()).hexdigest()[:24]
        revisions[revision_key] = Forecast(
            id=record_id,
            target_time=target_time,
            publish_time=publish_time,
            forecast_mw=record.generation,
        )

    return sorted(
        revisions.values(),
        key=lambda forecast: (forecast.target_time, forecast.publish_time),
    )


def normalize_actuals(records: list[dict[str, Any]]) -> list[Actual]:
    """Keep the latest returned WIND observation for each delivery timestamp."""
    latest_by_target: dict[datetime, ElexonRecord] = {}
    for raw_record in records:
        if raw_record.get("fuelType") != "WIND":
            continue

        record = ElexonRecord.model_validate(raw_record)
        target_time = record.start_time.astimezone(UTC)
        if not DELIVERY_FROM <= target_time < DELIVERY_TO:
            continue

        existing = latest_by_target.get(target_time)
        if existing is not None:
            same_publication = existing.publish_time == record.publish_time
            different_generation = existing.generation != record.generation
            if same_publication and different_generation:
                raise UpstreamError(
                    "Elexon returned conflicting actuals for the same target "
                    "and publication time."
                )
            if record.publish_time <= existing.publish_time:
                # Historical accuracy uses the latest returned actual, not an as-of actual.
                continue

        latest_by_target[target_time] = record

    return [
        Actual(target_time=target_time, actual_mw=record.generation)
        for target_time, record in sorted(latest_by_target.items())
    ]


def build_archive_requests() -> list[ArchiveRequest]:
    """Split the fixed archive into small requests accepted by Elexon."""
    requests = []
    chunk_start = PUBLICATIONS_FROM
    while chunk_start < PUBLICATIONS_TO:
        chunk_end = min(chunk_start + REQUEST_CHUNK, PUBLICATIONS_TO)
        requests.append(
            ArchiveRequest(
                dataset="WINDFOR",
                params={
                    "publishDateTimeFrom": chunk_start.isoformat(),
                    "publishDateTimeTo": chunk_end.isoformat(),
                },
            )
        )
        chunk_start = chunk_end

    chunk_start = DELIVERY_FROM
    while chunk_start < DELIVERY_TO:
        chunk_end = min(chunk_start + REQUEST_CHUNK, DELIVERY_TO)
        # Settlement-date filters include their end date.
        last_settlement_date = (chunk_end - timedelta(days=1)).date()
        requests.append(
            ArchiveRequest(
                dataset="FUELHH",
                params={
                    "settlementDateFrom": chunk_start.date().isoformat(),
                    "settlementDateTo": last_settlement_date.isoformat(),
                    "fuelType": "WIND",
                },
            )
        )
        chunk_start = chunk_end

    return requests


def is_retryable_status(status_code: int) -> bool:
    """Retry rate limits and server failures; other HTTP errors fail immediately."""
    return status_code == 429 or status_code >= 500


def retry_delay(attempt: int, response: httpx.Response | None = None) -> float:
    """Respect short Retry-After delays, otherwise use exponential backoff."""
    if response is not None:
        retry_after = response.headers.get("Retry-After", "")
        if retry_after.isdigit():
            return min(float(retry_after), MAX_RETRY_DELAY_SECONDS)
    return 0.5 * (2 ** attempt)


class ElexonRepository:
    def __init__(self, client: httpx.AsyncClient, cache: ResponseCache) -> None:
        self.client = client
        self.cache = cache
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        self.load_lock = asyncio.Lock()

    async def fetch(
        self, dataset: str, params: dict[str, str], refresh: bool = False
    ) -> FetchedRecords:
        """Read one archive chunk from cache or fetch and store a fresh response."""
        # Sorting parameters gives equivalent requests the same cache key.
        cache_key = dataset + ":" + json.dumps(params, sort_keys=True)
        if not refresh:
            cached = await asyncio.to_thread(self.cache.get, cache_key)
            if cached is not None:
                return FetchedRecords(cached.records, cached.fetched_at, True)

        # Refresh bypasses the cache; the semaphore limits pressure on Elexon.
        async with self.semaphore:
            response = await self.request_with_retries(dataset, params)
            try:
                records = response.json()
            except ValueError as error:
                raise UpstreamError(f"Elexon {dataset} returned invalid JSON.") from error

            if not isinstance(records, list) or any(
                not isinstance(record, dict) for record in records
            ):
                raise UpstreamError(
                    f"Elexon {dataset} returned an unexpected response shape."
                )

            fetched_at = datetime.now(UTC)
            try:
                await asyncio.to_thread(self.cache.put, cache_key, records, fetched_at)
            except ValueError as error:
                raise UpstreamError(f"Elexon {dataset} returned invalid JSON.") from error
            return FetchedRecords(records, fetched_at, False)

    async def request_with_retries(
        self, dataset: str, params: dict[str, str]
    ) -> httpx.Response:
        """Return a successful response or raise one clear upstream error."""
        url = f"{BASE_URL}datasets/{dataset}/stream"
        for attempt in range(MAX_REQUEST_ATTEMPTS):
            response = None
            try:
                response = await self.client.get(url, params=params)
                response.raise_for_status()
                return response
            except (httpx.TransportError, httpx.HTTPStatusError) as error:
                can_retry = True
                if isinstance(error, httpx.HTTPStatusError):
                    can_retry = is_retryable_status(error.response.status_code)

                attempts_remain = attempt < MAX_REQUEST_ATTEMPTS - 1
                if can_retry and attempts_remain:
                    await asyncio.sleep(retry_delay(attempt, response))
                    continue

                logger.warning(
                    "Elexon request failed for %s: %s", dataset, type(error).__name__
                )
                raise UpstreamError(
                    f"Elexon {dataset} is currently unavailable. Please retry. "
                    "Sample data has not been substituted."
                ) from error

        raise RuntimeError("The request retry loop ended without a result.")

    async def load(self, refresh: bool = False) -> Dataset:
        """Retrieve every required chunk before exposing the combined archive."""
        # Serialize full loads so concurrent users share cached results.
        async with self.load_lock:
            requests = build_archive_requests()
            tasks = [
                asyncio.create_task(self.fetch(request.dataset, request.params, refresh))
                for request in requests
            ]
            try:
                results = await asyncio.gather(*tasks)
            except BaseException:
                # A failed or cancelled load must not leave requests running behind it.
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                raise

            forecasts = []
            actuals = []
            for request, result in zip(requests, results):
                if request.dataset == "WINDFOR":
                    forecasts.extend(result.records)
                else:
                    actuals.extend(result.records)

            metadata = SourceMetadata(
                # Report the oldest chunk so a mixed-age cache is not shown as all fresh.
                fetched_at=min(result.fetched_at for result in results),
                cached=all(result.from_cache for result in results),
                forecast_publications_from=PUBLICATIONS_FROM,
                forecast_publications_to=PUBLICATIONS_TO,
            )
            return normalize(forecasts, actuals, metadata)
