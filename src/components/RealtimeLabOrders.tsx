/**
 * Real-Time Lab Orders Component
 * Displays lab test orders with dates as they are dictated
 */

import { useState } from 'react';
import { TestTube, Copy, Check, ChevronDown, ChevronUp, Calendar, Trash2 } from 'lucide-react';
import type { RealtimeLabOrder } from '../services/realtimeOrderExtraction.service';

interface RealtimeLabOrdersProps {
  labs: RealtimeLabOrder[];
  patientName?: string;
  onDeleteLab?: (labId: string) => void;
}

export default function RealtimeLabOrders({ labs, patientName, onDeleteLab }: RealtimeLabOrdersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter active labs
  const activeLabs = labs.filter(lab => lab.status !== 'cancelled');

  // Group labs by date AND location
  const groupedLabs = activeLabs.reduce((groups, lab) => {
    const key = `${lab.orderDate}|${lab.location || 'No Location'}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(lab);
    return groups;
  }, {} as Record<string, RealtimeLabOrder[]>);

  // Sort groups by urgency (STAT first, then Urgent, then Routine)
  const sortedGroups = Object.entries(groupedLabs).sort(([keyA, labsA], [keyB, labsB]) => {
    const urgencyOrder = { 'stat': 0, 'urgent': 1, 'routine': 2 };
    const maxUrgencyA = Math.min(...labsA.map(l => urgencyOrder[l.urgency]));
    const maxUrgencyB = Math.min(...labsB.map(l => urgencyOrder[l.urgency]));
    return maxUrgencyA - maxUrgencyB;
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

  const formatLabText = (lab: RealtimeLabOrder): string => {
    let text = `${lab.testName} - ${lab.orderDate}`;
    if (lab.location) text += ` @ ${lab.location}`;
    if (lab.fasting) text += ' (FASTING)';
    if (lab.urgency !== 'routine') text += ` [${lab.urgency.toUpperCase()}]`;
    if (lab.notes) text += `\nNotes: ${lab.notes}`;
    return text;
  };

  const copyAllLabs = () => {
    const allLabsText = activeLabs.map((lab, idx) =>
      `${idx + 1}. ${formatLabText(lab)}`
    ).join('\n');

    const fullText = `=== LAB ORDERS FOR ${patientName?.toUpperCase() || 'PATIENT'} ===\n\n${allLabsText}`;
    copyToClipboard(fullText, 'all');
  };

  const getUrgencyBadge = (urgency: 'routine' | 'urgent' | 'stat') => {
    const styles = {
      stat: 'bg-red-600 text-white animate-pulse',
      urgent: 'bg-orange-500 text-white',
      routine: 'bg-blue-100 text-blue-800 border border-blue-300',
    };

    const labels = {
      stat: '🚨 STAT',
      urgent: '⚡ URGENT',
      routine: '📋 ROUTINE',
    };

    return (
      <span className={`px-2 py-1 text-xs font-bold rounded ${styles[urgency]}`}>
        {labels[urgency]}
      </span>
    );
  };


  if (labs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border-2 border-teal-300">
        <div className="p-4 bg-gradient-to-r from-teal-50 to-teal-100 border-b-2 border-teal-300">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-teal-900 flex items-center gap-2">
              <TestTube className="w-6 h-6 text-teal-600" />
              Real-Time Lab Orders
            </h2>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <TestTube className="w-16 h-16 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm italic">
              No lab orders detected yet. Start dictating lab orders...
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Examples: "Order CBC and CMP" or "Let's get a fasting lipid panel"
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-teal-300">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-teal-50 to-teal-100 border-b-2 border-teal-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-teal-900 flex items-center gap-2">
            <TestTube className="w-6 h-6 text-teal-600" />
            Real-Time Lab Orders
            <span className="ml-2 px-3 py-1 bg-teal-600 text-white text-sm rounded-full font-bold">
              {activeLabs.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {activeLabs.length > 0 && (
              <button
                onClick={copyAllLabs}
                className="px-3 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition flex items-center gap-2"
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
              className="p-2 hover:bg-teal-200 rounded-lg transition"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-teal-700" />
              ) : (
                <ChevronDown className="w-5 h-5 text-teal-700" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {sortedGroups.map(([groupKey, groupLabs], groupIndex) => {
            const [orderDate, location] = groupKey.split('|');
            const highestUrgency = groupLabs.reduce((max, lab) => {
              const urgencyOrder = { 'stat': 0, 'urgent': 1, 'routine': 2 };
              return urgencyOrder[lab.urgency] < urgencyOrder[max.urgency] ? lab : max;
            }).urgency;

            const urgencyColors = {
              stat: 'bg-red-50 border-red-300',
              urgent: 'bg-orange-50 border-orange-300',
              routine: 'bg-blue-50 border-blue-300'
            };

            const urgencyIcons = {
              stat: '🚨',
              urgent: '⚡',
              routine: '📋'
            };

            return (
              <div
                key={groupKey}
                className={`p-4 rounded-lg border-2 ${urgencyColors[highestUrgency]} ${groupIndex > 0 ? 'mt-4' : ''}`}
              >
                {/* Group Header */}
                <div className="mb-3 pb-2 border-b-2 border-gray-300">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{urgencyIcons[highestUrgency]}</span>
                      <span className="font-bold text-gray-900">{orderDate}</span>
                    </div>
                    {getUrgencyBadge(highestUrgency)}
                  </div>
                  {location !== 'No Location' && (
                    <div className="text-sm text-gray-700 flex items-center gap-2 mt-1">
                      <span>📍</span>
                      <span className="font-semibold">{location}</span>
                    </div>
                  )}
                </div>

                {/* Labs in this group */}
                <div className="space-y-2">
                  {groupLabs.map((lab, labIndex) => (
                    <div key={lab.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm font-bold text-gray-600">{labIndex + 1}.</span>
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900">{lab.testName}</span>
                          {lab.fasting && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                              🍽️ FASTING
                            </span>
                          )}
                          {lab.notes && (
                            <div className="text-xs text-gray-600 mt-1">{lab.notes}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(formatLabText(lab), lab.id)}
                          className="p-2 hover:bg-gray-100 rounded transition"
                          title="Copy lab order"
                        >
                          {copiedId === lab.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        {onDeleteLab && (
                          <button
                            onClick={() => onDeleteLab(lab.id)}
                            className="p-2 hover:bg-red-100 rounded transition"
                            title="Delete this lab order"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Instructions */}
          <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
            <p className="text-xs text-teal-800">
              <span className="font-bold">💡 Staff Instructions:</span> Send these lab orders to the laboratory.
              Priority: STAT first, then Urgent, then Routine. Copy all labs using the button above.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
