import { AlertCircle, User, FileText, X } from 'lucide-react';

interface RecordingConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  patientName?: string;
  patientMrn?: string;
  templateName?: string;
  recordingMode: 'dictation' | 'conversation' | null;
}

export default function RecordingConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  patientName,
  patientMrn,
  templateName,
  recordingMode
}: RecordingConfirmationModalProps) {
  if (!isOpen) return null;

  const hasPatient = patientName && patientName !== 'No Patient';
  const templateDisplay = templateName || 'No Template Selected';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              Confirm Recording Details
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700 font-medium">
            You are about to start {recordingMode === 'conversation' ? 'a conversation recording' : 'dictation'} with the following details:
          </p>

          {/* Patient Info */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-700 mb-1">Patient:</div>
                {hasPatient ? (
                  <>
                    <div className="font-bold text-gray-900">{patientName}</div>
                    {patientMrn && (
                      <div className="text-sm text-gray-600 mt-1">
                        MRN: <span className="font-mono font-semibold">{patientMrn}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="font-bold text-orange-600 flex items-center gap-2">
                    ⚠️ No Patient Selected
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Template Info */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-700 mb-1">Template:</div>
                <div className="font-bold text-gray-900">{templateDisplay}</div>
              </div>
            </div>
          </div>

          {/* Warning if no patient */}
          {!hasPatient && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This dictation will be saved without patient information.
                You can add patient details later.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
