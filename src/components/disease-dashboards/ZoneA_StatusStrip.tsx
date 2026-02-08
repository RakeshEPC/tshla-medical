/**
 * Zone A: Status Strip Component
 *
 * Universal top strip for disease dashboards.
 * Shows: "Why am I here?" - disease status, headline, and changes since last visit.
 * Answers the question in 10 seconds.
 */

import { AlertCircle, TrendingUp, TrendingDown, Minus, Clock, Calendar } from 'lucide-react';

export type StatusType = 'critical' | 'suboptimal' | 'stable' | 'improving' | 'unknown';

export interface StatusChange {
  metric: string;
  previousValue: string | number;
  currentValue: string | number;
  direction: 'up' | 'down' | 'stable';
  isGood?: boolean; // Whether this direction is good (e.g., A1c down = good)
}

export interface ZoneAProps {
  disease: string;
  status: StatusType;
  headline: string; // One-liner explaining the situation
  changes?: StatusChange[];
  lastVisitDate?: string;
  className?: string;
}

// Status colors and icons
const statusConfig: Record<StatusType, { bg: string; border: string; text: string; dot: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    dot: 'bg-red-500'
  },
  suboptimal: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500'
  },
  stable: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    dot: 'bg-green-500'
  },
  improving: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-blue-500'
  },
  unknown: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    dot: 'bg-gray-400'
  }
};

const statusLabels: Record<StatusType, string> = {
  critical: 'Critical',
  suboptimal: 'Suboptimal',
  stable: 'Stable',
  improving: 'Improving',
  unknown: 'Needs Review'
};

export default function ZoneA_StatusStrip({
  disease,
  status,
  headline,
  changes = [],
  lastVisitDate,
  className = ''
}: ZoneAProps) {
  const config = statusConfig[status];

  // Format last visit date
  const formatLastVisit = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`rounded-lg border ${config.bg} ${config.border} p-4 ${className}`}>
      {/* Header Row: Disease + Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Status Dot */}
          <div className={`w-3 h-3 rounded-full ${config.dot} animate-pulse`} />

          {/* Disease Name + Status */}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{disease}</h2>
            <span className={`text-sm font-medium ${config.text}`}>
              – {statusLabels[status]}
            </span>
          </div>
        </div>

        {/* Last Visit */}
        {lastVisitDate && (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Last visit: {formatLastVisit(lastVisitDate)}</span>
          </div>
        )}
      </div>

      {/* Headline */}
      <p className={`text-base ${config.text} mb-3`}>
        "{headline}"
      </p>

      {/* Changes Since Last Visit */}
      {changes.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200/50">
          <span className="text-xs text-gray-500 font-medium">Since last visit:</span>
          {changes.map((change, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              {/* Trend Icon */}
              {change.direction === 'up' ? (
                <TrendingUp
                  className={`w-4 h-4 ${
                    change.isGood === true ? 'text-green-600' :
                    change.isGood === false ? 'text-red-600' :
                    'text-gray-500'
                  }`}
                />
              ) : change.direction === 'down' ? (
                <TrendingDown
                  className={`w-4 h-4 ${
                    change.isGood === true ? 'text-green-600' :
                    change.isGood === false ? 'text-red-600' :
                    'text-gray-500'
                  }`}
                />
              ) : (
                <Minus className="w-4 h-4 text-gray-400" />
              )}

              {/* Metric + Change */}
              <span className="text-sm text-gray-700">
                {change.metric}
                <span className={`font-medium ml-1 ${
                  change.isGood === true ? 'text-green-700' :
                  change.isGood === false ? 'text-red-700' :
                  'text-gray-700'
                }`}>
                  {change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→'}
                  {' '}
                  {typeof change.previousValue === 'number' && typeof change.currentValue === 'number'
                    ? `${Math.abs(change.currentValue - change.previousValue).toFixed(1)}`
                    : `${change.previousValue} → ${change.currentValue}`
                  }
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
