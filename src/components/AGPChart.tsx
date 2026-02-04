import React, { useRef, useEffect } from 'react';
import type { CGMReading } from '../types/cgm.types';

interface AGPChartProps {
  readings: CGMReading[];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

const AGPChart: React.FC<AGPChartProps> = ({ readings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    ctx.clearRect(0, 0, width, height);

    // Group readings by time-of-day into 288 5-minute buckets
    const buckets: number[][] = Array.from({ length: 288 }, () => []);
    for (const r of readings) {
      const d = new Date(r.reading_timestamp);
      const minuteOfDay = d.getHours() * 60 + d.getMinutes();
      const bucketIdx = Math.min(Math.floor(minuteOfDay / 5), 287);
      buckets[bucketIdx].push(r.glucose_value);
    }

    // Compute percentiles for each bucket
    const p5: number[] = [];
    const p25: number[] = [];
    const p50: number[] = [];
    const p75: number[] = [];
    const p95: number[] = [];

    for (let i = 0; i < 288; i++) {
      const vals = buckets[i];
      if (vals.length === 0) {
        // Interpolate from neighbors
        p5.push(p5.length > 0 ? p5[p5.length - 1] : 120);
        p25.push(p25.length > 0 ? p25[p25.length - 1] : 120);
        p50.push(p50.length > 0 ? p50[p50.length - 1] : 120);
        p75.push(p75.length > 0 ? p75[p75.length - 1] : 120);
        p95.push(p95.length > 0 ? p95[p95.length - 1] : 120);
      } else {
        p5.push(percentile(vals, 5));
        p25.push(percentile(vals, 25));
        p50.push(percentile(vals, 50));
        p75.push(percentile(vals, 75));
        p95.push(percentile(vals, 95));
      }
    }

    const minVal = 40;
    const maxVal = 350;
    const valueRange = maxVal - minVal;

    const toX = (bucketIdx: number) => padding.left + (bucketIdx / 287) * graphWidth;
    const toY = (v: number) => padding.top + graphHeight - ((v - minVal) / valueRange) * graphHeight;

    // Target range band (70-180)
    const y180 = toY(180);
    const y70 = toY(70);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.fillRect(padding.left, y180, graphWidth, y70 - y180);

    // Grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridValues = [54, 70, 100, 140, 180, 250, 300];
    for (const gv of gridValues) {
      const y = toY(gv);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();

      ctx.fillStyle = gv === 70 || gv === 180 ? '#22c55e' : '#9ca3af';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${gv}`, padding.left - 8, y + 4);
    }

    // 5th-95th percentile band (light blue)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.beginPath();
    for (let i = 0; i < 288; i++) {
      const x = toX(i);
      const y = toY(p95[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = 287; i >= 0; i--) {
      ctx.lineTo(toX(i), toY(p5[i]));
    }
    ctx.closePath();
    ctx.fill();

    // 25th-75th percentile band (darker blue)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.beginPath();
    for (let i = 0; i < 288; i++) {
      const x = toX(i);
      const y = toY(p75[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = 287; i >= 0; i--) {
      ctx.lineTo(toX(i), toY(p25[i]));
    }
    ctx.closePath();
    ctx.fill();

    // Median line (orange)
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 288; i++) {
      const x = toX(i);
      const y = toY(p50[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // X-axis labels (every 3 hours)
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let h = 0; h <= 24; h += 3) {
      const bucketIdx = Math.min((h * 60) / 5, 287);
      const x = toX(bucketIdx);
      const label = h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`;
      ctx.fillText(label, x, height - padding.bottom + 18);

      // Vertical tick
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, height - padding.bottom);
      ctx.lineTo(x, height - padding.bottom + 5);
      ctx.stroke();
    }

    // Legend
    const legendY = padding.top + 8;
    const legendX = padding.left + graphWidth - 180;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(legendX, legendY, 12, 8);
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('5th-95th %ile', legendX + 16, legendY + 8);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillRect(legendX, legendY + 14, 12, 8);
    ctx.fillStyle = '#6b7280';
    ctx.fillText('25th-75th %ile', legendX + 16, legendY + 22);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 32);
    ctx.lineTo(legendX + 12, legendY + 32);
    ctx.stroke();
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Median', legendX + 16, legendY + 36);

  }, [readings]);

  // Check if we have enough data (at least 3 days)
  if (readings.length < 288 * 3) {
    return (
      <div className="flex items-center justify-center h-72 text-gray-400">
        Need at least 3 days of data for multi-day overlay. Currently have {Math.floor(readings.length / 288)} day(s).
      </div>
    );
  }

  return (
    <div style={{ height: '350px' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default AGPChart;
