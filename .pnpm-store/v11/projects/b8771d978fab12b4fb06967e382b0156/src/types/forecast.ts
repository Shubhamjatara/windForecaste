export interface ForecastRow {
  id: string
  targetTime: string
  timestamp: number
  decisionTime: string
  publishTime: string | null
  forecastMW: number | null
  actualMW: number | null
  actualStatus: 'available' | 'pending' | 'missing' | 'hidden'
  errorMW: number | null
  absoluteErrorMW: number | null
  ageHours: number | null
  eligibleRevisions: number
}
export interface DateRange { start: string; end: string }
export interface DecisionSettings {
  mode: 'decision' | 'accuracy'
  decisionDate: string
  cutoffTime: string
  range: DateRange
}
export interface ForecastMetrics { mae: number; rmse: number; bias: number; count: number }
export type DataStatus = 'loading' | 'success' | 'error'

export interface SourceMetadata {
  source: 'elexon'
  fetchedAt: string
  cached: boolean
  warnings: string[]
  alignment?: string
  forecastPublicationsFrom?: string
  forecastPublicationsTo?: string
}
export interface ForecastAnalysis {
  rows: ForecastRow[]
  metrics: ForecastMetrics | null
  actualsThrough: string | null
  metadata: SourceMetadata
}

