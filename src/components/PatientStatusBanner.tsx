/**
 * PatientStatusBanner
 * Displays AI-computed patient status from patient_daily_status table
 * Shows: status headline, changes, focus item, council status
 * Created: 2026-02-06
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Info,
  TrendingUp,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
  Clock,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientStatus {
  status_type: 'safety' | 'new_info' | 'trend' | 'stable';
  status_headline: string;
  status_emoji?: string;
  changes?: Array<{
    type: string;
    description: string;
    trend: string;
    date?: string;
  }>;
  focus_item?: string;
  focus_category?: string;
  next_action?: string;
  next_action_type?: string;
  council_status?: Record<string, {
    status: string;
    last_note_date?: string;
    summary?: string;
    provider_name?: string;
  }>;
  clinical_snapshot?: {
    latest_a1c?: { value: number; date: string; trend: string };
    time_in_range_24h?: number;
    active_medications_count?: number;
    days_since_last_visit?: number;
  };
  computed_at?: string;
}

interface PatientStatusBannerProps {
  tshlaId: string;
  onRefresh?: () => void;
}

const STATUS_CONFIG = {
  safety: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: AlertTriangle,
    iconColor: 'text-red-600',
  },
  new_info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: Info,
    iconColor: 'text-blue-600',
  },
  trend: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: TrendingUp,
    iconColor: 'text-green-600',
  },
  stable: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    icon: CheckCircle,
    iconColor: 'text-emerald-600',
  },
};

const COUNCIL_STATUS_COLORS = {
  stable: 'bg-green-100 text-green-800',
  monitoring: 'bg-yellow-100 text-yellow-800',
  due: 'bg-red-100 text-red-800',
};

export default function PatientStatusBanner({ tshlaId, onRefresh }: PatientStatusBannerProps) {
  const [status, setStatus] = useState<PatientStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [councilExpanded, setCouncilExpanded] = useState(false);

  useEffect(() => {
    if (tshlaId) {
      loadStatus();
    }
  }, [tshlaId]);

  const loadStatus = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/status?tshlaId=${encodeURIComponent(tshlaId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to load status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger status recomputation
      await fetch(`${API_BASE_URL}/api/patient-portal/refresh-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tshlaId }),
      });

      // Reload the status
      await loadStatus();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to refresh status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">
            {error || 'No status available'}
          </span>
          <button
            onClick={loadStatus}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[status.status_type] || STATUS_CONFIG.stable;
  const StatusIcon = config.icon;
  const councilEntries = Object.entries(status.council_status || {});

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg overflow-hidden`}>
      {/* Main Status Banner */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${config.bg}`}>
              <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {status.status_emoji && (
                  <span className="text-lg">{status.status_emoji}</span>
                )}
                <h3 className={`font-semibold ${config.text}`}>
                  {status.status_headline}
                </h3>
              </div>
              {status.computed_at && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {new Date(status.computed_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* What Changed */}
        {status.changes && status.changes.length > 0 && (
          <div className="mt-4 pl-11">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              What Changed
            </h4>
            <ul className="space-y-1">
              {status.changes.slice(0, 3).map((change, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      change.trend === 'improving'
                        ? 'bg-green-500'
                        : change.trend === 'worsening'
                        ? 'bg-red-500'
                        : change.trend === 'new'
                        ? 'bg-blue-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  {change.description}
                  {change.date && (
                    <span className="text-xs text-gray-400">
                      ({new Date(change.date).toLocaleDateString()})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Focus Item */}
        {status.focus_item && (
          <div className="mt-4 pl-11">
            <div className="bg-white/50 rounded-lg p-3 border border-white/80">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                What Matters Now
              </h4>
              <p className="text-sm font-medium text-gray-800">{status.focus_item}</p>
              {status.focus_category && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                  {status.focus_category.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Clinical Snapshot */}
        {status.clinical_snapshot && (
          <div className="mt-4 pl-11 flex flex-wrap gap-3">
            {status.clinical_snapshot.latest_a1c && (
              <div className="bg-white/50 rounded-lg px-3 py-2 border border-white/80">
                <span className="text-xs text-gray-500">A1C</span>
                <p className="text-lg font-bold text-gray-800">
                  {status.clinical_snapshot.latest_a1c.value}%
                </p>
              </div>
            )}
            {status.clinical_snapshot.time_in_range_24h !== undefined && (
              <div className="bg-white/50 rounded-lg px-3 py-2 border border-white/80">
                <span className="text-xs text-gray-500">TIR 24h</span>
                <p className="text-lg font-bold text-gray-800">
                  {status.clinical_snapshot.time_in_range_24h}%
                </p>
              </div>
            )}
            {status.clinical_snapshot.active_medications_count !== undefined && (
              <div className="bg-white/50 rounded-lg px-3 py-2 border border-white/80">
                <span className="text-xs text-gray-500">Meds</span>
                <p className="text-lg font-bold text-gray-800">
                  {status.clinical_snapshot.active_medications_count}
                </p>
              </div>
            )}
            {status.clinical_snapshot.days_since_last_visit !== undefined && (
              <div className="bg-white/50 rounded-lg px-3 py-2 border border-white/80">
                <span className="text-xs text-gray-500">Days Since Visit</span>
                <p className="text-lg font-bold text-gray-800">
                  {status.clinical_snapshot.days_since_last_visit}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Council Status (Collapsible) */}
      {councilEntries.length > 0 && (
        <div className="border-t border-white/50">
          <button
            onClick={() => setCouncilExpanded(!councilExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>Care Team Updates</span>
              <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-xs">
                {councilEntries.length}
              </span>
            </div>
            {councilExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {councilExpanded && (
            <div className="px-4 pb-4 space-y-2">
              {councilEntries.map(([specialty, info]) => (
                <div
                  key={specialty}
                  className="bg-white/50 rounded-lg p-3 border border-white/80"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800 capitalize">
                      {specialty}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        COUNCIL_STATUS_COLORS[info.status as keyof typeof COUNCIL_STATUS_COLORS] ||
                        'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {info.status}
                    </span>
                  </div>
                  {info.summary && (
                    <p className="text-sm text-gray-600">{info.summary}</p>
                  )}
                  {info.last_note_date && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last note: {new Date(info.last_note_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
