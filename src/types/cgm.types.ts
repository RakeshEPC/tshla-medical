/**
 * CGM (Continuous Glucose Monitor) Types
 * Used by GlucoseTab and UnifiedPatientChart
 */

export interface CGMReading {
  glucose_value: number;
  glucose_units: string;
  trend_direction: string;
  trend_arrow: string;
  reading_timestamp: string;
  device_name?: string;
}

export interface CGMStats {
  avgGlucose: number;
  timeInRangePercent: number;
  timeBelowRangePercent: number;
  timeAboveRangePercent: number;
  estimatedA1c: number;
  lowEventsCount: number;
  highEventsCount: number;
  totalReadings: number;
  minGlucose?: number;
  maxGlucose?: number;
}

export interface CGMCurrentGlucose {
  glucoseValue: number;
  glucoseUnits: string;
  trendDirection: string;
  trendArrow: string;
  readingTimestamp: string;
  minutesAgo: number;
}

export interface CGMComparisonChange {
  metric: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
  unit: string;
}

export interface CGMComparison {
  lastVisitDate: string;
  periodLabel: string;
  changes: CGMComparisonChange[];
}

export interface CGMSummary {
  configured: boolean;
  dataSource: string;
  connectionStatus: string;
  syncEnabled: boolean;
  lastSync: string | null;
  currentGlucose: CGMCurrentGlucose | null;
  stats14day: CGMStats | null;
  comparison?: CGMComparison | null;
}

export type CGMTimeRange = '6h' | '12h' | '24h' | '7d' | '14d' | '30d';
