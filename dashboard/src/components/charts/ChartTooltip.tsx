import { formatMW, formatSignedMW, formatTimestamp } from '@/lib/forecast'
import type { ForecastRow } from '@/types/forecast'

interface Props { active?: boolean; payload?: ReadonlyArray<{ payload?: ForecastRow }>; errorOnly?: boolean }
export function ChartTooltip({ active, payload, errorOnly = false }: Props) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return <div className="min-w-52 rounded-lg border border-border bg-white px-4 py-3 text-xs shadow-lg">
    <p className="mb-3 border-b border-border pb-2 font-medium">{formatTimestamp(row.targetTime, true)} <span className="text-muted-foreground">UTC</span></p>
    {errorOnly ? <div className="flex justify-between gap-6"><span className="text-muted-foreground">Forecast error</span><span className="font-semibold">{row.errorMW === null ? 'Not evaluable' : formatSignedMW(row.errorMW) + ' MW'}</span></div> : <div className="space-y-2">
      <div className="flex items-center justify-between gap-6"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-0.5 w-3 bg-[#2c8962]" />Forecast</span><span className="font-semibold">{row.forecastMW === null ? 'Unavailable' : formatMW(row.forecastMW) + ' MW'}</span></div>
      <div className="flex items-center justify-between gap-6"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-0.5 w-3 bg-[#8194ad]" />Actual</span><span className="font-semibold">{row.actualMW === null ? row.actualStatus === 'hidden' ? 'Not known at decision' : row.actualStatus : formatMW(row.actualMW) + ' MW'}</span></div>
    </div>}
    <p className="mt-3 border-t border-border pt-2 text-muted-foreground">Decision: {formatTimestamp(row.decisionTime)} UTC</p>
    <p className="mt-1 text-muted-foreground">Published: {row.publishTime ? formatTimestamp(row.publishTime) + ' UTC' : 'Unavailable'}</p>
    {row.ageHours !== null && <p className="mt-1 text-muted-foreground">Age at decision: {row.ageHours.toFixed(1)} h</p>}
  </div>
}
