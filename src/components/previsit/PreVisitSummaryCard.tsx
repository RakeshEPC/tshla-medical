/**
 * PreVisitSummaryCard Component
 * Displays compact pre-visit call summary with key information
 * Created: January 2025
 */

import {
  Phone,
  CheckCircle,
  AlertTriangle,
  Clock,
  Pill,
  MessageSquare,
  HelpCircle,
  Flag
} from 'lucide-react';

export interface PreVisitData {
  id: string;
  patient_id: string;
  call_completed: boolean;
  call_status: 'completed' | 'no-answer' | 'voicemail' | 'failed' | 'pending';
  call_date?: string;
  current_medications?: string[];
  chief_concerns?: string[];
  questions_for_provider?: string[];
  lab_status?: string;
  requires_urgent_callback: boolean;
  risk_flags?: string[];
  urgency_level?: 'low' | 'medium' | 'high' | 'critical';
  ai_summary?: string;
  full_transcript?: string;
}

interface PreVisitSummaryCardProps {
  preVisitData: PreVisitData | null;
  onViewDetails: () => void;
  compact?: boolean;
}

export default function PreVisitSummaryCard({
  preVisitData,
  onViewDetails,
  compact = false,
}: PreVisitSummaryCardProps) {
  // No pre-visit data yet
  if (!preVisitData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-gray-500">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Pre-visit call pending</span>
        </div>
      </div>
    );
  }

  // Call not completed yet
  if (!preVisitData.call_completed) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-yellow-700">
          <Phone className="w-4 h-4" />
          <span className="text-sm font-medium">
            {preVisitData.call_status === 'pending' && 'Pre-visit call scheduled'}
            {preVisitData.call_status === 'no-answer' && 'Pre-visit call - no answer'}
            {preVisitData.call_status === 'voicemail' && 'Pre-visit call - voicemail left'}
            {preVisitData.call_status === 'failed' && 'Pre-visit call - failed'}
          </span>
        </div>
      </div>
    );
  }

  // Call completed - show summary
  const urgencyColors = {
    low: 'bg-green-50 border-green-200',
    medium: 'bg-yellow-50 border-yellow-200',
    high: 'bg-orange-50 border-orange-200',
    critical: 'bg-red-50 border-red-200',
  };

  const urgencyTextColors = {
    low: 'text-green-700',
    medium: 'text-yellow-700',
    high: 'text-orange-700',
    critical: 'text-red-700',
  };

  const urgencyLevel = preVisitData.urgency_level || 'low';
  const bgColor = urgencyColors[urgencyLevel];
  const textColor = urgencyTextColors[urgencyLevel];

  if (compact) {
    return (
      <div className={`${bgColor} border rounded-lg p-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <CheckCircle className={`w-4 h-4 ${textColor}`} />
            <div className="text-sm">
              <div className={`font-medium ${textColor}`}>Pre-visit completed</div>
              {preVisitData.requires_urgent_callback && (
                <div className="flex items-center gap-1 text-red-600 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs font-medium">Urgent callback needed</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onViewDetails}
            className={`text-xs px-2 py-1 rounded ${textColor} hover:bg-opacity-80 transition-colors`}
          >
            View Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} border rounded-lg p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className={`w-5 h-5 ${textColor}`} />
          <div>
            <h3 className={`font-semibold ${textColor}`}>Pre-Visit Call Completed</h3>
            {preVisitData.call_date && (
              <p className="text-xs text-gray-600 mt-0.5">
                {new Date(preVisitData.call_date).toLocaleDateString()} at{' '}
                {new Date(preVisitData.call_date).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
        {preVisitData.requires_urgent_callback && (
          <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Urgent
          </div>
        )}
      </div>

      {/* AI Summary */}
      {preVisitData.ai_summary && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            {preVisitData.ai_summary}
          </p>
        </div>
      )}

      {/* Key Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {/* Medications */}
        {preVisitData.current_medications && preVisitData.current_medications.length > 0 && (
          <div className="bg-white bg-opacity-50 rounded p-2">
            <div className="flex items-center gap-1 text-gray-700 mb-1">
              <Pill className="w-3 h-3" />
              <span className="text-xs font-medium">Medications</span>
            </div>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {preVisitData.current_medications.slice(0, 3).map((med, idx) => (
                <li key={idx}>• {med}</li>
              ))}
              {preVisitData.current_medications.length > 3 && (
                <li className="text-gray-500">
                  +{preVisitData.current_medications.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Chief Concerns */}
        {preVisitData.chief_concerns && preVisitData.chief_concerns.length > 0 && (
          <div className="bg-white bg-opacity-50 rounded p-2">
            <div className="flex items-center gap-1 text-gray-700 mb-1">
              <MessageSquare className="w-3 h-3" />
              <span className="text-xs font-medium">Concerns</span>
            </div>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {preVisitData.chief_concerns.slice(0, 2).map((concern, idx) => (
                <li key={idx}>• {concern}</li>
              ))}
              {preVisitData.chief_concerns.length > 2 && (
                <li className="text-gray-500">
                  +{preVisitData.chief_concerns.length - 2} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Questions */}
        {preVisitData.questions_for_provider &&
         preVisitData.questions_for_provider.length > 0 && (
          <div className="bg-white bg-opacity-50 rounded p-2">
            <div className="flex items-center gap-1 text-gray-700 mb-1">
              <HelpCircle className="w-3 h-3" />
              <span className="text-xs font-medium">Questions</span>
            </div>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {preVisitData.questions_for_provider.slice(0, 2).map((question, idx) => (
                <li key={idx}>• {question}</li>
              ))}
              {preVisitData.questions_for_provider.length > 2 && (
                <li className="text-gray-500">
                  +{preVisitData.questions_for_provider.length - 2} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Risk Flags */}
      {preVisitData.risk_flags && preVisitData.risk_flags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
          <div className="flex items-center gap-1 text-red-700 mb-1">
            <Flag className="w-3 h-3" />
            <span className="text-xs font-semibold">Risk Flags</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {preVisitData.risk_flags.map((flag, idx) => (
              <span
                key={idx}
                className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lab Status */}
      {preVisitData.lab_status && (
        <div className="bg-white bg-opacity-50 rounded p-2 mb-3">
          <span className="text-xs font-medium text-gray-700">Lab Status: </span>
          <span className="text-xs text-gray-600">{preVisitData.lab_status}</span>
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={onViewDetails}
        className={`w-full text-sm font-medium py-2 rounded ${textColor} hover:bg-white hover:bg-opacity-50 transition-colors`}
      >
        View Full Details & Transcript
      </button>
    </div>
  );
}
