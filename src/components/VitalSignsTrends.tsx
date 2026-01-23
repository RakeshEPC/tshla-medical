/**
 * Vital Signs Trends Component
 * Shows BP and weight trends with mini graphs
 * Created: 2026-01-23
 */

import { useState, useEffect, useRef } from 'react';
import { Heart, TrendingUp, Activity } from 'lucide-react';

interface VitalValue {
  systolic?: number;
  diastolic?: number;
  value?: number;
  date: string;
  unit?: string;
}

interface VitalSignsTrendsProps {
  vitals: {
    [vitalName: string]: VitalValue[];
  };
}

export default function VitalSignsTrends({ vitals }: VitalSignsTrendsProps) {
  const bpCanvasRef = useRef<HTMLCanvasElement>(null);
  const weightCanvasRef = useRef<HTMLCanvasElement>(null);

  // Extract BP and Weight data
  const bpData = vitals['Blood Pressure'] || [];
  const weightData = vitals['Weight'] || [];

  // Sort by date (oldest first for graphs)
  const sortedBP = [...bpData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const sortedWeight = [...weightData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate BP statistics
  const latestBP = sortedBP.length > 0 ? sortedBP[sortedBP.length - 1] : null;
  const avgSystolic =
    sortedBP.length > 0
      ? sortedBP.reduce((sum, v) => sum + (v.systolic || 0), 0) / sortedBP.length
      : 0;
  const avgDiastolic =
    sortedBP.length > 0
      ? sortedBP.reduce((sum, v) => sum + (v.diastolic || 0), 0) / sortedBP.length
      : 0;

  // Calculate Weight statistics
  const latestWeight =
    sortedWeight.length > 0 ? sortedWeight[sortedWeight.length - 1] : null;
  const avgWeight =
    sortedWeight.length > 0
      ? sortedWeight.reduce((sum, v) => sum + (v.value || 0), 0) / sortedWeight.length
      : 0;
  const weightChange =
    sortedWeight.length > 1
      ? (sortedWeight[sortedWeight.length - 1].value || 0) - (sortedWeight[0].value || 0)
      : 0;

  /**
   * Draw BP graph (dual line for systolic/diastolic)
   */
  useEffect(() => {
    const canvas = bpCanvasRef.current;
    if (!canvas || sortedBP.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Padding
    const padding = { top: 20, right: 20, bottom: 30, left: 45 };
    const graphWidth = rect.width - padding.left - padding.right;
    const graphHeight = rect.height - padding.top - padding.bottom;

    // Value ranges
    const systolicValues = sortedBP.map((v) => v.systolic || 0);
    const diastolicValues = sortedBP.map((v) => v.diastolic || 0);
    const allValues = [...systolicValues, ...diastolicValues];
    const minValue = Math.min(...allValues) - 10;
    const maxValue = Math.max(...allValues) + 10;
    const valueRange = maxValue - minValue;

    // Draw background zones
    // Hypertension zone (>140/90) - light red
    const hypertensionY =
      padding.top + graphHeight - ((140 - minValue) / valueRange) * graphHeight;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.fillRect(padding.left, padding.top, graphWidth, hypertensionY - padding.top);

    // Normal zone (120-140 systolic) - light green
    const normalTopY =
      padding.top + graphHeight - ((140 - minValue) / valueRange) * graphHeight;
    const normalBottomY =
      padding.top + graphHeight - ((120 - minValue) / valueRange) * graphHeight;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
    ctx.fillRect(
      padding.left,
      normalTopY,
      graphWidth,
      normalBottomY - normalTopY
    );

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (graphHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();
    }

    // Draw systolic line (red)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    sortedBP.forEach((v, idx) => {
      const x = padding.left + (graphWidth / (sortedBP.length - 1)) * idx;
      const y =
        padding.top +
        graphHeight -
        (((v.systolic || 0) - minValue) / valueRange) * graphHeight;

      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw diastolic line (blue)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    sortedBP.forEach((v, idx) => {
      const x = padding.left + (graphWidth / (sortedBP.length - 1)) * idx;
      const y =
        padding.top +
        graphHeight -
        (((v.diastolic || 0) - minValue) / valueRange) * graphHeight;

      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw data points
    sortedBP.forEach((v, idx) => {
      const x = padding.left + (graphWidth / (sortedBP.length - 1)) * idx;

      // Systolic point
      const ySys =
        padding.top +
        graphHeight -
        (((v.systolic || 0) - minValue) / valueRange) * graphHeight;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, ySys, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, ySys, 3, 0, Math.PI * 2);
      ctx.fill();

      // Diastolic point
      const yDia =
        padding.top +
        graphHeight -
        (((v.diastolic || 0) - minValue) / valueRange) * graphHeight;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, yDia, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, yDia, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw legend
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';

    // Systolic
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(padding.left, rect.height - 20, 12, 3);
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Systolic', padding.left + 18, rect.height - 15);

    // Diastolic
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(padding.left + 90, rect.height - 20, 12, 3);
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Diastolic', padding.left + 108, rect.height - 15);
  }, [sortedBP]);

  /**
   * Draw Weight graph
   */
  useEffect(() => {
    const canvas = weightCanvasRef.current;
    if (!canvas || sortedWeight.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Padding
    const padding = { top: 20, right: 20, bottom: 30, left: 45 };
    const graphWidth = rect.width - padding.left - padding.right;
    const graphHeight = rect.height - padding.top - padding.bottom;

    // Value range
    const weightValues = sortedWeight.map((v) => v.value || 0);
    const minValue = Math.min(...weightValues) - 5;
    const maxValue = Math.max(...weightValues) + 5;
    const valueRange = maxValue - minValue;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (graphHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();
    }

    // Draw weight line (purple)
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    sortedWeight.forEach((v, idx) => {
      const x = padding.left + (graphWidth / (sortedWeight.length - 1)) * idx;
      const y =
        padding.top +
        graphHeight -
        (((v.value || 0) - minValue) / valueRange) * graphHeight;

      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw data points
    sortedWeight.forEach((v, idx) => {
      const x = padding.left + (graphWidth / (sortedWeight.length - 1)) * idx;
      const y =
        padding.top +
        graphHeight -
        (((v.value || 0) - minValue) / valueRange) * graphHeight;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [sortedWeight]);

  if (sortedBP.length === 0 && sortedWeight.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No vital signs recorded</p>
        <p className="text-xs text-gray-400 mt-2">
          Vital signs will be recorded during your visits
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blood Pressure Section */}
      {sortedBP.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-blue-50 rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Heart className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Blood Pressure Trend
              </h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Latest Reading</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestBP?.systolic}/{latestBP?.diastolic}
              </p>
              <p className="text-xs text-gray-500">
                {latestBP?.date &&
                  new Date(latestBP.date).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* BP Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Avg Systolic</p>
              <p className="text-xl font-bold text-red-600">
                {avgSystolic.toFixed(0)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Avg Diastolic</p>
              <p className="text-xl font-bold text-blue-600">
                {avgDiastolic.toFixed(0)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Readings</p>
              <p className="text-xl font-bold text-gray-900">{sortedBP.length}</p>
            </div>
          </div>

          {/* BP Graph */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <canvas
              ref={bpCanvasRef}
              className="w-full"
              style={{ height: '250px' }}
            />
          </div>

          {/* BP Target Info */}
          <div className="mt-4 bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Target:</span> Less than 140/90 mmHg
              (ideal &lt;120/80)
            </p>
          </div>
        </div>
      )}

      {/* Weight Section */}
      {sortedWeight.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Weight Trend
              </h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Latest Weight</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestWeight?.value} {latestWeight?.unit || 'lbs'}
              </p>
              <p className="text-xs text-gray-500">
                {latestWeight?.date &&
                  new Date(latestWeight.date).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Weight Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Average</p>
              <p className="text-xl font-bold text-purple-600">
                {avgWeight.toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Change</p>
              <p
                className={`text-xl font-bold ${
                  weightChange > 0
                    ? 'text-red-600'
                    : weightChange < 0
                    ? 'text-green-600'
                    : 'text-gray-600'
                }`}
              >
                {weightChange > 0 ? '+' : ''}
                {weightChange.toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Readings</p>
              <p className="text-xl font-bold text-gray-900">
                {sortedWeight.length}
              </p>
            </div>
          </div>

          {/* Weight Graph */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <canvas
              ref={weightCanvasRef}
              className="w-full"
              style={{ height: '250px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
