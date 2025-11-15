/**
 * PreVisitModal Component
 * Full-screen modal showing complete pre-visit call details and transcript
 * Created: January 2025
 */

import { X, Copy, CheckCircle, Download, Pill, MessageSquare, HelpCircle, Flag, AlertTriangle, FileText } from 'lucide-react';
import { useState } from 'react';
import type { PreVisitData } from './PreVisitSummaryCard';

interface PreVisitModalProps {
  preVisitData: PreVisitData;
  patientName: string;
  appointmentDate: string;
  onClose: () => void;
  onCopyToClipboard?: (text: string) => void;
  onInsertIntoDictation?: (text: string) => void;
}

export default function PreVisitModal({
  preVisitData,
  patientName,
  appointmentDate,
  onClose,
  onCopyToClipboard,
  onInsertIntoDictation,
}: PreVisitModalProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);

    if (onCopyToClipboard) {
      onCopyToClipboard(text);
    }
  };

  const handleInsertDictation = () => {
    const dictationText = generateDictationText();
    if (onInsertIntoDictation) {
      onInsertIntoDictation(dictationText);
    }
  };

  const generateDictationText = (): string => {
    let text = `PRE-VISIT INTERVIEW SUMMARY\n\n`;

    if (preVisitData.ai_summary) {
      text += `${preVisitData.ai_summary}\n\n`;
    }

    if (preVisitData.current_medications && preVisitData.current_medications.length > 0) {
      text += `CURRENT MEDICATIONS:\n`;
      preVisitData.current_medications.forEach(med => {
        text += `- ${med}\n`;
      });
      text += `\n`;
    }

    if (preVisitData.chief_concerns && preVisitData.chief_concerns.length > 0) {
      text += `CHIEF CONCERNS:\n`;
      preVisitData.chief_concerns.forEach(concern => {
        text += `- ${concern}\n`;
      });
      text += `\n`;
    }

    if (preVisitData.questions_for_provider && preVisitData.questions_for_provider.length > 0) {
      text += `PATIENT QUESTIONS:\n`;
      preVisitData.questions_for_provider.forEach(question => {
        text += `- ${question}\n`;
      });
      text += `\n`;
    }

    if (preVisitData.lab_status) {
      text += `LAB STATUS: ${preVisitData.lab_status}\n\n`;
    }

    if (preVisitData.risk_flags && preVisitData.risk_flags.length > 0) {
      text += `⚠️ RISK FLAGS: ${preVisitData.risk_flags.join(', ')}\n\n`;
    }

    return text;
  };

  const urgencyColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  const urgencyLevel = preVisitData.urgency_level || 'low';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pre-Visit Interview</h2>
              <p className="text-sm text-gray-600 mt-1">
                {patientName} • {new Date(appointmentDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Urgency Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${urgencyColors[urgencyLevel]}`}>
                {urgencyLevel.toUpperCase()} PRIORITY
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleInsertDictation}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                Insert into Dictation
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Urgent Callback Alert */}
            {preVisitData.requires_urgent_callback && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-1">
                      Urgent Callback Required
                    </h3>
                    <p className="text-sm text-red-700">
                      This patient requires immediate attention before their appointment.
                      Review risk flags and concerns carefully.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Summary */}
            {preVisitData.ai_summary && (
              <div className="bg-blue-50 rounded-lg p-5 mb-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    AI Summary
                  </h3>
                  <button
                    onClick={() => handleCopy(preVisitData.ai_summary!, 'summary')}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {copiedSection === 'summary' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {preVisitData.ai_summary}
                </p>
              </div>
            )}

            {/* Grid of Information Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Current Medications */}
              {preVisitData.current_medications && preVisitData.current_medications.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-purple-600" />
                      Current Medications
                    </h3>
                    <button
                      onClick={() => handleCopy(preVisitData.current_medications!.join('\n'), 'medications')}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
                    >
                      {copiedSection === 'medications' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {preVisitData.current_medications.map((med, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-purple-600 mt-1">•</span>
                        <span>{med}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chief Concerns */}
              {preVisitData.chief_concerns && preVisitData.chief_concerns.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      Chief Concerns
                    </h3>
                    <button
                      onClick={() => handleCopy(preVisitData.chief_concerns!.join('\n'), 'concerns')}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
                    >
                      {copiedSection === 'concerns' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {preVisitData.chief_concerns.map((concern, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Patient Questions */}
              {preVisitData.questions_for_provider &&
               preVisitData.questions_for_provider.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-green-600" />
                      Questions for Provider
                    </h3>
                    <button
                      onClick={() => handleCopy(preVisitData.questions_for_provider!.join('\n'), 'questions')}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
                    >
                      {copiedSection === 'questions' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {preVisitData.questions_for_provider.map((question, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-600 mt-1">•</span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lab Status */}
              {preVisitData.lab_status && (
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Lab Status</h3>
                  <p className="text-gray-700">{preVisitData.lab_status}</p>
                </div>
              )}
            </div>

            {/* Risk Flags */}
            {preVisitData.risk_flags && preVisitData.risk_flags.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-5 mb-6">
                <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <Flag className="w-5 h-5" />
                  Risk Flags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {preVisitData.risk_flags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full Transcript */}
            {preVisitData.full_transcript && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Full Transcript</h3>
                  <button
                    onClick={() => handleCopy(preVisitData.full_transcript!, 'transcript')}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    {copiedSection === 'transcript' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-white rounded border border-gray-200 p-4 max-h-96 overflow-y-auto">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
                    {preVisitData.full_transcript}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Call completed on{' '}
              {preVisitData.call_date
                ? new Date(preVisitData.call_date).toLocaleString()
                : 'Unknown date'}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
