/**
 * Thyroid Nodule Dashboard Component
 *
 * Disease-specific clinical cockpit for thyroid nodule surveillance.
 * 3-column layout: Nodule Summary | Biopsy History | Surveillance Plan
 */

import { useState } from 'react';
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Calendar, FileText, Scan, Clock, CircleDot, Target
} from 'lucide-react';
import ZoneA_StatusStrip, { StatusType, StatusChange } from './ZoneA_StatusStrip';
import ZoneC_PlanMemory from './ZoneC_PlanMemory';

// Types
interface NoduleMeasurement {
  date: string;
  size: number; // in mm
}

interface Nodule {
  id: string;
  location: string; // e.g., "Right lobe, mid-pole"
  tiradsScore: number; // 1-5
  tiradsCategory: string; // TR1, TR2, etc.
  currentSize: number; // mm
  sizeHistory: NoduleMeasurement[];
  composition?: string;
  echogenicity?: string;
  margins?: string;
  calcifications?: string;
  growthRate?: string; // e.g., "2mm/year"
}

interface FNAResult {
  date: string;
  noduleId: string;
  noduleLocation: string;
  bethesdaCategory: number; // 1-6
  bethesdaLabel: string;
  details?: string;
}

interface MolecularTesting {
  date: string;
  testName: string;
  result: string;
  risk?: string;
}

interface SurveillanceRecommendation {
  action: string;
  timing: string;
  basis: string;
}

interface ThyroidNoduleData {
  // Status
  status: StatusType;
  headline: string;
  statusChanges: StatusChange[];
  lastVisitDate?: string;

  // Nodules
  nodules: Nodule[];
  totalNoduleCount?: number;

  // Biopsy History
  fnaHistory: FNAResult[];
  molecularTesting?: MolecularTesting[];

  // Surveillance
  nextUltrasound?: { date: string; reason: string };
  fnaRecommendations?: SurveillanceRecommendation[];
  generalPlan?: string;

  // Labs
  tsh?: { value: number; status: 'low' | 'normal' | 'high' };
  calcitonin?: { value: number; status: 'normal' | 'elevated' };

  // Plan Memory
  lastVisitChanges?: Array<{ action: string; details?: string }>;
  watching?: Array<{ item: string; reason?: string; status?: 'normal' | 'watching' | 'concerning' }>;
  nextTriggers?: Array<{ condition: string; action: string }>;
  lastNoteExcerpt?: string;
}

interface ThyroidNoduleDashboardProps {
  data: ThyroidNoduleData;
  className?: string;
}

// TI-RADS category colors
const tiradsConfig: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-green-100', text: 'text-green-800', label: 'TR1 - Benign' },
  2: { bg: 'bg-green-100', text: 'text-green-800', label: 'TR2 - Not Suspicious' },
  3: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'TR3 - Mildly Suspicious' },
  4: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'TR4 - Moderately Suspicious' },
  5: { bg: 'bg-red-100', text: 'text-red-800', label: 'TR5 - Highly Suspicious' }
};

// Bethesda category config
const bethesdaConfig: Record<number, { bg: string; text: string; risk: string }> = {
  1: { bg: 'bg-gray-100', text: 'text-gray-700', risk: 'Non-diagnostic' },
  2: { bg: 'bg-green-100', text: 'text-green-700', risk: '0-3% malignancy' },
  3: { bg: 'bg-amber-100', text: 'text-amber-700', risk: '5-15% malignancy' },
  4: { bg: 'bg-orange-100', text: 'text-orange-700', risk: '15-30% malignancy' },
  5: { bg: 'bg-red-100', text: 'text-red-700', risk: '60-75% malignancy' },
  6: { bg: 'bg-red-200', text: 'text-red-800', risk: 'Malignant' }
};

export default function ThyroidNoduleDashboard({ data, className = '' }: ThyroidNoduleDashboardProps) {
  const [selectedNodule, setSelectedNodule] = useState<string | null>(
    data.nodules.length > 0 ? data.nodules[0].id : null
  );

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get growth trend
  const getGrowthTrend = (sizeHistory: NoduleMeasurement[]) => {
    if (sizeHistory.length < 2) return null;
    const current = sizeHistory[0].size;
    const previous = sizeHistory[1].size;
    const growthPercent = ((current - previous) / previous) * 100;

    if (growthPercent > 20) return { direction: 'up', significant: true };
    if (growthPercent > 0) return { direction: 'up', significant: false };
    if (growthPercent < -10) return { direction: 'down', significant: true };
    if (growthPercent < 0) return { direction: 'down', significant: false };
    return { direction: 'stable', significant: false };
  };

  const selectedNoduleData = data.nodules.find(n => n.id === selectedNodule);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zone A: Status Strip */}
      <ZoneA_StatusStrip
        disease="Thyroid Nodule"
        status={data.status}
        headline={data.headline}
        changes={data.statusChanges}
        lastVisitDate={data.lastVisitDate}
      />

      {/* Zone B: Disease-Specific Dashboard (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Nodule Summary */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-teal-50 px-4 py-3 border-b border-teal-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDot className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-teal-900">Nodules</h3>
              </div>
              {data.totalNoduleCount && (
                <span className="text-sm text-teal-600">{data.totalNoduleCount} total</span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Nodule Selector */}
            {data.nodules.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {data.nodules.map((nodule, idx) => (
                  <button
                    key={nodule.id}
                    onClick={() => setSelectedNodule(nodule.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedNodule === nodule.id
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Nodule {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Selected Nodule Details */}
            {selectedNoduleData && (
              <div className="space-y-3">
                {/* Location */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Location</span>
                  <p className="font-medium text-gray-800">{selectedNoduleData.location}</p>
                </div>

                {/* TI-RADS */}
                <div className={`rounded-lg p-3 ${tiradsConfig[selectedNoduleData.tiradsScore]?.bg || 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">TI-RADS Score</span>
                    <span className={`font-bold ${tiradsConfig[selectedNoduleData.tiradsScore]?.text || 'text-gray-700'}`}>
                      {selectedNoduleData.tiradsCategory}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${tiradsConfig[selectedNoduleData.tiradsScore]?.text || 'text-gray-600'}`}>
                    {tiradsConfig[selectedNoduleData.tiradsScore]?.label}
                  </p>
                </div>

                {/* Size & Trend */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Size</span>
                    {getGrowthTrend(selectedNoduleData.sizeHistory) && (
                      <div className="flex items-center gap-1">
                        {getGrowthTrend(selectedNoduleData.sizeHistory)?.direction === 'up' ? (
                          <TrendingUp className={`w-4 h-4 ${
                            getGrowthTrend(selectedNoduleData.sizeHistory)?.significant
                              ? 'text-red-500' : 'text-amber-500'
                          }`} />
                        ) : getGrowthTrend(selectedNoduleData.sizeHistory)?.direction === 'down' ? (
                          <TrendingDown className="w-4 h-4 text-green-500" />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-end gap-2">
                    {selectedNoduleData.sizeHistory.slice(0, 4).map((measurement, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <div key={idx} className={`flex-1 text-center ${!isLatest && 'opacity-60'}`}>
                          <div className={`text-lg font-bold ${isLatest ? 'text-teal-700' : 'text-gray-500'}`}>
                            {measurement.size}mm
                          </div>
                          <div className="text-xs text-gray-500">{formatDate(measurement.date)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedNoduleData.growthRate && (
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      Growth: {selectedNoduleData.growthRate}
                    </p>
                  )}
                </div>

                {/* Characteristics */}
                <div className="grid grid-cols-2 gap-2">
                  {selectedNoduleData.composition && (
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-500">Composition</span>
                      <p className="text-sm font-medium">{selectedNoduleData.composition}</p>
                    </div>
                  )}
                  {selectedNoduleData.echogenicity && (
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-500">Echogenicity</span>
                      <p className="text-sm font-medium">{selectedNoduleData.echogenicity}</p>
                    </div>
                  )}
                  {selectedNoduleData.margins && (
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-500">Margins</span>
                      <p className="text-sm font-medium">{selectedNoduleData.margins}</p>
                    </div>
                  )}
                  {selectedNoduleData.calcifications && (
                    <div className="p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-500">Calcifications</span>
                      <p className="text-sm font-medium">{selectedNoduleData.calcifications}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Labs */}
            {(data.tsh || data.calcitonin) && (
              <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                {data.tsh && (
                  <div className={`p-2 rounded ${
                    data.tsh.status !== 'normal' ? 'bg-amber-50' : 'bg-gray-50'
                  }`}>
                    <span className="text-xs text-gray-500">TSH</span>
                    <p className={`font-bold ${
                      data.tsh.status !== 'normal' ? 'text-amber-700' : 'text-gray-700'
                    }`}>
                      {data.tsh.value}
                    </p>
                  </div>
                )}
                {data.calcitonin && (
                  <div className={`p-2 rounded ${
                    data.calcitonin.status === 'elevated' ? 'bg-red-50' : 'bg-gray-50'
                  }`}>
                    <span className="text-xs text-gray-500">Calcitonin</span>
                    <p className={`font-bold ${
                      data.calcitonin.status === 'elevated' ? 'text-red-700' : 'text-gray-700'
                    }`}>
                      {data.calcitonin.value}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Biopsy History */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Biopsy History</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* FNA Results */}
            {data.fnaHistory.length > 0 ? (
              <div className="space-y-3">
                {data.fnaHistory.map((fna, idx) => {
                  const bethesda = bethesdaConfig[fna.bethesdaCategory];
                  return (
                    <div key={idx} className={`rounded-lg p-4 ${bethesda?.bg || 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{formatDate(fna.date)}</span>
                        <span className={`text-xs font-medium ${bethesda?.text || 'text-gray-600'}`}>
                          {fna.noduleLocation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${bethesda?.text || 'text-gray-700'}`}>
                          Bethesda {fna.bethesdaCategory}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{fna.bethesdaLabel}</p>
                      <p className="text-xs text-gray-600 mt-1">{bethesda?.risk}</p>
                      {fna.details && (
                        <p className="text-xs text-gray-500 mt-2 italic">{fna.details}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No FNA performed</p>
              </div>
            )}

            {/* Molecular Testing */}
            {data.molecularTesting && data.molecularTesting.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 mb-2 block">Molecular Testing</span>
                <div className="space-y-2">
                  {data.molecularTesting.map((test, idx) => (
                    <div key={idx} className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-purple-800">{test.testName}</span>
                        <span className="text-xs text-gray-500">{formatDate(test.date)}</span>
                      </div>
                      <p className="text-sm text-purple-700">{test.result}</p>
                      {test.risk && (
                        <p className="text-xs text-purple-600 mt-1">Risk: {test.risk}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Surveillance Plan */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-600" />
              <h3 className="font-semibold text-gray-900">Surveillance Plan</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Next Ultrasound */}
            {data.nextUltrasound && (
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
                <div className="flex items-center gap-2 mb-2">
                  <Scan className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-teal-800">Next Ultrasound</span>
                </div>
                <p className="text-lg font-bold text-teal-900">
                  {formatDate(data.nextUltrasound.date)}
                </p>
                <p className="text-sm text-teal-700 mt-1">{data.nextUltrasound.reason}</p>
              </div>
            )}

            {/* FNA Recommendations */}
            {data.fnaRecommendations && data.fnaRecommendations.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 mb-2 block">FNA Trigger Criteria</span>
                <div className="space-y-2">
                  {data.fnaRecommendations.map((rec, idx) => (
                    <div key={idx} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">{rec.action}</p>
                          <p className="text-xs text-amber-700">{rec.timing}</p>
                          <p className="text-xs text-amber-600 mt-1 italic">Based on: {rec.basis}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Plan */}
            {data.generalPlan && (
              <div className="bg-gray-50 rounded-lg p-4">
                <span className="text-sm font-medium text-gray-600 mb-2 block">Management Plan</span>
                <p className="text-sm text-gray-700">{data.generalPlan}</p>
              </div>
            )}

            {/* Quick Reference */}
            <div className="pt-3 border-t border-gray-100">
              <span className="text-xs font-medium text-gray-500 mb-2 block">ACR TI-RADS Guidelines</span>
              <div className="grid grid-cols-5 gap-1 text-center">
                {[1, 2, 3, 4, 5].map(score => (
                  <div key={score} className={`p-1 rounded text-xs ${tiradsConfig[score]?.bg} ${tiradsConfig[score]?.text}`}>
                    TR{score}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone C: Plan + Memory */}
      <ZoneC_PlanMemory
        lastVisitDate={data.lastVisitDate}
        lastVisitChanges={data.lastVisitChanges}
        watching={data.watching}
        nextTriggers={data.nextTriggers}
        lastNoteExcerpt={data.lastNoteExcerpt}
      />
    </div>
  );
}
