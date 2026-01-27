/**
 * Staff Medication Refills Component
 * Displays medication refill queue grouped by patient
 * Allows staff to process refills and send to pharmacy
 * Created: 2026-01-26
 */

import { useState, useEffect } from 'react';
import {
  Pill,
  Check,
  Phone,
  FileText,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  RefreshCw,
  Trash2,
  MapPin
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  sig: string;
  need_refill: boolean;
  refill_requested_at: string;
  send_to_pharmacy: boolean;
  sent_to_pharmacy_at: string | null;
  refill_duration_days: number | null;
  refill_quantity: string | null;
  last_refill_date: string | null;
  next_refill_due_date: string | null;
  refill_count: number;
  sent_to_pharmacy_confirmation: string | null;
}

interface PatientGroup {
  patient: {
    id: string;
    tshla_id: string;
    name: string;
    phone: string;
    pharmacy: {
      name: string | null;
      phone: string | null;
      address: string | null;
      fax: string | null;
    };
  };
  medications: Medication[];
  totalPending: number;
  totalSent: number;
}

interface RefillFormData {
  refillDurationDays: number;
  refillQuantity: string;
  confirmationNumber: string;
  notes: string;
}

export default function StaffMedicationRefills() {
  const [queue, setQueue] = useState<PatientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [processingMed, setProcessingMed] = useState<string | null>(null);
  const [deletingMed, setDeletingMed] = useState<string | null>(null);
  const [refillForms, setRefillForms] = useState<Record<string, RefillFormData>>({});

  useEffect(() => {
    loadRefillQueue();
  }, []);

  const loadRefillQueue = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/patient-portal/medications/refill-queue`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load refill queue');
      }

      // Ensure queue is always an array
      setQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch (err: any) {
      console.error('Error loading refill queue:', err);
      setError(err.message || 'Failed to load refill queue');
      setQueue([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const initializeRefillForm = (medId: string) => {
    if (!refillForms[medId]) {
      setRefillForms(prev => ({
        ...prev,
        [medId]: {
          refillDurationDays: 30,
          refillQuantity: '30 day supply',
          confirmationNumber: '',
          notes: ''
        }
      }));
    }
  };

  const updateRefillForm = (medId: string, field: keyof RefillFormData, value: string | number) => {
    setRefillForms(prev => ({
      ...prev,
      [medId]: {
        ...(prev[medId] || {
          refillDurationDays: 30,
          refillQuantity: '30 day supply',
          confirmationNumber: '',
          notes: ''
        }),
        [field]: value
      }
    }));
  };

  const processRefill = async (patientGroup: PatientGroup, medication: Medication) => {
    try {
      setProcessingMed(medication.id);

      const formData = refillForms[medication.id] || {
        refillDurationDays: 30,
        refillQuantity: '30 day supply',
        confirmationNumber: '',
        notes: ''
      };

      // Get staff info from auth context (you may need to adjust this based on your auth setup)
      const staffId = localStorage.getItem('staff_id') || 'staff-unknown';
      const staffName = localStorage.getItem('staff_name') || 'Staff';

      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/medications/${medication.id}/process-refill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId,
            staffName,
            pharmacyName: patientGroup.patient.pharmacy.name || 'Pharmacy not specified',
            refillDurationDays: formData.refillDurationDays,
            refillQuantity: formData.refillQuantity,
            confirmationNumber: formData.confirmationNumber,
            notes: formData.notes
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process refill');
      }

      // Reload queue
      await loadRefillQueue();

      // Clear form
      setRefillForms(prev => {
        const newForms = { ...prev };
        delete newForms[medication.id];
        return newForms;
      });

    } catch (err: any) {
      console.error('Error processing refill:', err);
      alert(`Error: ${err.message || 'Failed to process refill'}`);
    } finally {
      setProcessingMed(null);
    }
  };

  const deleteMedication = async (medication: Medication) => {
    if (!confirm(`Are you sure you want to remove ${medication.medication_name} from the refill queue?`)) {
      return;
    }

    try {
      setDeletingMed(medication.id);

      // Clear the send_to_pharmacy flag
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/medications/${medication.id}/clear-refill-flag`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove medication from queue');
      }

      // Reload queue
      await loadRefillQueue();

    } catch (err: any) {
      console.error('Error deleting medication:', err);
      alert(`Error: ${err.message || 'Failed to remove medication from queue'}`);
    } finally {
      setDeletingMed(null);
    }
  };

  const togglePatient = (patientId: string) => {
    setExpandedPatient(prev => prev === patientId ? null : patientId);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading medication refill queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-start gap-3 text-red-600 mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error Loading Refill Queue</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadRefillQueue}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 font-medium mb-2">No Pending Refills</p>
        <p className="text-sm text-gray-500">All medication refill requests have been processed</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-orange-600" />
              Medication Refills Queue
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {queue.reduce((sum, g) => sum + g.totalPending, 0)} pending refills from {queue.length} patients
            </p>
          </div>
          <button
            onClick={loadRefillQueue}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Patient List */}
      <div className="divide-y divide-gray-200">
        {queue.map((group) => (
          <div key={group.patient.id} className="p-6">
            {/* Patient Header */}
            <button
              onClick={() => togglePatient(group.patient.id)}
              className="w-full flex items-center justify-between hover:bg-gray-50 -m-2 p-2 rounded-lg transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900">{group.patient.name}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {group.patient.tshla_id}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {group.patient.phone}
                    </span>
                    {group.patient.pharmacy.name && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <MapPin className="w-3 h-3" />
                        {group.patient.pharmacy.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {group.totalPending} pending
                  </div>
                  {group.totalSent > 0 && (
                    <div className="text-xs text-gray-500">
                      {group.totalSent} sent
                    </div>
                  )}
                </div>
                <div className={`transform transition-transform ${expandedPatient === group.patient.id ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Expanded Patient Details */}
            {expandedPatient === group.patient.id && (
              <div className="mt-4 ml-14 space-y-4">
                {/* Medications */}
                <div className="space-y-3">
                  {group.medications.map((med) => {
                    const isProcessing = processingMed === med.id;
                    const isSent = med.sent_to_pharmacy_at != null;
                    const formData = refillForms[med.id];

                    return (
                      <div
                        key={med.id}
                        className={`border rounded-lg p-4 ${
                          isSent ? 'bg-green-50 border-green-200' : 'bg-white border-gray-300'
                        }`}
                      >
                        {/* Medication Info */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h6 className="font-semibold text-gray-900">{med.medication_name}</h6>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 mt-1">
                              {med.dosage && <span>{med.dosage}</span>}
                              {med.frequency && <span>{med.frequency}</span>}
                              {med.route && (
                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{med.route}</span>
                              )}
                            </div>
                            {med.sig && (
                              <p className="text-xs text-gray-500 mt-1 italic">{med.sig}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isSent && (
                              <div className="flex items-center gap-2 text-green-700 bg-green-100 px-3 py-1 rounded-full text-sm">
                                <Check className="w-4 h-4" />
                                Sent
                              </div>
                            )}
                            <button
                              onClick={() => deleteMedication(med)}
                              disabled={deletingMed === med.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove from refill queue"
                            >
                              {deletingMed === med.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Refill Info */}
                        {med.refill_requested_at && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                            <Calendar className="w-3 h-3" />
                            Requested: {new Date(med.refill_requested_at).toLocaleDateString()}
                          </div>
                        )}

                        {/* Sent Info (if already processed) */}
                        {isSent && (
                          <div className="bg-white border border-green-200 rounded p-3 text-sm space-y-1">
                            <p className="text-gray-700">
                              <span className="font-medium">Sent:</span>{' '}
                              {new Date(med.sent_to_pharmacy_at!).toLocaleString()}
                            </p>
                            {med.refill_duration_days && (
                              <p className="text-gray-700">
                                <span className="font-medium">Duration:</span> {med.refill_duration_days} days
                              </p>
                            )}
                            {med.refill_quantity && (
                              <p className="text-gray-700">
                                <span className="font-medium">Quantity:</span> {med.refill_quantity}
                              </p>
                            )}
                            {med.sent_to_pharmacy_confirmation && (
                              <p className="text-gray-700">
                                <span className="font-medium">Confirmation:</span> {med.sent_to_pharmacy_confirmation}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              Total refills: {med.refill_count}
                            </p>
                          </div>
                        )}

                        {/* Process Refill Form (if not yet sent) */}
                        {!isSent && (
                          <div className="space-y-3 border-t border-gray-200 pt-3">
                            <div className="grid grid-cols-2 gap-3">
                              {/* Refill Duration */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Refill Duration
                                </label>
                                <select
                                  value={formData?.refillDurationDays || 30}
                                  onChange={(e) => {
                                    const days = parseInt(e.target.value);
                                    updateRefillForm(med.id, 'refillDurationDays', days);
                                    updateRefillForm(med.id, 'refillQuantity', `${days} day supply`);
                                  }}
                                  onFocus={() => initializeRefillForm(med.id)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value={30}>30 days</option>
                                  <option value={60}>60 days</option>
                                  <option value={90}>90 days</option>
                                </select>
                              </div>

                              {/* Refill Quantity */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Quantity
                                </label>
                                <input
                                  type="text"
                                  value={formData?.refillQuantity || '30 day supply'}
                                  onChange={(e) => updateRefillForm(med.id, 'refillQuantity', e.target.value)}
                                  onFocus={() => initializeRefillForm(med.id)}
                                  placeholder="e.g., 30 tablets"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Confirmation Number */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Confirmation Number (Optional)
                              </label>
                              <input
                                type="text"
                                value={formData?.confirmationNumber || ''}
                                onChange={(e) => updateRefillForm(med.id, 'confirmationNumber', e.target.value)}
                                onFocus={() => initializeRefillForm(med.id)}
                                placeholder="Pharmacy confirmation #"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            {/* Notes */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Notes (Optional)
                              </label>
                              <textarea
                                value={formData?.notes || ''}
                                onChange={(e) => updateRefillForm(med.id, 'notes', e.target.value)}
                                onFocus={() => initializeRefillForm(med.id)}
                                placeholder="Any additional notes about this refill..."
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            {/* Submit Button */}
                            <button
                              onClick={() => processRefill(group, med)}
                              disabled={isProcessing}
                              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  Mark as Sent to Pharmacy
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
