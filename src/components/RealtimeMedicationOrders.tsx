/**
 * Real-Time Medication Orders Component
 * Displays medications in full Rx prescription format as they are dictated
 */

import { useState } from 'react';
import { Pill, Copy, Check, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react';
import type { RealtimeMedication } from '../services/realtimeOrderExtraction.service';

interface RealtimeMedicationOrdersProps {
  medications: RealtimeMedication[];
  patientName?: string;
  onDeleteMedication?: (medicationId: string) => void;
}

export default function RealtimeMedicationOrders({ medications, patientName, onDeleteMedication }: RealtimeMedicationOrdersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter out cancelled medications
  const activeMedications = medications.filter(med => med.status !== 'cancelled');
  const cancelledMedications = medications.filter(med => med.status === 'cancelled');

  // Group medications by pharmacy
  const groupedMedications = activeMedications.reduce((groups, med) => {
    const pharmacy = med.pharmacy || 'No Pharmacy Specified';
    if (!groups[pharmacy]) {
      groups[pharmacy] = [];
    }
    groups[pharmacy].push(med);
    return groups;
  }, {} as Record<string, RealtimeMedication[]>);

  // Sort pharmacy groups alphabetically
  const sortedPharmacyGroups = Object.entries(groupedMedications).sort(([pharmacyA], [pharmacyB]) => {
    // Put "No Pharmacy Specified" at the end
    if (pharmacyA === 'No Pharmacy Specified') return 1;
    if (pharmacyB === 'No Pharmacy Specified') return -1;
    return pharmacyA.localeCompare(pharmacyB);
  });

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatRxText = (med: RealtimeMedication): string => {
    return `${med.drugName} ${med.dosage} • ${med.frequency} ${med.route}${med.duration ? ` for ${med.duration}` : ''}${med.quantity ? ` • Qty: #${med.quantity}` : ''} • RF: ${med.refills || '0'}
${med.pharmacy ? `Send to: ${med.pharmacy}` : ''}`;
  };

  const copyAllMedications = () => {
    const allMedsText = activeMedications.map((med, idx) =>
      `${idx + 1}. ${formatRxText(med)}`
    ).join('\n\n');

    const fullText = `=== MEDICATION ORDERS FOR ${patientName?.toUpperCase() || 'PATIENT'} ===\n\n${allMedsText}`;
    copyToClipboard(fullText, 'all');
  };

  const getStatusBadge = (status: 'new' | 'modified' | 'cancelled') => {
    const styles = {
      new: 'bg-green-100 text-green-800 border-green-300',
      modified: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };

    const labels = {
      new: '🆕 NEW',
      modified: '✏️ MODIFIED',
      cancelled: '❌ CANCELLED',
    };

    return (
      <span className={`px-2 py-1 text-xs font-bold rounded border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (medications.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border-2 border-blue-300">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-300">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <Pill className="w-6 h-6 text-blue-600" />
              Real-Time Medication Orders
            </h2>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <Pill className="w-16 h-16 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm italic">
              No medications detected yet. Start dictating medication orders...
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Examples: "Start Metformin 500mg PO twice daily" or "Prescribe Lisinopril 10mg daily"
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-blue-300">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Pill className="w-6 h-6 text-blue-600" />
            Real-Time Medication Orders
            <span className="ml-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-full font-bold">
              {activeMedications.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {activeMedications.length > 0 && (
              <button
                onClick={copyAllMedications}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                {copiedId === 'all' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-blue-200 rounded-lg transition"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-blue-700" />
              ) : (
                <ChevronDown className="w-5 h-5 text-blue-700" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {/* Active Medications - Grouped by Pharmacy */}
          {sortedPharmacyGroups.map(([pharmacy, groupMeds]) => (
            <div key={pharmacy} className="border-2 border-blue-200 rounded-lg overflow-hidden bg-white shadow-sm">
              {/* Pharmacy Header */}
              <div className="bg-gradient-to-r from-blue-100 to-blue-50 px-4 py-3 border-b-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💊</span>
                    <span className="font-bold text-blue-900">{pharmacy}</span>
                  </div>
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    {groupMeds.length} {groupMeds.length === 1 ? 'Rx' : 'Rxs'}
                  </span>
                </div>
              </div>

              {/* Medications in this pharmacy group */}
              <div className="p-3 space-y-2">
                {groupMeds.map((med, medIndex) => (
                  <div
                    key={med.id}
                    className={`p-3 rounded border-2 transition-all ${
                      med.status === 'new'
                        ? 'bg-green-50 border-green-300'
                        : 'bg-yellow-50 border-yellow-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-600">
                          {medIndex + 1}.
                        </span>
                        {getStatusBadge(med.status)}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(formatRxText(med), med.id)}
                          className="p-2 hover:bg-white rounded transition"
                          title="Copy prescription"
                        >
                          {copiedId === med.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        {onDeleteMedication && (
                          <button
                            onClick={() => onDeleteMedication(med.id)}
                            className="p-2 hover:bg-red-100 rounded transition"
                            title="Delete this medication"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Prescription Format - Compact */}
                    <div className="space-y-1 text-sm">
                      {/* Line 1: Rx info all on one line */}
                      <div className="font-mono text-gray-900">
                        <span className="font-bold">{med.drugName} {med.dosage}</span>
                        <span className="text-gray-700"> • {med.frequency} {med.route}</span>
                        {med.quantity && <span className="text-gray-700"> • Qty: #{med.quantity}</span>}
                        <span className="text-gray-700"> • RF: {med.refills || '0'}</span>
                      </div>

                      {/* Duration/Indication if present */}
                      {(med.duration || med.indication) && (
                        <div className="text-xs text-gray-600">
                          {med.duration && <span>Duration: {med.duration}</span>}
                          {med.duration && med.indication && <span> • </span>}
                          {med.indication && <span>For: {med.indication}</span>}
                        </div>
                      )}
                    </div>

                    {/* Confidence indicator */}
                    {med.confidence < 0.7 && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-xs text-orange-600 font-semibold">
                          ⚠️ Low confidence - Please verify details
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Cancelled Medications */}
          {cancelledMedications.length > 0 && (
            <div className="mt-4 pt-4 border-t-2 border-gray-300">
              <h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                <X className="w-4 h-4" />
                Cancelled ({cancelledMedications.length})
              </h3>
              {cancelledMedications.map((med) => (
                <div
                  key={med.id}
                  className="p-3 rounded-lg bg-red-50 border border-red-200 mb-2 opacity-60"
                >
                  <div className="flex items-center gap-2">
                    {getStatusBadge(med.status)}
                    <span className="text-sm text-gray-700 line-through">
                      {med.drugName} {med.dosage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-bold">💡 Staff Instructions:</span> Send these prescriptions to the pharmacy.
              Copy all medications using the button above to paste into your pharmacy system.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
