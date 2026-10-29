import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function LoadingState() {
  return <div role="status" aria-label="Loading forecast data" aria-busy="true" className="space-y-6">
    <span className="sr-only">Loading forecast data…</span>
    <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(key => <Card key={key} className="shadow-none"><CardContent className="space-y-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-10 w-32" /><Skeleton className="h-4 w-52 max-w-full" /></CardContent></Card>)}</div>
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">{[0, 1].map(key => <Card key={key} className="shadow-none"><CardContent className="space-y-6"><Skeleton className="h-5 w-40" /><Skeleton className="h-[300px] w-full" /></CardContent></Card>)}</div>
    <Card className="shadow-none"><CardContent className="space-y-4"><Skeleton className="h-6 w-52" />{[0, 1, 2, 3].map(key => <Skeleton key={key} className="h-9 w-full" />)}</CardContent></Card>
  </div>
}
