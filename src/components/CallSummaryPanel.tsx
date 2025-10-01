import React from 'react';
import {
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Heart,
  Brain,
  FileText,
  Download,
  Phone,
} from 'lucide-react';
import type { CallSummary } from '../types/callSummary';

interface CallSummaryPanelProps {
  summary?: CallSummary;
  isLive?: boolean;
  className?: string;
}

export const CallSummaryPanel: React.FC<CallSummaryPanelProps> = ({
  summary,
  isLive = false,
  className = '',
}) => {
  if (!summary) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <Brain className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">
            {isLive ? 'AI Analysis In Progress...' : 'No Call Summary Available'}
          </h3>
          <p className="text-sm text-gray-400">
            {isLive
              ? 'Analyzing conversation and extracting insights'
              : 'Start a call to see AI-generated insights'}
          </p>
        </div>
      </div>
    );
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return 'text-red-600 bg-red-100';
      case 'urgent':
        return 'text-orange-600 bg-orange-100';
      case 'routine':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'emergency':
        return 'text-red-600';
      case 'concerned':
        return 'text-orange-600';
      case 'neutral':
        return 'text-blue-600';
      case 'positive':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'emergency':
        return <AlertTriangle className="w-4 h-4" />;
      case 'concerned':
        return <AlertTriangle className="w-4 h-4" />;
      case 'neutral':
        return <Clock className="w-4 h-4" />;
      case 'positive':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Heart className="w-4 h-4" />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Call Analysis</h3>
            {isLive && (
              <div className="flex items-center space-x-1">
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600 font-medium">Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(summary.sentiment)}`}
            >
              {getSentimentIcon(summary.sentiment)}
              <span className="ml-1">{summary.sentiment}</span>
            </span>
            <span className="text-xs text-gray-500">
              {Math.round(summary.extractionConfidence * 100)}% confidence
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Patient Information */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <User className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Patient Information</h4>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium">
                  {summary.patientInfo.name || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">DOB:</span>
                <span className="ml-2 font-medium">
                  {summary.patientInfo.dateOfBirth || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Phone:</span>
                <span className="ml-2 font-medium">
                  {summary.patientInfo.phoneNumber || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    summary.patientInfo.isExistingPatient
                      ? 'text-blue-600 bg-blue-100'
                      : 'text-green-600 bg-green-100'
                  }`}
                >
                  {summary.patientInfo.isExistingPatient ? 'Existing' : 'New'} Patient
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Call Details */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Phone className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Call Details</h4>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <div>
              <span className="text-gray-600 text-sm">Reason for Call:</span>
              <p className="mt-1 text-gray-900">{summary.callDetails.reason || 'Not specified'}</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-600 text-sm">Urgency Level:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(summary.callDetails.urgency)}`}
                >
                  {summary.callDetails.urgency}
                </span>
              </div>

              {summary.callDetails.appointmentRequested && (
                <div className="flex items-center space-x-1 text-green-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Appointment Requested</span>
                </div>
              )}
            </div>

            {summary.callDetails.preferredProvider && (
              <div>
                <span className="text-gray-600 text-sm">Preferred Provider:</span>
                <span className="ml-2 font-medium">{summary.callDetails.preferredProvider}</span>
              </div>
            )}

            {summary.callDetails.symptoms && summary.callDetails.symptoms.length > 0 && (
              <div>
                <span className="text-gray-600 text-sm">Symptoms Mentioned:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {summary.callDetails.symptoms.map((symptom, idx) => (
                    <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Items */}
        {summary.actionItems.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="w-5 h-5 text-gray-600" />
              <h4 className="font-medium text-gray-900">Action Items</h4>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <ul className="space-y-2">
                {summary.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-900">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* AI Notes */}
        {summary.aiNotes && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <h4 className="font-medium text-gray-900">AI Notes</h4>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-900">{summary.aiNotes}</p>
            </div>
          </div>
        )}

        {/* Export Options */}
        <div className="pt-4 border-t border-gray-200">
          <button className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800">
            <Download className="w-4 h-4" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallSummaryPanel;
