import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import type { ForecastRow } from "@/types/forecast";

export function formatChartDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function ForecastActualChart({
  rows,
  planning = false,
}: {
  rows: ForecastRow[];
  planning?: boolean;
}) {
  const singleDay = rows.length <= 48;
  const ticks = singleDay
    ? rows
        .filter((_, index) => [0, 12, 24, 36, 47].includes(index))
        .map((row) => row.timestamp)
    : undefined;
  const tickLabel = (timestamp: number) =>
    singleDay
      ? new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        }).format(new Date(timestamp))
      : formatChartDate(timestamp);
  return (
    <Card className="min-w-0 gap-0 rounded-xl border-border py-0 shadow-none">
      <CardHeader className="px-5 pb-0 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ChartNoAxesCombined size={16} className="text-muted-foreground" />
            {planning ? "Day-ahead Wind Forecast" : "Forecast vs Actual"}
          </CardTitle>
          <Badge
            variant="outline"
            className="rounded-md px-2 text-[10px] font-normal text-muted-foreground"
          >
            30-minute intervals
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {planning
            ? "Latest forecast available at the selected decision time"
            : "Decision-time forecasts compared with archived actuals. Gaps mean unavailable data."}
        </p>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-5 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pl-1">
          <span className="text-[10px] text-muted-foreground">
            Wind generation (MW)
          </span>
          <div
            className="flex gap-4 text-[10px] text-muted-foreground"
            aria-label="Chart legend"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[#2c8962]" />
              Forecast Generation
            </span>
            {!planning && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-[#8194ad]" />
                Actual Generation
              </span>
            )}
          </div>
        </div>
        <div
          className="h-[260px] w-full sm:h-[280px]"
          role="img"
          aria-label={`Line chart of ${planning ? "decision-time forecast" : "forecast and actual"} generation across ${rows.length} intervals. Exact values are available in the detailed data table.`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={rows}
              margin={{ top: 10, right: 12, left: -17, bottom: 4 }}
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="#e9eeeb"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={tickLabel}
                tick={{ fontSize: 10, fill: "#7a8590" }}
                axisLine={false}
                tickLine={false}
                minTickGap={45}
                tickMargin={12}
              />
              <YAxis
                tickFormatter={(value) =>
                  value >= 1000 ? `${value / 1000}k` : String(value)
                }
                tick={{ fontSize: 10, fill: "#7a8590" }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "#c2cfc7", strokeDasharray: "4 4" }}
              />
              {!planning && (
                <Line
                  name="Actual Generation"
                  type="monotone"
                  dataKey="actualMW"
                  stroke="#8194ad"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  connectNulls={false}
                  dot={rows.length === 1}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              )}
              <Line
                name="Forecast Generation"
                type="monotone"
                dataKey="forecastMW"
                stroke="#2c8962"
                strokeWidth={2}
                connectNulls={false}
                dot={rows.some(row => row.forecastMW === null) ? { r: 2, fill: '#2c8962', strokeWidth: 0 } : rows.length === 1}
                activeDot={{ r: 4, strokeWidth: 3, stroke: "#fff" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Target interval time (UTC)
        </p>
      </CardContent>
    </Card>
  );
}
