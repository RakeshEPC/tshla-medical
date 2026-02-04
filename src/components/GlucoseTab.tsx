import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, RefreshCw, TrendingUp, TrendingDown, Minus, BarChart3, LineChart, AlertTriangle, Sun, Moon, Sunrise, Sunset, Plus, Download } from 'lucide-react';
import type { CGMReading, CGMStats, CGMCurrentGlucose, CGMTimeRange, CGMComparison } from '../types/cgm.types';
import AGPChart from './AGPChart';
import CGMEventLogger from './CGMEventLogger';

interface CGMEvent {
  id: string;
  event_type: string;
  event_timestamp: string;
  carbs_grams?: number;
  meal_label?: string;
  insulin_units?: number;
  insulin_type?: string;
  exercise_minutes?: number;
  exercise_type?: string;
  notes?: string;
}

interface CGMPattern {
  type: string;
  window: string;
  windowLabel: string;
  severity: string;
  frequency: string;
  avgValue: number;
  detail: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface GlucoseTabProps {
  patientPhone: string;
  currentGlucose: CGMCurrentGlucose | null;
  stats14day: CGMStats | null;
  comparison?: CGMComparison | null;
  viewMode?: 'provider' | 'patient';
}

const TIME_RANGES: { value: CGMTimeRange; label: string; hours: number }[] = [
  { value: '6h', label: '6h', hours: 6 },
  { value: '12h', label: '12h', hours: 12 },
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d', label: '7d', hours: 168 },
  { value: '14d', label: '14d', hours: 336 },
  { value: '30d', label: '30d', hours: 720 },
];

function getGlucoseColor(value: number): string {
  if (value < 54) return '#dc2626'; // urgent low - red
  if (value < 70) return '#f59e0b'; // low - amber
  if (value <= 180) return '#22c55e'; // in range - green
  if (value <= 250) return '#f59e0b'; // high - amber
  return '#dc2626'; // very high - red
}

function getTrendIcon(direction: string) {
  switch (direction) {
    case 'DoubleUp':
    case 'SingleUp':
      return <TrendingUp className="w-6 h-6" />;
    case 'FortyFiveUp':
      return <TrendingUp className="w-6 h-6 transform -rotate-15" />;
    case 'Flat':
      return <Minus className="w-6 h-6" />;
    case 'FortyFiveDown':
      return <TrendingDown className="w-6 h-6 transform rotate-15" />;
    case 'SingleDown':
    case 'DoubleDown':
      return <TrendingDown className="w-6 h-6" />;
    default:
      return <Minus className="w-6 h-6" />;
  }
}

const GlucoseTab: React.FC<GlucoseTabProps> = ({ patientPhone, currentGlucose, stats14day, comparison, viewMode = 'provider' }) => {
  const [timeRange, setTimeRange] = useState<CGMTimeRange>('24h');
  const [chartMode, setChartMode] = useState<'trend' | 'multiday'>('trend');
  const [readings, setReadings] = useState<CGMReading[]>([]);
  const [allReadings, setAllReadings] = useState<CGMReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [patterns, setPatterns] = useState<CGMPattern[]>([]);
  const [events, setEvents] = useState<CGMEvent[]>([]);
  const [showEventLogger, setShowEventLogger] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartMappingRef = useRef<{
    sorted: CGMReading[];
    toX: (ts: string) => number;
    toY: (v: number) => number;
    padding: { top: number; right: number; bottom: number; left: number };
    graphWidth: number;
    graphHeight: number;
  } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; reading: CGMReading;
  } | null>(null);

  const fetchReadings = useCallback(async () => {
    const hours = TIME_RANGES.find(t => t.value === timeRange)?.hours || 24;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cgm/readings/${encodeURIComponent(patientPhone)}?hours=${hours}`);
      const data = await res.json();
      if (data.success) {
        setReadings(data.readings || []);
      }
    } catch (err) {
      console.error('Failed to fetch CGM readings:', err);
    } finally {
      setLoading(false);
    }
  }, [patientPhone, timeRange]);

  const fetchEvents = useCallback(async () => {
    const hours = TIME_RANGES.find(t => t.value === timeRange)?.hours || 24;
    try {
      const res = await fetch(`${API_BASE_URL}/api/cgm/events/${encodeURIComponent(patientPhone)}?hours=${hours}`);
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, [patientPhone, timeRange]);

  useEffect(() => {
    fetchReadings();
    fetchEvents();
  }, [fetchReadings, fetchEvents]);

  // Fetch all readings for multi-day mode
  useEffect(() => {
    if (chartMode !== 'multiday') return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/cgm/readings/${encodeURIComponent(patientPhone)}?hours=720`);
        const data = await res.json();
        if (data.success) setAllReadings(data.readings || []);
      } catch (err) {
        console.error('Failed to fetch all CGM readings:', err);
      } finally {
        setLoading(false);
      }
    };
    if (allReadings.length === 0) fetchAll();
  }, [chartMode, patientPhone]);

  // Fetch patterns on mount
  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cgm/patterns/${encodeURIComponent(patientPhone)}`);
        const data = await res.json();
        if (data.success) setPatterns(data.patterns || []);
      } catch (err) {
        console.error('Failed to fetch patterns:', err);
      }
    };
    fetchPatterns();
  }, [patientPhone]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API_BASE_URL}/api/cgm/sync/${encodeURIComponent(patientPhone)}`, { method: 'POST' });
      await fetchReadings();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cgm/backfill/${encodeURIComponent(patientPhone)}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchReadings();
        await fetchEvents();
      }
    } catch (err) {
      console.error('Backfill failed:', err);
    } finally {
      setBackfilling(false);
    }
  };

  // Draw Canvas chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || readings.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 55 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Sort readings chronologically
    const sorted = [...readings].sort(
      (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
    );

    const values = sorted.map(r => r.glucose_value);
    const minVal = Math.min(40, Math.min(...values) - 10);
    const maxVal = Math.max(300, Math.max(...values) + 10);
    const valueRange = maxVal - minVal;

    const timeMin = new Date(sorted[0].reading_timestamp).getTime();
    const timeMax = new Date(sorted[sorted.length - 1].reading_timestamp).getTime();
    const timeRange_ = timeMax - timeMin || 1;

    const toX = (ts: string) => padding.left + ((new Date(ts).getTime() - timeMin) / timeRange_) * graphWidth;
    const toY = (v: number) => padding.top + graphHeight - ((v - minVal) / valueRange) * graphHeight;

    // Store mapping for overlay interaction
    chartMappingRef.current = { sorted, toX, toY, padding, graphWidth, graphHeight };

    // Target range band (70-180)
    const y180 = toY(180);
    const y70 = toY(70);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.fillRect(padding.left, y180, graphWidth, y70 - y180);

    // High zone (>180)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
    ctx.fillRect(padding.left, padding.top, graphWidth, y180 - padding.top);

    // Low zone (<70)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
    ctx.fillRect(padding.left, y70, graphWidth, graphHeight + padding.top - y70);

    // Grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridValues = [54, 70, 100, 140, 180, 250];
    for (const gv of gridValues) {
      if (gv < minVal || gv > maxVal) continue;
      const y = toY(gv);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = gv === 70 || gv === 180 ? '#22c55e' : '#9ca3af';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${gv}`, padding.left - 8, y + 4);
    }

    // Target range labels
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Target', padding.left + 4, y180 + 12);

    // X-axis time labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labelCount = width < 500 ? 4 : 6;
    for (let i = 0; i <= labelCount; i++) {
      const t = timeMin + (timeRange_ / labelCount) * i;
      const x = padding.left + (graphWidth / labelCount) * i;
      const d = new Date(t);
      const hours_ = TIME_RANGES.find(tr => tr.value === timeRange)?.hours || 24;
      let label: string;
      if (hours_ <= 24) {
        label = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } else {
        label = `${d.getMonth() + 1}/${d.getDate()}`;
      }
      ctx.fillText(label, x, height - padding.bottom + 20);
    }

    // Draw line
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    sorted.forEach((r, idx) => {
      const x = toX(r.reading_timestamp);
      const y = toY(r.glucose_value);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw dots for sparse data (< 100 points) or for out-of-range values
    if (sorted.length < 100) {
      sorted.forEach(r => {
        const x = toX(r.reading_timestamp);
        const y = toY(r.glucose_value);
        const color = getGlucoseColor(r.glucose_value);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      // Only draw dots for out-of-range values
      sorted.forEach(r => {
        if (r.glucose_value < 70 || r.glucose_value > 180) {
          const x = toX(r.reading_timestamp);
          const y = toY(r.glucose_value);
          const color = getGlucoseColor(r.glucose_value);

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw event markers at the bottom of the chart
    const markerY = height - padding.bottom - 8;
    for (const evt of events) {
      const evtTime = new Date(evt.event_timestamp).getTime();
      if (evtTime < timeMin || evtTime > timeMax) continue;
      const x = padding.left + ((evtTime - timeMin) / timeRange_) * graphWidth;

      const size = 5;
      if (evt.event_type === 'meal') {
        // Orange triangle
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(x, markerY - size);
        ctx.lineTo(x - size, markerY + size);
        ctx.lineTo(x + size, markerY + size);
        ctx.closePath();
        ctx.fill();
      } else if (evt.event_type === 'insulin') {
        // Blue triangle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(x, markerY - size);
        ctx.lineTo(x - size, markerY + size);
        ctx.lineTo(x + size, markerY + size);
        ctx.closePath();
        ctx.fill();
      } else if (evt.event_type === 'exercise') {
        // Green diamond
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(x, markerY - size);
        ctx.lineTo(x + size, markerY);
        ctx.lineTo(x, markerY + size);
        ctx.lineTo(x - size, markerY);
        ctx.closePath();
        ctx.fill();
      } else {
        // Gray dot for notes
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(x, markerY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [readings, timeRange, events]);

  // Draw crosshair overlay
  const drawOverlay = useCallback((mouseX: number) => {
    const overlay = overlayRef.current;
    const mapping = chartMappingRef.current;
    if (!overlay || !mapping) return;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = overlay.getBoundingClientRect();
    overlay.width = rect.width * dpr;
    overlay.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const { sorted, toX, toY, padding } = mapping;
    if (sorted.length === 0) return;

    // Find nearest reading by X position
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const x = toX(sorted[i].reading_timestamp);
      const dist = Math.abs(x - mouseX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestDist > 50) {
      setTooltip(null);
      return;
    }

    const reading = sorted[nearestIdx];
    const x = toX(reading.reading_timestamp);
    const y = toY(reading.glucose_value);

    // Draw dashed vertical crosshair
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw highlighted dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = getGlucoseColor(reading.glucose_value);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = getGlucoseColor(reading.glucose_value);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();

    setTooltip({ x, y, reading });
  }, []);

  const clearOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    drawOverlay(e.clientX - rect.left);
  }, [drawOverlay]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    drawOverlay(touch.clientX - rect.left);
  }, [drawOverlay]);

  // Calculate stats from loaded readings
  const readingStats: CGMStats | null = React.useMemo(() => {
    if (readings.length === 0) return null;
    const values = readings.map(r => r.glucose_value);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const inRange = values.filter(v => v >= 70 && v <= 180).length;
    const below = values.filter(v => v < 70).length;
    const above = values.filter(v => v > 180).length;
    const tir = Math.round((inRange / values.length) * 100);
    const tbr = Math.round((below / values.length) * 100);
    const tar = Math.round((above / values.length) * 100);
    const gmi = Math.round((3.31 + 0.02392 * avg) * 10) / 10;
    return {
      avgGlucose: avg,
      timeInRangePercent: tir,
      timeBelowRangePercent: tbr,
      timeAboveRangePercent: tar,
      estimatedA1c: gmi,
      lowEventsCount: values.filter(v => v < 54).length,
      highEventsCount: above,
      totalReadings: values.length,
      minGlucose: Math.min(...values),
      maxGlucose: Math.max(...values),
    };
  }, [readings]);

  const displayStats = readingStats || stats14day;

  return (
    <div className="space-y-6">
      {/* Current Glucose + Sync */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {currentGlucose ? (
            <div className="flex items-center gap-3">
              <div
                className="text-5xl font-bold"
                style={{ color: getGlucoseColor(currentGlucose.glucoseValue) }}
              >
                {currentGlucose.glucoseValue}
              </div>
              <div className="flex flex-col">
                <div
                  className="flex items-center gap-1"
                  style={{ color: getGlucoseColor(currentGlucose.glucoseValue) }}
                >
                  {getTrendIcon(currentGlucose.trendDirection)}
                  <span className="text-lg font-medium">{currentGlucose.trendArrow}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {currentGlucose.minutesAgo <= 5
                    ? 'Just now'
                    : `${currentGlucose.minutesAgo} min ago`}
                </span>
                <span className="text-xs text-gray-400">mg/dl</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">
              <Activity className="w-10 h-10" />
              <p className="text-sm mt-1">No current reading</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEventLogger(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
          >
            <Plus className="w-4 h-4" />
            {viewMode === 'patient' ? 'Log Meal / Insulin / Exercise' : 'Log Event'}
          </button>
          {viewMode === 'provider' && (
            <>
              <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${backfilling ? 'animate-bounce' : ''}`} />
                {backfilling ? 'Loading...' : 'Get History'}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chart Mode Toggle + Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setChartMode('trend')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartMode === 'trend' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LineChart className="w-4 h-4" />
            Trend
          </button>
          <button
            onClick={() => setChartMode('multiday')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartMode === 'multiday' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Multi-Day
          </button>
        </div>

        {chartMode === 'trend' && (
          <div className="flex items-center gap-2">
            {TIME_RANGES.map(tr => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === tr.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Glucose Chart */}
      <div className="bg-gray-50 rounded-lg p-2" style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-72 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading readings...
          </div>
        ) : chartMode === 'multiday' ? (
          <AGPChart readings={allReadings.length > 0 ? allReadings : readings} />
        ) : readings.length === 0 ? (
          <div className="flex items-center justify-center h-72 text-gray-400">
            No readings for this time range
          </div>
        ) : (
          <div ref={chartContainerRef} className="relative" style={{ height: '300px' }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full absolute inset-0"
            />
            <canvas
              ref={overlayRef}
              className="w-full h-full absolute inset-0"
              style={{ cursor: 'crosshair' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={clearOverlay}
              onTouchStart={handleTouchMove}
              onTouchMove={handleTouchMove}
              onTouchEnd={clearOverlay}
            />
            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
                style={{
                  left: Math.min(tooltip.x + 12, (chartContainerRef.current?.clientWidth || 400) - 160),
                  top: Math.max(tooltip.y - 60, 4),
                }}
              >
                <div className="font-bold text-base" style={{ color: getGlucoseColor(tooltip.reading.glucose_value) }}>
                  {tooltip.reading.glucose_value} mg/dl
                </div>
                <div className="text-gray-300">
                  {tooltip.reading.trend_arrow} {tooltip.reading.trend_direction}
                </div>
                <div className="text-gray-400 mt-0.5">
                  {new Date(tooltip.reading.reading_timestamp).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {displayStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Avg Glucose</p>
            <p className="text-2xl font-bold text-gray-900">{displayStats.avgGlucose}</p>
            <p className="text-xs text-gray-400">mg/dl</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Time in Range</p>
            <p className="text-2xl font-bold" style={{ color: displayStats.timeInRangePercent >= 70 ? '#22c55e' : displayStats.timeInRangePercent >= 50 ? '#f59e0b' : '#ef4444' }}>
              {displayStats.timeInRangePercent}%
            </p>
            <p className="text-xs text-gray-400">70-180 mg/dl</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Est. A1C (GMI)</p>
            <p className="text-2xl font-bold text-gray-900">{displayStats.estimatedA1c}%</p>
            <p className="text-xs text-gray-400">Glucose Mgmt Indicator</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Low / High</p>
            <p className="text-2xl font-bold text-gray-900">
              <span className="text-red-500">{displayStats.lowEventsCount}</span>
              {' / '}
              <span className="text-amber-500">{displayStats.highEventsCount}</span>
            </p>
            <p className="text-xs text-gray-400">&lt;54 / &gt;180 readings</p>
          </div>
        </div>
      )}

      {/* TIR Breakdown Bar */}
      {displayStats && (
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Time in Range Breakdown</p>
          <div className="flex h-6 rounded-full overflow-hidden">
            {displayStats.timeBelowRangePercent > 0 && (
              <div
                className="bg-red-400 flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${Math.max(displayStats.timeBelowRangePercent, 3)}%` }}
                title={`Below range: ${displayStats.timeBelowRangePercent}%`}
              >
                {displayStats.timeBelowRangePercent >= 5 ? `${displayStats.timeBelowRangePercent}%` : ''}
              </div>
            )}
            <div
              className="bg-green-400 flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${displayStats.timeInRangePercent}%` }}
              title={`In range: ${displayStats.timeInRangePercent}%`}
            >
              {displayStats.timeInRangePercent}%
            </div>
            {displayStats.timeAboveRangePercent > 0 && (
              <div
                className="bg-amber-400 flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${Math.max(displayStats.timeAboveRangePercent, 3)}%` }}
                title={`Above range: ${displayStats.timeAboveRangePercent}%`}
              >
                {displayStats.timeAboveRangePercent >= 5 ? `${displayStats.timeAboveRangePercent}%` : ''}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>Low (&lt;70)</span>
            <span>In Range (70-180)</span>
            <span>High (&gt;180)</span>
          </div>
        </div>
      )}

      {/* Visit Comparison */}
      {comparison && (
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{comparison.periodLabel}</p>
          <div className="grid grid-cols-3 gap-4">
            {comparison.changes.map((change) => (
              <div key={change.metric} className="text-center">
                <p className="text-xs text-gray-500 mb-1">{change.label}</p>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-sm text-gray-400">{change.before}{change.unit}</span>
                  <span className={`text-lg font-bold ${change.improved ? 'text-green-600' : 'text-red-500'}`}>
                    {change.improved ? '→' : '→'}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{change.after}{change.unit}</span>
                </div>
                <div className={`text-xs font-medium ${change.improved ? 'text-green-600' : 'text-red-500'}`}>
                  {change.delta > 0 ? '+' : ''}{change.delta}{change.unit}
                  {change.improved ? ' ↓' : ' ↑'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detected Patterns */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Detected Patterns</p>
        {patterns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {patterns.map((p, i) => {
              const isLow = p.type === 'recurring_lows';
              const isDawn = p.type === 'dawn_phenomenon';
              const isVar = p.type === 'high_variability';
              const bgColor = isLow ? 'bg-red-50 border-red-200' : isDawn ? 'bg-blue-50 border-blue-200' : isVar ? 'bg-purple-50 border-purple-200' : 'bg-amber-50 border-amber-200';
              const iconColor = isLow ? 'text-red-500' : isDawn ? 'text-blue-500' : isVar ? 'text-purple-500' : 'text-amber-500';
              const WindowIcon = p.window === 'overnight' ? Moon : p.window === 'morning' ? Sunrise : p.window === 'evening' ? Sunset : Sun;

              return (
                <div key={i} className={`border rounded-lg p-3 ${bgColor}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <WindowIcon className={`w-4 h-4 ${iconColor}`} />
                    <span className="text-sm font-medium text-gray-800">
                      {p.type === 'recurring_highs' ? 'Recurring Highs' :
                       p.type === 'recurring_lows' ? 'Recurring Lows' :
                       p.type === 'dawn_phenomenon' ? 'Dawn Phenomenon' :
                       'High Variability'}
                    </span>
                    {p.severity === 'significant' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{p.detail}</p>
                  <p className="text-xs text-gray-400 mt-1">{p.frequency} &middot; {p.windowLabel}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-green-200 bg-green-50 rounded-lg p-3 text-center">
            <p className="text-sm text-green-700 font-medium">No recurring patterns detected</p>
            <p className="text-xs text-green-600 mt-1">No recurring highs, lows, dawn phenomenon, or high variability found in the last 14 days</p>
          </div>
        )}
      </div>

      {/* Reading count */}
      <p className="text-xs text-gray-400 text-right">
        {readings.length} readings loaded ({timeRange})
      </p>

      {/* Event Logger Modal */}
      {showEventLogger && (
        <CGMEventLogger
          patientPhone={patientPhone}
          onClose={() => setShowEventLogger(false)}
          onSaved={() => fetchEvents()}
        />
      )}
    </div>
  );
};

export default GlucoseTab;
