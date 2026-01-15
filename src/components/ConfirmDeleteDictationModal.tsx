import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteDictationModalProps {
  dictation: {
    id: string;
    patient_name: string;
    patient_mrn: string;
    visit_date: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: 'wrong_chart' | 'duplicate' | 'test' | 'other') => Promise<void>;
}

export default function ConfirmDeleteDictationModal({
  dictation,
  isOpen,
  onClose,
  onConfirm
}: ConfirmDeleteDictationModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState<'wrong_chart' | 'duplicate' | 'test' | 'other'>('wrong_chart');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    // Verify patient name matches exactly (case insensitive)
    if (confirmName.trim().toLowerCase() !== dictation.patient_name.toLowerCase()) {
      setError('Patient name does not match. Please type the name exactly as shown.');
      return;
    }

    setError('');
    setIsDeleting(true);

    try {
      await onConfirm(reason);
      // Reset state
      setConfirmName('');
      setReason('wrong_chart');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmName('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-red-600">
              Delete Dictation
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700 font-medium mb-2">
              You are about to delete a dictation from the following patient's record:
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <p><strong>Patient:</strong> {dictation.patient_name}</p>
              {dictation.patient_mrn && (
                <p><strong>MRN:</strong> {dictation.patient_mrn}</p>
              )}
              <p><strong>Visit Date:</strong> {new Date(dictation.visit_date).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for deletion:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              disabled={isDeleting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="wrong_chart">Created in wrong patient chart</option>
              <option value="duplicate">Duplicate dictation</option>
              <option value="test">Test dictation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type patient name to confirm:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => {
                setConfirmName(e.target.value);
                setError('');
              }}
              disabled={isDeleting}
              placeholder={dictation.patient_name}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This action marks the dictation as deleted and removes it from all views
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting || !confirmName.trim()}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isDeleting ? 'Deleting...' : 'Delete Dictation'}
          </button>
        </div>
      </div>
    </div>
  );
}
