import { decisionRange } from "@/lib/forecast";
import type { DecisionSettings, ForecastAnalysis } from "@/types/forecast";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
const isNullableNumber = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));
const isDate = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

export function validateAnalysis(
  value: unknown,
): asserts value is ForecastAnalysis {
  if (
    !isRecord(value) ||
    !Array.isArray(value.rows) ||
    !isRecord(value.metadata) ||
    value.metadata.source !== "elexon" ||
    !isDate(value.metadata.fetchedAt) ||
    typeof value.metadata.cached !== "boolean" ||
    !Array.isArray(value.metadata.warnings) ||
    !value.metadata.warnings.every((item) => typeof item === "string") ||
    !(value.actualsThrough === null || isDate(value.actualsThrough))
  )
    throw new Error("The backend returned an invalid analysis response.");
  for (const row of value.rows) {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      !isDate(row.targetTime) ||
      !isDate(row.decisionTime) ||
      !(row.publishTime === null || isDate(row.publishTime)) ||
      typeof row.timestamp !== "number" ||
      !Number.isFinite(row.timestamp) ||
      !["available", "pending", "missing", "hidden"].includes(
        String(row.actualStatus),
      ) ||
      ![
        "forecastMW",
        "actualMW",
        "errorMW",
        "absoluteErrorMW",
        "ageHours",
      ].every((key) => isNullableNumber(row[key])) ||
      !Number.isInteger(row.eligibleRevisions) ||
      Number(row.eligibleRevisions) < 0
    )
      throw new Error("The backend returned an invalid forecast interval.");
  }
  if (
    value.metrics !== null &&
    (!isRecord(value.metrics) ||
      !["mae", "rmse", "bias"].every(
        (key) =>
          typeof (value.metrics as Record<string, unknown>)[key] === "number" &&
          Number.isFinite((value.metrics as Record<string, unknown>)[key]),
      ) ||
      !Number.isInteger(value.metrics.count) ||
      Number(value.metrics.count) < 1)
  )
    throw new Error("The backend returned invalid accuracy metrics.");
}

export async function loadAnalysis(
  settings: DecisionSettings,
  signal: AbortSignal,
  refresh = false,
): Promise<ForecastAnalysis> {
  const range = decisionRange(settings);
  const params = new URLSearchParams({
    mode: settings.mode,
    start: range.start,
    end: range.end,
    cutoff: settings.cutoffTime,
    refresh: String(refresh),
  });
  let response: Response;
  try {
    response = await fetch(`/api/v1/analytics?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(100_000)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Unable to reach the Python backend or the request timed out. Check that it is running on port 8000, then retry.",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      isRecord(payload) && typeof payload.detail === "string"
        ? payload.detail
        : `The backend could not load Elexon data (HTTP ${response.status}). Please retry.`,
    );
  validateAnalysis(payload);
  return payload;
}
