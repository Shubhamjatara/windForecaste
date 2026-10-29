import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesColumn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { formatChartDate } from "@/components/ForecastActualChart";
import type { ForecastRow } from "@/types/forecast";

export function ForecastErrorChart({ rows }: { rows: ForecastRow[] }) {
  const matchedCount = rows.filter((row) => row.errorMW !== null).length;
  const tickLabel = (timestamp: number) =>
    rows.length <= 48
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(timestamp))
      : formatChartDate(timestamp);
  return (
    <Card className="min-w-0 gap-0 rounded-xl border-border py-0 shadow-none">
      <CardHeader className="px-5 pb-0 pt-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ChartNoAxesColumn size={16} className="text-muted-foreground" />
          Forecast Error
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {matchedCount} matched intervals · unavailable pairs are excluded
        </p>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-5 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pl-1">
          <span className="text-[10px] text-muted-foreground">Error (MW)</span>
          <div
            className="flex gap-3 text-[10px] text-muted-foreground"
            aria-label="Chart legend"
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-[#73a28b]" />
              Over-forecast
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-[#b3a5c6]" />
              Under-forecast
            </span>
          </div>
        </div>
        {matchedCount === 0 ? (
          <div
            className="flex h-[260px] items-center justify-center p-6 text-center text-sm text-muted-foreground sm:h-[280px]"
            role="status"
          >
            Accuracy is unavailable until forecast and actual generation can be
            matched.
          </div>
        ) : (
          <div
            className="h-[260px] w-full sm:h-[280px]"
            role="img"
            aria-label={`Bar chart showing positive and negative forecast errors for ${matchedCount} matched intervals. Exact values are available in the detailed data table.`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={rows}
                margin={{ top: 10, right: 8, left: -18, bottom: 4 }}
                barCategoryGap="12%"
                accessibilityLayer
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e9eeeb"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={tickLabel}
                  tick={{ fontSize: 10, fill: "#7a8590" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={58}
                  tickMargin={12}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#7a8590" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    Math.abs(value) >= 1000 ? `${value / 1000}k` : String(value)
                  }
                  tickMargin={6}
                />
                <Tooltip
                  content={<ChartTooltip errorOnly />}
                  cursor={{ fill: "#f0f3f1" }}
                />
                <ReferenceLine y={0} stroke="#899c90" strokeWidth={1} />
                <Bar
                  dataKey="errorMW"
                  name="Forecast error"
                  maxBarSize={18}
                  isAnimationActive={false}
                >
                  {rows.map((row) => (
                    <Cell
                      key={row.id}
                      fill={
                        row.errorMW === null
                          ? "transparent"
                          : row.errorMW >= 0
                            ? "#73a28b"
                            : "#b3a5c6"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Target interval time (UTC)
        </p>
      </CardContent>
    </Card>
  );
}
