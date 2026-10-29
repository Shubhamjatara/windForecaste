import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  Crosshair,
  Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMW, formatSignedMW } from "@/lib/forecast";

interface Props {
  type: "mae" | "rmse" | "bias";
  value: number | null;
}
const definitions = {
  mae: {
    title: "Mean Absolute Error",
    acronym: "MAE",
    explanation: "Average magnitude of matched forecast errors",
    tooltip:
      "MAE = sum of absolute forecast errors ÷ matched interval count. Missing pairs are excluded. Lower values mean forecasts are closer to actual generation.",
    icon: Crosshair,
  },
  rmse: {
    title: "Root Mean Square Error",
    acronym: "RMSE",
    explanation: "Highlights larger forecast deviations",
    tooltip:
      "RMSE = square root of the mean squared forecast errors. Larger errors receive more weight. Lower is better.",
    icon: Activity,
  },
  bias: {
    title: "Forecast Bias",
    acronym: "BIAS",
    explanation: "Average direction of forecast errors",
    tooltip:
      "Bias = mean(forecast − actual). Positive means over-forecasting; negative means under-forecasting. Zero indicates no average directional bias.",
    icon: Scale,
  },
};

export function MetricCard({ type, value }: Props) {
  const definition = definitions[type];
  const Icon = definition.icon;
  return (
    <Card className="metric-card gap-0 rounded-xl border-border py-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between px-5 pb-0 pt-5">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-8 items-center justify-center rounded-lg ${type === "bias" ? "bg-[#f2f1f8] text-[#7b7199]" : "bg-[#eef5f1] text-[#4d7d64]"}`}
          >
            <Icon size={16} />
          </span>
          <CardTitle className="text-[13px] font-medium text-muted-foreground">
            {definition.title}
          </CardTitle>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label={`About ${definition.acronym}`}
            >
              <CircleHelp size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-xs leading-relaxed">
            {definition.tooltip}
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-4">
        <div className="flex items-baseline gap-2.5">
          <span
            data-testid={`metric-${type}`}
            className="text-[36px] font-semibold leading-none tracking-[-1.5px] tabular-nums"
          >
            {value === null
              ? "—"
              : type === "bias"
                ? formatSignedMW(value)
                : formatMW(value)}
          </span>
          <span className="text-sm text-muted-foreground">MW</span>
          <span className="ml-auto text-[10px] font-semibold tracking-[1px] text-muted-foreground">
            {definition.acronym}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {definition.explanation}
        </p>
        <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-[#587263]">
          {value === null ? (
            "No matched forecast / actual pairs"
          ) : type === "bias" ? (
            <>
              <ArrowUpRight size={13} />
              <span>
                {value > 0
                  ? "Over-forecasting on average"
                  : value < 0
                    ? "Under-forecasting on average"
                    : "No average directional bias"}
              </span>
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-[#80a28f]" />
              <span>Lower values indicate better accuracy</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
