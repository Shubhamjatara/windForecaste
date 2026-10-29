"""Create the API and connect routes, controllers, services and repositories."""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .controllers.forecast_controller import ForecastController
from .repositories.cache_repository import ResponseCache
from .repositories.elexon_repository import ElexonRepository, UpstreamError
from .routes.forecast_routes import router as forecast_router
from .routes.health_routes import router as health_router
from .services.forecast_service import ForecastService

DEFAULT_CACHE_PATH = Path(__file__).resolve().parents[1] / ".cache" / "elexon.sqlite3"
DEFAULT_CORS_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173"


def create_app() -> FastAPI:
    """Create the application with an Elexon repository."""
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        cache_path = Path(os.getenv("CACHE_PATH", str(DEFAULT_CACHE_PATH)))
        cache_lifetime = int(os.getenv("CACHE_TTL_SECONDS", "3600"))
        cache = ResponseCache(cache_path, ttl_seconds=cache_lifetime)

        # Reuse one HTTP client for the app lifetime and close it on shutdown.
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30, connect=10),
            headers={"Accept": "application/json", "User-Agent": "Windscope/1.0"},
        ) as client:
            elexon_repository = ElexonRepository(client, cache)
            service = ForecastService(elexon_repository)
            app.state.forecast_controller = ForecastController(service)
            yield

    app = FastAPI(
        title="Windscope API",
        version="1.0.0",
        lifespan=lifespan,
        description=(
            "January 2026 UK wind decision replay and forecast accuracy "
            "from Elexon WINDFOR and WIND FUELHH."
        ),
    )

    configured_origins = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    allowed_origins = [
        origin.strip() for origin in configured_origins.split(",") if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["GET"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(UpstreamError)
    async def upstream_error(
        _request: Request, error: UpstreamError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={"detail": str(error), "code": "ELEXON_UNAVAILABLE"},
        )

    @app.exception_handler(TimeoutError)
    async def retrieval_timeout(
        _request: Request, _error: TimeoutError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=504,
            content={
                "detail": (
                    "Elexon retrieval timed out. Please retry; "
                    "no sample data was substituted."
                ),
                "code": "ELEXON_TIMEOUT",
            },
        )

    app.include_router(health_router)
    app.include_router(forecast_router)
    return app


app = create_app()
