import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  deliveryRange,
  formatPeriod,
  formatTimestamp,
  validateSettings,
  coverage,
  createCSV,
} from "./forecast";
import { validateAnalysis } from "@/services/forecastService";

describe("API dashboard utilities", () => {
  it("maps January 31 decisions to February 1 delivery", () => {
    expect(
      deliveryRange({
        ...DEFAULT_SETTINGS,
        mode: "decision",
        decisionDate: "2026-01-31",
      }),
    ).toEqual({ start: "2026-02-01", end: "2026-02-01" });
  });
  it("rejects invalid dates, times and reversed ranges", () => {
    for (const patch of [
      { cutoffTime: "24:00" },
      { cutoffTime: "" },
      { range: { start: "2026-01-10", end: "2026-01-01" } },
      { range: { start: "2026-02-30", end: "2026-03-01" } },
      { range: { start: "2026-02-01", end: "2026-02-01" } },
    ])
      expect(
        validateSettings({ ...DEFAULT_SETTINGS, ...patch }),
      ).not.toBeNull();
    expect(validateSettings(DEFAULT_SETTINGS)).toBeNull();
  });
  it("formats UTC dates consistently", () => {
    expect(formatTimestamp("2026-01-01T00:00:00Z")).toContain("00:00");
    expect(formatPeriod(DEFAULT_SETTINGS.range)).toBe("January 2026");
    expect(formatPeriod(deliveryRange(DEFAULT_SETTINGS))).toBe(
      "02 Jan 2026 – 01 Feb 2026",
    );
  });
  it("handles empty API rows without fabricating coverage or export values", () => {
    expect(coverage([])).toMatchObject({
      expected: 0,
      matched: 0,
      forecasts: 0,
      minAge: null,
    });
    expect(createCSV([]).split("\r\n")).toHaveLength(1);
  });
  it("rejects missing or invalid API responses", () => {
    for (const value of [null, {}, { rows: [], metrics: { mae: 0 } }]) {
      expect(() => validateAnalysis(value)).toThrow(
        "invalid analysis response",
      );
    }
  });
});
