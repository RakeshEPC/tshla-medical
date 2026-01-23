/**
 * Lab Graph Modal Component
 * Shows interactive line graph of lab value trends over time
 * Created: 2026-01-23
 */

import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface LabValue {
  value: number | string;
  date: string;
  unit: string;
}

interface LabGraphModalProps {
  testName: string;
  labValues: LabValue[];
  onClose: () => void;
}

export default function LabGraphModal({ testName, labValues, onClose }: LabGraphModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sort lab values by date (oldest first for graph)
  const sortedValues = [...labValues].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Extract numeric values
  const numericValues = sortedValues
    .map((lv) => (typeof lv.value === 'number' ? lv.value : parseFloat(String(lv.value))))
    .filter((v) => !isNaN(v));

  // Calculate statistics
  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const avgValue = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
  const latestValue = numericValues[numericValues.length - 1];
  const previousValue = numericValues.length > 1 ? numericValues[numericValues.length - 2] : null;

  // Calculate trend
  const trend =
    previousValue !== null
      ? latestValue > previousValue
        ? 'up'
        : latestValue < previousValue
        ? 'down'
        : 'stable'
      : 'stable';

  const trendPercentage =
    previousValue !== null && previousValue !== 0
      ? (((latestValue - previousValue) / previousValue) * 100).toFixed(1)
      : '0.0';

  /**
   * Draw the line graph on canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || numericValues.length === 0) return;

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
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const graphWidth = rect.width - padding.left - padding.right;
    const graphHeight = rect.height - padding.top - padding.bottom;

    // Value range (add 10% padding)
    const valueRange = maxValue - minValue;
    const valuePadding = valueRange * 0.1;
    const yMin = minValue - valuePadding;
    const yMax = maxValue + valuePadding;
    const yRange = yMax - yMin;

    // Draw grid lines (horizontal)
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (graphHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();

      // Y-axis labels
      const value = yMax - (yRange / gridLines) * i;
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(1), padding.left - 10, y + 4);
    }

    // Draw X-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    sortedValues.forEach((lv, idx) => {
      const x = padding.left + (graphWidth / (sortedValues.length - 1)) * idx;
      const date = new Date(lv.date);
      const label = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear() % 100}`;
      ctx.fillText(label, x, rect.height - 10);
    });

    // Draw line graph
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    sortedValues.forEach((lv, idx) => {
      const numValue =
        typeof lv.value === 'number' ? lv.value : parseFloat(String(lv.value));
      if (isNaN(numValue)) return;

      const x = padding.left + (graphWidth / (sortedValues.length - 1)) * idx;
      const y =
        padding.top + graphHeight - ((numValue - yMin) / yRange) * graphHeight;

      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw data points
    sortedValues.forEach((lv, idx) => {
      const numValue =
        typeof lv.value === 'number' ? lv.value : parseFloat(String(lv.value));
      if (isNaN(numValue)) return;

      const x = padding.left + (graphWidth / (sortedValues.length - 1)) * idx;
      const y =
        padding.top + graphHeight - ((numValue - yMin) / yRange) * graphHeight;

      // Outer circle (white)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner circle (blue)
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Value label on hover (show for all points)
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(lv.value), x, y - 12);
    });
  }, [sortedValues, numericValues, minValue, maxValue, yMin, yMax]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{testName}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Trend over {sortedValues.length} result{sortedValues.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50">
          {/* Latest Value */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500 uppercase mb-1">Latest</p>
            <p className="text-2xl font-bold text-gray-900">
              {latestValue.toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {sortedValues[sortedValues.length - 1].unit}
            </p>
          </div>

          {/* Trend */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500 uppercase mb-1">Trend</p>
            <div className="flex items-center space-x-2">
              {trend === 'up' ? (
                <TrendingUp className="w-6 h-6 text-red-600" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-6 h-6 text-green-600" />
              ) : (
                <Minus className="w-6 h-6 text-gray-600" />
              )}
              <span
                className={`text-xl font-bold ${
                  trend === 'up'
                    ? 'text-red-600'
                    : trend === 'down'
                    ? 'text-green-600'
                    : 'text-gray-600'
                }`}
              >
                {trend === 'stable' ? '—' : `${trendPercentage}%`}
              </span>
            </div>
          </div>

          {/* Average */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500 uppercase mb-1">Average</p>
            <p className="text-2xl font-bold text-gray-900">
              {avgValue.toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {sortedValues[0].unit}
            </p>
          </div>

          {/* Range */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500 uppercase mb-1">Range</p>
            <p className="text-xl font-bold text-gray-900">
              {minValue.toFixed(1)} - {maxValue.toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {sortedValues[0].unit}
            </p>
          </div>
        </div>

        {/* Graph */}
        <div className="p-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: '400px' }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="p-6 pt-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Results</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900">
                    Date
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-900">
                    Value
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-gray-900">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...sortedValues].reverse().map((lv, idx) => (
                  <tr
                    key={idx}
                    className={`${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } border-t border-gray-200`}
                  >
                    <td className="p-4 text-sm text-gray-900">
                      {new Date(lv.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="p-4 text-sm text-gray-900 text-right font-semibold">
                      {lv.value}
                    </td>
                    <td className="p-4 text-sm text-gray-600 text-right">
                      {lv.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Close Button */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
