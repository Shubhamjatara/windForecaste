# Windscope — Wind Forecast Analytics

Developed a React/TypeScript dashboard and Python FastAPI backend for UK national wind forecasts and historical accuracy analysis, using shadcn/ui, Tailwind CSS, Recharts, and TanStack Table. Leveraged ChatGPT to better understand requirements, streamline implementation, and accelerate development.

## Start locally

Requirements: Python 3.11+, Node.js 22+ and pnpm 11. Internet access is required for Elexon; no API key is needed. Run these commands from the repository root in two terminals.

Backend (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```powershell
cd dashboard
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. Set `SERVER_URL` in `dashboard/.env` to the backend base URL (for example, `http://127.0.0.1:8000`, without `/api`). Copy `dashboard/.env.example` if needed. Restart Vite after changes; production changes require a rebuild. If unset or empty, Vite forwards same-origin `/api` requests to the backend on port 8000. For direct cross-origin requests, include the frontend origin in the backend's `CORS_ORIGINS`. API documentation: **http://127.0.0.1:8000/docs**. On macOS/Linux, use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`.

The dashboard uses only real Elexon archive data returned by the Python API. The backend must be running. Source badges, explanations and CSV filenames identify Elexon. A backend or upstream failure displays a retryable error; no offline dataset or generated fallback is included.

## Backend layout

```text
backend/app/
  main.py                           Application lifecycle, dependency wiring, CORS, errors
  routes/
    forecast_routes.py              HTTP endpoints and request parameters
    health_routes.py                Process health endpoint
  controllers/
    forecast_controller.py          Validate request model and delegate to service
  models/
    forecast.py                     Typed requests, datasets, rows and responses
  services/
    forecast_service.py             BUSINESS LOGIC: cutoff selection, delivery slots,
                                   forecast age, errors, MAE, RMSE and bias
  repositories/
    elexon_repository.py            Elexon requests, source normalization and deduplication
    cache_repository.py             SQLite response cache
```

Routes call controllers; controllers call the service; the service uses an ElexonRepository object created during application startup. Business calculations do not depend on HTTP. Tests mock repository loading or HTTP responses to avoid contacting Elexon. Forecast selection and accuracy calculations run exclusively in the Python service; the frontend displays its response.

Python model attributes use snake_case (for example, `forecast_mw`). Pydantic aliases preserve the frontend's JSON names (`forecastMW`). Start with `ForecastService.get_analytics`, then follow `analyze`, `build_interval_row` and `calculate_metrics` to read the calculation flow. The Elexon repository keeps normalization, archive request construction and HTTP retries in separate functions.

## API

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Process liveness; does not claim upstream availability |
| `GET /api/v1/analytics` | Selected forecast rows, coverage inputs, server-calculated metrics and source metadata |
| `GET /api/v1/dataset` | Normalized forecast revisions and latest returned actuals for the challenge archive |
| `GET /docs` | Interactive OpenAPI documentation |

Analytics parameters:

- `mode`: `accuracy` (default) or `decision`.
- `start`, `end`: inclusive **decision dates**, bounded to January 2026; default January 1–31. Decision mode requires equal dates.
- `cutoff`: UTC `HH:MM`, default `10:00`.
- `refresh`: `true` bypasses cached upstream responses; default `false`. Supported on both data endpoints.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/analytics?start=2026-01-01&end=2026-01-01&cutoff=10:00'
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/analytics?mode=decision&start=2026-01-31&end=2026-01-31&cutoff=09:00'
```

JSON field names match the frontend: `rows`, `metrics`, `actualsThrough`, `metadata`; each row includes `targetTime`, `decisionTime`, `publishTime`, `forecastMW`, `actualMW`, `errorMW`, `absoluteErrorMW`, `ageHours`, `eligibleRevisions`, and `actualStatus`. Unavailable numeric values are `null`. Metadata includes source, oldest constituent fetch time, cache status, retrieval window and warnings.

Invalid selections return HTTP 422; upstream errors return 502, and bounded retrieval timeouts return 504. No partial or synthetic response is returned on retrieval failure.

## Data and calculation rules

- Elexon endpoints: `datasets/WINDFOR/stream` filtered by publication time and `datasets/FUELHH/stream` filtered by settlement date and `fuelType=WIND`. See the [official API schema](https://data.elexon.co.uk/swagger/v1/swagger.json).
- Forecast publication window: December 25, 2025 through January 31, 2026, with a seven-day lookback before the first decision. This is a bounded challenge archive, not an unrestricted historical service; older revisions outside the window cannot be selected.
- Delivery window: January 2 through February 1, 2026. January 31 decisions therefore include February delivery. All comparisons and displayed timestamps use UTC.
- Each decision day produces 48 expected half-hour slots. For each target, choose the latest forecast publication **at or before** that day's cutoff. Later revisions are excluded. Missing forecasts remain visible as unavailable.
- The retrieved WINDFOR archive has hourly target points. Match exact target timestamps only: do not interpolate, forward-fill, or treat missing half-hours as zero. Coverage and matched-pair counts make this limitation visible. Sparse forecasts appear as chart points.
- Actuals use the latest returned publication per target. Historical accuracy is retrospective against these actuals, not a reconstruction of actuals known at the decision time. Day-ahead mode hides actuals and errors.
- Duplicate identical forecasts are collapsed. Conflicting records at the same target/publication timestamp and invalid numeric/timestamp values fail explicitly. Non-WIND actuals are excluded.
- Error = forecast − actual; MAE = mean absolute error; RMSE = square root of mean squared error; bias = mean signed error. Only matched pairs contribute, including valid zero values. No pairs yields `metrics: null`.
- Missing actuals are marked pending only while their delivery interval has not finished; otherwise missing.
- Forecast age is measured from publication to decision cutoff. A 12-hour freshness warning and the 10:00 default cutoff are illustrative, not market requirements.

## Reliability and configuration

Upstream requests run in seven-day chunks with at most three concurrent requests, bounded retries for network errors/429/5xx, a 30-second HTTP timeout and a 90-second overall retrieval limit. SQLite caches upstream responses for one hour; expired entries are not silently served. Refresh forces new retrieval. Concurrent loads are serialized per backend process.

Optional settings are documented in `backend/.env.example`: `CACHE_PATH`, `CACHE_TTL_SECONDS`, `CORS_ORIGINS`. Copy it to `backend/.env` if that file does not exist. The backend loads this file automatically; existing shell or hosting environment variables take precedence. Default cache: `backend/.cache/elexon.sqlite3`.

Set `CORS_ORIGINS` in `backend/.env` to the frontend origins allowed to make browser requests to the API, separated by commas:

```dotenv
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://your-frontend.vercel.app
```

Replace the example deployment URL with your actual frontend origin. Include the scheme (`http://` or `https://`) and port when needed, but no path or trailing slash. Restart the backend after changing this file. Docker Compose also reads `backend/.env`; run `docker compose up -d --build` to apply changes. On a hosting platform, set `CORS_ORIGINS` in its environment settings. The local `.env` file is ignored by Git and excluded from the Docker image.

This small local service has no authentication and is intended for this dashboard; review access control/rate limiting before public hosting.

## Verify

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
cd ../dashboard
pnpm test
pnpm build
```

Backend tests use mocked HTTP responses and temporary databases, covering eligibility, boundaries, metrics, validation, source normalization, cache expiry, retries and API errors. Frontend unit tests cover date validation, formatting, empty coverage and API response validation. The frontend build checks TypeScript and generates production assets.

## Docker

With Docker Desktop running in Linux-container mode:

```powershell
docker compose up --build
```

Open **http://127.0.0.1:8080**. Nginx serves the production frontend and proxies `/api` to FastAPI. A named volume persists the SQLite cache. API docs are available on localhost port 8000. Stop an existing local backend first if it already occupies port 8000. `docker compose down` stops the containers and retains cached data.

Container execution requires a working Docker daemon. The local application can run independently using the commands above.
