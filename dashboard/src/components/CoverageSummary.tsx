import { Clock3, Database, Layers3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { coverage, formatTimestamp, STALE_HOURS } from "@/lib/forecast";
import type { ForecastRow } from "@/types/forecast";

export function CoverageSummary({
  rows,
  planning,
  actualsThrough,
}: {
  rows: ForecastRow[];
  planning: boolean;
  actualsThrough: string | null;
}) {
  const stats = coverage(rows);
  return (
    <Card className="mb-5 gap-0 bg-[#f4f8f5] py-0 shadow-none">
      <CardContent className="grid gap-4 px-5 py-4 text-xs md:grid-cols-3">
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Layers3 size={14} />
            Forecast coverage
          </p>
          <p data-testid="forecast-coverage">
            {stats.forecasts.toLocaleString("en-GB")} /{" "}
            {stats.expected.toLocaleString("en-GB")} half-hour intervals
          </p>
          <p className="mt-1 text-muted-foreground">
            {stats.expected - stats.forecasts} without an eligible forecast
          </p>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Database size={14} />
            {planning ? "Decision-time information" : "Accuracy coverage"}
          </p>
          {planning ? (
            <p className="leading-relaxed text-muted-foreground">
              Actuals and errors are hidden in this view: delivery occurs after
              the decision.
            </p>
          ) : (
            <>
              <p data-testid="matched-coverage">
                {stats.matched.toLocaleString("en-GB")} matched pairs ·{" "}
                {stats.actuals.toLocaleString("en-GB")} actuals
              </p>
              <p className="mt-1 text-muted-foreground">
                {stats.missingActuals} missing actuals · {stats.pendingActuals}{" "}
                pending actuals
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Latest returned actual{" "}
                {actualsThrough
                  ? formatTimestamp(actualsThrough, true) + " UTC"
                  : "unavailable"}
              </p>
            </>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Clock3 size={14} />
            Forecast age at decision
          </p>
          <p data-testid="forecast-age">
            {stats.minAge === null
              ? "No eligible forecasts"
              : stats.minAge === stats.maxAge
                ? stats.minAge.toFixed(1) + " hours"
                : stats.minAge.toFixed(1) +
                  "–" +
                  stats.maxAge!.toFixed(1) +
                  " hours"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {stats.stale} older than {STALE_HOURS} hours · illustrative
            freshness threshold
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
