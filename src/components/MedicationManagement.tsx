/**
 * Medication Management Component
 * Displays medications with active/prior sections and management controls
 * Created: 2026-01-25
 */

import { useState, useEffect } from 'react';
import { Heart, X, Check, RefreshCw, Package, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface Medication {
  id?: string;
  medication_name?: string;
  name?: string; // From H&P data
  dosage: string;
  frequency: string;
  route?: string;
  sig?: string;
  indication?: string;
  status: string;
  need_refill?: boolean;
  send_to_pharmacy?: boolean;
}

interface MedicationManagementProps {
  tshlaId: string;
  sessionId: string;
  initialMedications?: Medication[]; // From H&P data
  onMedicationsChange?: (medications: Medication[]) => void; // Callback to notify parent
}

export default function MedicationManagement({
  tshlaId,
  sessionId,
  initialMedications = [],
  onMedicationsChange
}: MedicationManagementProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Load medications from patient_medications table
  useEffect(() => {
    loadMedications();
  }, [tshlaId]);

  const loadMedications = async () => {
    try {
      console.log('📥 Loading medications...', { tshlaId });
      setIsLoading(true);

      const url = `${API_BASE_URL}/api/patient-portal/medications/${encodeURIComponent(tshlaId)}`;
      console.log('📡 Load URL:', url);

      const response = await fetch(url, {
        headers: {
          'x-session-id': sessionId,
        },
      });

      console.log('📥 Load response status:', response.status);
      const data = await response.json();
      console.log('📦 Load response data:', data);

      if (response.ok && data.success) {
        console.log('✅ Setting medications:', data.medications.length, 'medications');
        if (data.medications.length > 0) {
          console.log('📋 Sample medication:', data.medications[0]);
          console.log('🆔 First med has ID?', !!data.medications[0]?.id);
        }
        setMedications(data.medications);
      } else {
        console.log('⚠️ No medications in table, using initial medications');
        // If no medications in table, show initial medications
        const formatted = initialMedications.map(med => ({
          medication_name: med.name || med.medication_name,
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          route: med.route || '',
          sig: med.sig || med.indication || '',
          status: 'active',
          need_refill: false,
          send_to_pharmacy: false
        }));
        setMedications(formatted);
      }
    } catch (err) {
      console.error('❌ Load medications error:', err);
      setError('Failed to load medications');
    } finally {
      setIsLoading(false);
    }
  };

  const importMedications = async () => {
    try {
      console.log('🔄 Starting medication import...', { tshlaId, sessionId });
      setImporting(true);

      const url = `${API_BASE_URL}/api/patient-portal/medications/${encodeURIComponent(tshlaId)}/import-from-uploads`;
      console.log('📡 Import URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
      });

      console.log('📥 Import response status:', response.status);
      const data = await response.json();
      console.log('📦 Import response data:', data);

      if (response.ok && data.success) {
        console.log('✅ Import successful, reloading medications...');
        await loadMedications(); // Reload
      } else {
        console.error('❌ Import failed:', data.error || 'Unknown error');
        setError(data.error || 'Failed to import medications');
      }
    } catch (err) {
      console.error('❌ Import medications error:', err);
      setError('Failed to import medications');
    } finally {
      setImporting(false);
    }
  };

  const updateMedicationStatus = async (medicationId: string, newStatus: string) => {
    try {
      // Optimistically update local state immediately
      setMedications(prev =>
        prev.map(m => m.id === medicationId ? { ...m, status: newStatus } : m)
      );

      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/medications/${encodeURIComponent(tshlaId)}/update-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
          body: JSON.stringify({
            medicationId,
            newStatus,
          }),
        }
      );

      if (response.ok) {
        // Reload to get server-confirmed state
        await loadMedications();
      } else {
        // If failed, reload to revert optimistic update
        await loadMedications();
      }
    } catch (err) {
      console.error('Update medication status error:', err);
      // Reload to revert optimistic update
      await loadMedications();
    }
  };

  const updateMedicationFlags = async (
    medicationId: string,
    needRefill?: boolean,
    sendToPharmacy?: boolean
  ) => {
    try {
      // Optimistically update local state immediately
      setMedications(prev =>
        prev.map(m => {
          if (m.id === medicationId) {
            const updated = { ...m };
            if (needRefill !== undefined) updated.need_refill = needRefill;
            if (sendToPharmacy !== undefined) updated.send_to_pharmacy = sendToPharmacy;
            return updated;
          }
          return m;
        })
      );

      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/medications/${encodeURIComponent(tshlaId)}/update-flags`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
          body: JSON.stringify({
            medicationId,
            needRefill,
            sendToPharmacy,
          }),
        }
      );

      if (response.ok) {
        // Reload to get server-confirmed state
        await loadMedications();
      } else {
        // If failed, reload to revert optimistic update
        await loadMedications();
      }
    } catch (err) {
      console.error('Update medication flags error:', err);
      // Reload to revert optimistic update
      await loadMedications();
    }
  };

  const activeMedications = medications.filter(m => m.status === 'active');
  const priorMedications = medications.filter(m => m.status === 'prior' || m.status === 'discontinued');
  const pharmacyMedications = medications.filter(m => m.status === 'active' && m.send_to_pharmacy === true);

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading medications...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-h-[600px] overflow-y-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {medications.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No medications recorded</p>
          {initialMedications.length > 0 && (
            <button
              onClick={importMedications}
              disabled={importing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import from Uploads'}
            </button>
          )}
        </div>
      )}

      {/* Active Medications Section */}
      {activeMedications.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-green-600" />
            <h4 className="font-bold text-gray-900">Active Medications</h4>
            <span className="text-xs text-gray-600 bg-green-50 px-2 py-1 rounded-full">
              {activeMedications.length}
            </span>
          </div>

          <div className="space-y-3">
            {activeMedications.map((med, idx) => (
              <div
                key={med.id || idx}
                className="border border-gray-200 rounded-xl p-4 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900 mb-1">
                      {med.medication_name || med.name}
                    </h5>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 mb-2">
                      {med.dosage && <span>{med.dosage}</span>}
                      {med.frequency && <span>{med.frequency}</span>}
                      {med.route && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{med.route}</span>}
                    </div>
                    {(med.sig || med.indication) && (
                      <p className="text-xs text-gray-500 italic">{med.sig || med.indication}</p>
                    )}
                  </div>

                  {med.id && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateMedicationStatus(med.id!, 'prior')}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                        title="Move to Prior Meds"
                      >
                        <X className="w-3 h-3" />
                        Discontinue
                      </button>
                    </div>
                  )}
                </div>

                {/* Checkboxes for patient and staff */}
                {med.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={med.need_refill || false}
                        onChange={(e) => updateMedicationFlags(med.id!, e.target.checked, undefined)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-gray-700">📝 Need Refill</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={med.send_to_pharmacy || false}
                        onChange={(e) => updateMedicationFlags(med.id!, undefined, e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">💊 Send to Pharmacy</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prior Medications Section */}
      {priorMedications.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-gray-500" />
            <h4 className="font-bold text-gray-700">Prior Medications</h4>
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              {priorMedications.length}
            </span>
          </div>

          <div className="space-y-3">
            {priorMedications.map((med, idx) => (
              <div
                key={med.id || idx}
                className="border border-gray-300 rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 opacity-75">
                    <h5 className="font-semibold text-gray-700 mb-1">
                      {med.medication_name || med.name}
                    </h5>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 mb-2">
                      {med.dosage && <span>{med.dosage}</span>}
                      {med.frequency && <span>{med.frequency}</span>}
                      {med.route && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{med.route}</span>}
                    </div>
                    {(med.sig || med.indication) && (
                      <p className="text-xs text-gray-500 italic">{med.sig || med.indication}</p>
                    )}
                  </div>

                  {med.id && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateMedicationStatus(med.id!, 'active')}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                        title="Move back to Active Meds"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Activate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send to Pharmacy Section */}
      {pharmacyMedications.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-blue-900">💊 Send to Pharmacy</h4>
            <span className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
              {pharmacyMedications.length}
            </span>
          </div>

          <div className="space-y-3">
            {pharmacyMedications.map((med, idx) => (
              <div
                key={med.id || idx}
                className="border border-blue-200 rounded-xl p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h5 className="font-semibold text-blue-900 mb-1">
                      {med.medication_name || med.name}
                    </h5>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-blue-700 mb-2">
                      {med.dosage && <span>{med.dosage}</span>}
                      {med.frequency && <span>{med.frequency}</span>}
                      {med.route && <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">{med.route}</span>}
                    </div>
                    {(med.sig || med.indication) && (
                      <p className="text-xs text-blue-600 italic">{med.sig || med.indication}</p>
                    )}
                    {med.need_refill && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-700">
                        <Check className="w-3 h-3" />
                        <span>📝 Refill Requested</span>
                      </div>
                    )}
                  </div>

                  {med.id && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateMedicationFlags(med.id!, undefined, false)}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                        title="Remove from pharmacy queue"
                      >
                        <X className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
            <p className="text-xs text-blue-800">
              ℹ️ These medications have been marked to send to the pharmacy. Staff will process these requests.
            </p>
          </div>
        </div>
      )}

      {/* Import button if medications exist in uploads but not in table */}
      {medications.length === 0 && initialMedications.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 mb-3">
            We found {initialMedications.length} medications in your uploaded documents.
          </p>
          <button
            onClick={importMedications}
            disabled={importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Medications'}
          </button>
        </div>
      )}
    </div>
  );
}
