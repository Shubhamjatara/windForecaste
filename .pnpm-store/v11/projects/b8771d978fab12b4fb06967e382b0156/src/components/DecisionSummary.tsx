import { Card, CardContent } from '@/components/ui/card'
import { formatMW } from '@/lib/forecast'
import type { ForecastRow } from '@/types/forecast'

export function DecisionSummary({ rows }: { rows: ForecastRow[] }) {
  const values = rows.flatMap(row => row.forecastMW === null ? [] : [row.forecastMW])
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const items = [{ title: 'Average forecast generation', value: average }, { title: 'Lowest forecast interval', value: values.length ? Math.min(...values) : null }, { title: 'Highest forecast interval', value: values.length ? Math.max(...values) : null }]
  return <section aria-label="Day-ahead forecast summary" className="mb-6 grid gap-4 md:grid-cols-3">{items.map(item => <Card key={item.title} className="shadow-none"><CardContent><h3 className="text-xs text-muted-foreground">{item.title}</h3><p className="mt-3 text-3xl font-semibold tabular-nums">{item.value === null ? 'Unavailable' : formatMW(item.value)} <span className="text-sm font-normal text-muted-foreground">{item.value !== null ? 'MW' : ''}</span></p><p className="mt-2 text-[11px] text-muted-foreground">Based on {values.length} eligible delivery intervals</p></CardContent></Card>)}</section>
}

