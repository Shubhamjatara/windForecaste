import { useState } from "react";
import { ArrowRight, History, RotateCcw, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker, DateRangeFilter } from "@/components/DateRangeFilter";
import {
  DEFAULT_SETTINGS,
  decisionRange,
  deliveryRange,
  formatPeriod,
  validateSettings,
} from "@/lib/forecast";
import type { DecisionSettings } from "@/types/forecast";

export function DecisionControls({
  settings,
  disabled,
  onApply,
}: {
  settings: DecisionSettings;
  disabled: boolean;
  onApply: (settings: DecisionSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<DecisionSettings>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const switchMode = (mode: DecisionSettings["mode"]) => {
    // Keep valid applied values when switching; unsubmitted edits cannot bypass validation.
    const next = { ...settings, mode };
    setDraft(next);
    setError(null);
    onApply(next);
  };
  return (
    <Card className="mb-6 gap-0 py-0 shadow-none">
      <CardContent className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Dashboard view"
          >
            <Button
              variant={settings.mode === "decision" ? "default" : "ghost"}
              aria-pressed={settings.mode === "decision"}
              disabled={disabled}
              onClick={() => switchMode("decision")}
              className="h-9 gap-2 text-xs shadow-none"
            >
              <Wind size={14} />
              Day-ahead view
            </Button>
            <Button
              variant={settings.mode === "accuracy" ? "default" : "ghost"}
              aria-pressed={settings.mode === "accuracy"}
              disabled={disabled}
              onClick={() => switchMode("accuracy")}
              className="h-9 gap-2 text-xs shadow-none"
            >
              <History size={14} />
              Historical accuracy
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            January 2026 decisions · All times UTC
          </span>
        </div>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const issue = validateSettings(draft);
            setError(issue);
            if (!issue) onApply({ ...draft, range: { ...draft.range } });
          }}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            {settings.mode === "decision" ? (
              <DatePicker
                id="decision-date"
                label="Decision date"
                value={draft.decisionDate}
                disabled={disabled}
                invalid={!!error}
                onChange={(decisionDate) => change({ decisionDate })}
              />
            ) : (
              <DateRangeFilter
                range={draft.range}
                disabled={disabled}
                invalid={!!error}
                onChange={(range) => change({ range })}
              />
            )}
            <div className="flex flex-col gap-2 xl:w-44">
              <Label
                htmlFor="cutoff-time"
                className="text-xs text-muted-foreground"
              >
                Decision time (UTC)
              </Label>
              <input
                id="cutoff-time"
                type="time"
                step="60"
                value={draft.cutoffTime}
                disabled={disabled}
                onChange={(event) => change({ cutoffTime: event.target.value })}
                aria-invalid={!!error}
                aria-describedby="cutoff-note"
                className="h-10 rounded-md border border-input bg-white px-3 text-sm disabled:opacity-50"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={disabled}
                className="h-10 flex-1 text-xs"
              >
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                className="h-10 gap-2 text-xs text-muted-foreground"
                onClick={() => {
                  const next = structuredClone(DEFAULT_SETTINGS);
                  setDraft(next);
                  setError(null);
                  onApply(next);
                }}
              >
                <RotateCcw size={14} />
                Reset Filters
              </Button>
            </div>
          </div>
          {error && (
            <Alert
              id="decision-error"
              variant="destructive"
              className="mt-4 py-2"
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-xs">
          <span>
            <span className="text-muted-foreground">Decisions </span>
            {formatPeriod(decisionRange(settings))} at {settings.cutoffTime} UTC
          </span>
          <ArrowRight size={14} className="text-primary" />
          <span>
            <span className="text-muted-foreground">Delivery </span>
            <strong data-testid="delivery-period" className="font-medium">
              {formatPeriod(deliveryRange(settings))}
            </strong>
          </span>
        </div>
        <p
          id="cutoff-note"
          className="mt-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          10:00 UTC is an illustrative cutoff, not a stated market deadline.
          Only forecasts published at or before your selected time qualify.
          Historical accuracy applies that time separately to each decision day.
        </p>
      </CardContent>
    </Card>
  );
}
