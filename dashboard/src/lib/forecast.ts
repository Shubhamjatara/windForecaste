import type {
  DateRange,
  DecisionSettings,
  ForecastRow,
} from "@/types/forecast";

export const DEFAULT_RANGE: DateRange = {
  start: "2026-01-01",
  end: "2026-01-31",
};
export const DEFAULT_SETTINGS: DecisionSettings = {
  mode: "accuracy",
  decisionDate: "2026-01-31",
  cutoffTime: "10:00",
  range: DEFAULT_RANGE,
};
export const STALE_HOURS = 12; // Illustrative threshold, not a market rule.
const DAY = 86_400_000;
export const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
export const formatMW = (value: number) => numberFormatter.format(value);
export const formatSignedMW = (value: number) =>
  `${value > 0 ? "+" : ""}${formatMW(value)}`;
export const shiftDate = (value: string, days: number) =>
  new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
export const decisionRange = (settings: DecisionSettings): DateRange =>
  settings.mode === "decision"
    ? { start: settings.decisionDate, end: settings.decisionDate }
    : settings.range;
export const deliveryRange = (settings: DecisionSettings): DateRange => {
  const range = decisionRange(settings);
  return { start: shiftDate(range.start, 1), end: shiftDate(range.end, 1) };
};
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateDateRange(range: DateRange): string | null {
  if (!range.start || !range.end)
    return "Select both a start date and an end date.";
  if (!validDate(range.start) || !validDate(range.end))
    return "Enter valid dates for the selected period.";
  if (range.start > range.end)
    return "Start date must be on or before end date.";
  return null;
}
export function validateSettings(settings: DecisionSettings): string | null {
  const range = decisionRange(settings);
  const issue = validateDateRange(range);
  if (issue) return issue;
  if (range.start < DEFAULT_RANGE.start || range.end > DEFAULT_RANGE.end)
    return "Choose decision dates within January 2026.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.cutoffTime))
    return "Enter a valid decision time in UTC.";
  return null;
}
export function coverage(rows: ForecastRow[]) {
  const ages = rows.flatMap((row) =>
    row.ageHours === null ? [] : [row.ageHours],
  );
  return {
    expected: rows.length,
    forecasts: rows.filter((row) => row.forecastMW !== null).length,
    matched: rows.filter((row) => row.errorMW !== null).length,
    actuals: rows.filter((row) => row.actualMW !== null).length,
    missingActuals: rows.filter((row) => row.actualStatus === "missing").length,
    pendingActuals: rows.filter((row) => row.actualStatus === "pending").length,
    stale: ages.filter((age) => age > STALE_HOURS).length,
    minAge: ages.length ? Math.min(...ages) : null,
    maxAge: ages.length ? Math.max(...ages) : null,
  };
}
export function formatTimestamp(
  value: string | number,
  withYear = false,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}
export function formatPeriod(range: DateRange): string {
  if (range.start === range.end) return formatShortDate(range.start);
  if (
    range.start.slice(0, 7) === range.end.slice(0, 7) &&
    range.start.endsWith("-01") &&
    shiftDate(range.end, 1).endsWith("-01")
  )
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${range.start}T00:00:00Z`));
  return `${formatShortDate(range.start)} – ${formatShortDate(range.end)}`;
}
export function createCSV(rows: ForecastRow[]): string {
  const header =
    "Decision Time (UTC),Target Time (UTC),Forecast Publish Time (UTC),Forecast Generation (MW),Actual Generation (MW),Forecast Error (MW),Absolute Error (MW),Forecast Age at Decision (hours),Actual Status,Eligible Revisions";
  return [
    header,
    ...rows.map((row) =>
      [
        row.decisionTime,
        row.targetTime,
        row.publishTime,
        row.forecastMW,
        row.actualMW,
        row.errorMW,
        row.absoluteErrorMW,
        row.ageHours,
        row.actualStatus,
        row.eligibleRevisions,
      ].join(","),
    ),
  ].join("\r\n");
}
