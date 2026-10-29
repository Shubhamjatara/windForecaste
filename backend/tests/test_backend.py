import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import AnalysisQuery, Dataset, SourceMetadata
from app.repositories.cache_repository import ResponseCache
from app.repositories.elexon_repository import ElexonRepository, UpstreamError, normalize
from app.services.forecast_service import analyze


def metadata() -> SourceMetadata:
    return SourceMetadata(
        fetched_at=datetime.now(UTC),
        cached=False,
        forecast_publications_from="2025-12-25T00:00:00Z",
        forecast_publications_to="2026-02-01T00:00:00Z",
    )


def record(
    value: Any = 100,
    target: str = "2026-01-02T00:00:00Z",
    published: str = "2026-01-01T10:00:00Z",
    **extra: Any,
) -> dict[str, Any]:
    return {
        "startTime": target,
        "publishTime": published,
        "generation": value,
        **extra,
    }


def dataset() -> Dataset:
    forecasts = [
        record(80, published="2026-01-01T09:00:00Z"),
        record(100),
        record(999, published="2026-01-01T10:00:01Z"),
        record(0, target="2026-01-02T00:30:00Z"),
    ]
    actuals = [
        record(90, fuelType="WIND"),
        record(20, target="2026-01-02T00:30:00Z", fuelType="WIND"),
    ]
    return normalize(forecasts, actuals, metadata())


def test_latest_eligible_revision_and_metrics_include_zero():
    query = AnalysisQuery(start="2026-01-01", end="2026-01-01")
    result = analyze(dataset(), query)

    assert len(result.rows) == 48
    assert result.rows[0].forecast_mw == 100
    assert result.rows[0].eligible_revisions == 2
    assert result.rows[0].age_hours == 0
    assert result.rows[1].forecast_mw == 0
    assert result.rows[2].forecast_mw is None
    assert result.rows[2].error_mw is None
    assert result.metrics.count == 2
    assert result.metrics.mae == 15
    assert result.metrics.bias == -5
    assert result.metrics.rmse == pytest.approx(250 ** 0.5)


def test_cutoff_applies_independently_to_each_day():
    forecasts = [
        record(100),
        record(
            200,
            target="2026-01-03T00:00:00Z",
            published="2026-01-02T10:00:00Z",
        ),
        record(
            999,
            target="2026-01-03T00:00:00Z",
            published="2026-01-02T10:01:00Z",
        ),
    ]
    archive = normalize(forecasts, [], metadata())
    query = AnalysisQuery(start="2026-01-01", end="2026-01-02")
    result = analyze(archive, query)

    assert result.rows[0].forecast_mw == 100
    assert result.rows[48].forecast_mw == 200
    assert result.metrics is None


def test_decision_view_hides_actuals_and_metrics():
    query = AnalysisQuery(
        mode="decision", start="2026-01-01", end="2026-01-01"
    )
    result = analyze(dataset(), query)

    for row in result.rows:
        assert row.actual_mw is None
        assert row.error_mw is None
        assert row.actual_status == "hidden"
    assert result.metrics is None
    assert result.rows[0].forecast_mw == 100


def test_january_31_delivers_february_1_and_pending_vs_missing():
    query = AnalysisQuery(start="2026-01-31", end="2026-01-31")
    current_time = datetime(2026, 2, 1, 1, tzinfo=UTC)
    result = analyze(dataset(), query, now=current_time)

    assert result.rows[0].target_time == datetime(2026, 2, 1, tzinfo=UTC)
    assert result.rows[-1].target_time.hour == 23
    assert result.rows[0].actual_status == "missing"
    assert result.rows[1].actual_status == "missing"
    assert result.rows[2].actual_status == "pending"


def test_normalization_deduplicates_and_selects_latest_wind_actual():
    actuals = [
        record(50, fuelType="WIND"),
        record(60, published="2026-01-03T12:00:00Z", fuelType="WIND"),
        record(999, fuelType="GAS"),
    ]
    archive = normalize([record(), record()], actuals, metadata())

    assert len(archive.forecasts) == 1
    assert archive.actuals[0].actual_mw == 60
    assert "hourly" in archive.metadata.warnings[0]


@pytest.mark.parametrize(
    "invalid_record",
    [
        record(float("nan")),
        record(True),
        record(published="2026-01-01T10:00:00"),
        {"generation": 1},
    ],
)
def test_invalid_upstream_records_reject_entire_dataset(invalid_record):
    with pytest.raises(UpstreamError):
        normalize([record(), invalid_record], [], metadata())


@pytest.mark.parametrize("source", ["forecast", "actual"])
def test_conflicting_duplicates_are_rejected(source):
    records = [record(100, fuelType="WIND"), record(101, fuelType="WIND")]
    forecasts = records if source == "forecast" else []
    actuals = records if source == "actual" else []

    with pytest.raises(UpstreamError):
        normalize(forecasts, actuals, metadata())


@pytest.fixture
def repository_load(monkeypatch, tmp_path: Path) -> AsyncMock:
    monkeypatch.setenv("CACHE_PATH", str(tmp_path / "cache.sqlite3"))
    load = AsyncMock(return_value=dataset())
    monkeypatch.setattr(ElexonRepository, "load", load)
    return load


def test_http_contract_refresh_cors_and_health(repository_load):
    with TestClient(create_app()) as client:
        assert client.get("/api/health").status_code == 200
        repository_load.assert_not_awaited()

        response = client.get(
            "/api/v1/analytics",
            params={"start": "2026-01-01", "end": "2026-01-01", "refresh": True},
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

        body = response.json()
        assert body["metadata"]["source"] == "elexon"
        assert body["rows"][0]["forecastMW"] == 100
        assert body["rows"][0]["publishTime"].endswith("Z")
        assert "actualsThrough" in body
        repository_load.assert_awaited_once_with(True)
        assert len(client.get("/api/v1/dataset").json()["forecasts"]) == 4
        assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize(
    "params",
    [
        "start=2026-02-01",
        "start=2026-01-03&end=2026-01-01",
        "start=invalid",
        "cutoff=24:00",
        "cutoff=9:00",
        "mode=invalid",
        "mode=decision",
        "end=2026-02-01",
    ],
)
def test_invalid_http_inputs_do_not_fetch_data(params, repository_load):
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/analytics?" + params)
        assert response.status_code == 422
    repository_load.assert_not_awaited()


@pytest.mark.parametrize(
    ("error", "status_code", "error_code"),
    [
        (UpstreamError("Unavailable"), 502, "ELEXON_UNAVAILABLE"),
        (TimeoutError(), 504, "ELEXON_TIMEOUT"),
    ],
)
def test_upstream_failures_have_explicit_error_response(
    error, status_code, error_code, repository_load
):
    repository_load.side_effect = error
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/analytics")
        assert response.status_code == status_code
        assert response.json()["code"] == error_code
        assert "rows" not in response.json()


def test_cache_expiry(tmp_path: Path):
    cache = ResponseCache(tmp_path / "cache.sqlite3", ttl_seconds=60)
    current_time = datetime.now(UTC)
    cache.put("fresh", [record()], current_time)
    cache.put("expired", [record()], current_time - timedelta(seconds=61))

    assert cache.get("fresh").records == [record()]
    assert cache.get("expired") is None
    assert cache.get("absent") is None


def test_repository_retries_caches_and_refreshes(tmp_path: Path):
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if len(requests) == 1:
            return httpx.Response(503, headers={"Retry-After": "0"})
        return httpx.Response(200, json=[record()])

    async def run():
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            cache = ResponseCache(tmp_path / "cache.sqlite3")
            repository = ElexonRepository(client, cache)

            first_load = await repository.fetch("WINDFOR", {})
            cached_load = await repository.fetch("WINDFOR", {})
            assert first_load.from_cache is False
            assert cached_load.from_cache is True
            assert len(requests) == 2

            refreshed_load = await repository.fetch("WINDFOR", {}, refresh=True)
            assert refreshed_load.from_cache is False
            assert len(requests) == 3

    asyncio.run(run())


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={"bad": []}),
        httpx.Response(200, text="not JSON"),
        httpx.Response(400),
    ],
)
def test_repository_rejects_invalid_response(tmp_path: Path, response):
    async def run():
        transport = httpx.MockTransport(lambda request: response)
        async with httpx.AsyncClient(transport=transport) as client:
            cache = ResponseCache(tmp_path / "cache.sqlite3")
            repository = ElexonRepository(client, cache)
            with pytest.raises(UpstreamError):
                await repository.fetch("WINDFOR", {})

    asyncio.run(run())


def test_archive_load_combines_all_chunks_and_reuses_cache(tmp_path: Path):
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if "WINDFOR" in request.url.path:
            return httpx.Response(200, json=[record(100)])
        return httpx.Response(200, json=[record(90, fuelType="WIND")])

    async def run():
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            cache = ResponseCache(tmp_path / "cache.sqlite3")
            repository = ElexonRepository(client, cache)
            archive = await repository.load()

            forecast_requests = [r for r in requests if "WINDFOR" in r.url.path]
            actual_requests = [r for r in requests if "FUELHH" in r.url.path]
            forecast_requests.sort(
                key=lambda request: request.url.params["publishDateTimeFrom"]
            )
            actual_requests.sort(
                key=lambda request: request.url.params["settlementDateFrom"]
            )
            assert len(forecast_requests) == 6
            assert len(actual_requests) == 5
            assert forecast_requests[0].url.params["publishDateTimeFrom"].startswith(
                "2025-12-25"
            )
            assert forecast_requests[-1].url.params["publishDateTimeTo"].startswith(
                "2026-02-01"
            )
            assert actual_requests[0].url.params["settlementDateFrom"] == "2026-01-02"
            assert actual_requests[-1].url.params["settlementDateTo"] == "2026-02-01"
            assert all(r.url.params["fuelType"] == "WIND" for r in actual_requests)
            assert len(archive.forecasts) == 1
            assert len(archive.actuals) == 1
            assert archive.metadata.cached is False

            cached_archive = await repository.load()
            assert cached_archive.metadata.cached is True
            assert len(requests) == 11

    asyncio.run(run())
