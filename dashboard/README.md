# Wind Forecast Analytics frontend

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts, Lucide React and TanStack Table. The dashboard uses **only the Python API** for forecast observations, eligible revisions, errors and accuracy metrics. The Python backend must be running; there is no offline dataset or generated fallback.

See [the root README](../README.md) for backend setup, API documentation, calculation rules, archive coverage and Docker instructions.

## Run

Use Node.js 22+ and pnpm 11. Start the Python API on port 8000, then:

```powershell
cd dashboard
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to http://127.0.0.1:8000. Refresh requests fresh upstream data through the backend; filter changes can reuse its one-hour response cache.

## Workflows

- **Day-ahead view:** choose a January 2026 decision date and UTC cutoff. The API returns the next day's 48 expected half-hour slots with the latest eligible forecast per target. Actuals and errors are hidden.
- **Historical accuracy:** choose decision dates and a daily UTC cutoff. The API applies that cutoff independently to each day and returns MAE, RMSE and bias for matched forecast/actual pairs.
- **Data explorer:** TanStack Table provides sorting and pagination. CSV exports include every selected interval in sort order, with decision time, publication time, forecast age, revision count and blanks for missing values.

All timestamps are UTC. January 31 decisions map to February 1 delivery. Exact timestamp alignment preserves gaps in the hourly WINDFOR archive; missing values are never zero-filled. Coverage, source warnings and fetch time are shown separately from forecast freshness.

## Loading and errors

Every load goes through `/api/v1/analytics`. Responses are validated before display. A new filter selection cancels the old request, and old results cannot overwrite the current selection. Loading disables relevant controls. Empty responses display an empty state; network or API errors display Retry. Obsolete source/demo URL parameters have no effect.

## Checks

```powershell
pnpm test
pnpm build
```

Unit tests cover date validation, formatting and API response validation. The build runs TypeScript checks and creates production assets.

## Structure

- `src/services/forecastService.ts`: validated API client.
- `src/hooks/useForecastData.ts`: cancellable loading and request state.
- `src/types/forecast.ts`: API response and UI control types.
- `src/lib/forecast.ts`: date validation/formatting, coverage summaries and CSV formatting.
- `src/components/`: dashboard controls, charts, metrics, table and feedback states.
- `src/components/ui/`: shadcn/ui components.

`components.json` configures shadcn/ui's new-york style with the `@/` alias. Theme bindings are in `src/index.css`, and the dashboard palette is in `src/dashboard.css`. Included components are ready to use; no registry installation is needed to start the app.
