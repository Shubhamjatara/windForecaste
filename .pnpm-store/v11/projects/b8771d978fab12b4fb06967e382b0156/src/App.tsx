import { useState } from "react";
import { Clock3 } from "lucide-react";
import { DashboardHeader, SourceNotice } from "@/components/DashboardHeader";
import { DecisionControls } from "@/components/DecisionControls";
import { CoverageSummary } from "@/components/CoverageSummary";
import { DecisionSummary } from "@/components/DecisionSummary";
import { MetricCard } from "@/components/MetricCard";
import { ForecastActualChart } from "@/components/ForecastActualChart";
import { ForecastErrorChart } from "@/components/ForecastErrorChart";
import { ForecastDataTable } from "@/components/ForecastDataTable";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Methodology } from "@/components/Methodology";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForecastData } from "@/hooks/useForecastData";
import {
  DEFAULT_SETTINGS,
  decisionRange,
  deliveryRange,
  formatPeriod,
  formatTimestamp,
} from "@/lib/forecast";
import type { DecisionSettings } from "@/types/forecast";
import "./dashboard.css";

export default function App() {
  const [settings, setSettings] = useState<DecisionSettings>(() =>
    structuredClone(DEFAULT_SETTINGS),
  );
  const [filterKey, setFilterKey] = useState(0);
  const { analysis, status, error, refresh } = useForecastData(settings);
  const rows = analysis?.rows ?? [];
  const metrics = analysis?.metrics ?? null;
  const loading = status === "loading";
  const planning = settings.mode === "decision";
  const empty = rows.length === 0;
  function reset() {
    setSettings(structuredClone(DEFAULT_SETTINGS));
    setFilterKey((key) => key + 1);
  }
  return (
    <TooltipProvider delayDuration={200}>
      <a href="#dashboard-content" className="skip-link">
        Skip to dashboard
      </a>
      <div id="overview" className="page-shell">
        <DashboardHeader
          range={decisionRange(settings)}
          loading={loading}
          onRefresh={() => void refresh()}
        />
        <main
          id="dashboard-content"
          className="mx-auto max-w-360 px-5 sm:px-8 lg:px-12"
        >
          {/*   <SourceNotice /> */}
          <DecisionControls
            key={filterKey}
            settings={settings}
            disabled={loading}
            onApply={setSettings}
          />
        
          <div className="sr-only" aria-live="polite">
            {status === "success"
              ? `${rows.length} expected half-hour intervals. Decision time ${settings.cutoffTime} UTC. ${planning ? "Day-ahead view." : (metrics?.count ?? 0) + " matched pairs."}`
              : loading
                ? "Loading forecast data."
                : "Error loading forecast data."}
          </div>
          {loading ? (
            <LoadingState />
          ) : status === "error" ? (
            <ErrorState message={error} onRetry={() => void refresh()} />
          ) : empty ? (
            <EmptyState onReset={reset} />
          ) : (
            <>
              {analysis?.metadata.warnings.map((warning) => (
                <Alert
                  key={warning}
                  className="mb-4 border-amber-200 bg-amber-50"
                >
                  <AlertDescription className="text-xs text-amber-900">
                    {warning}
                  </AlertDescription>
                </Alert>
              ))}

              <section
                aria-label="Forecast charts"
                className={
                  planning ? "mb-6" : "mb-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]"
                }
              >
                <ForecastActualChart rows={rows} planning={planning} />
                {!planning && <ForecastErrorChart rows={rows} />}
              </section>
              <ForecastDataTable key={JSON.stringify(settings)} rows={rows} />
            </>
          )}
          <Methodology />
        </main>
      </div>
    </TooltipProvider>
  );
}
