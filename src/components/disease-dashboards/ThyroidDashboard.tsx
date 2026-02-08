/**
 * Thyroid Dashboard Component
 *
 * Disease-specific clinical cockpit for hypothyroid/hyperthyroid patients.
 * 3-column layout: Thyroid Function | Medication Timeline | Symptom Alignment
 */

import { useState } from 'react';
import {
  Activity, Pill, TrendingUp, TrendingDown, Minus,
  ThermometerSun, Heart, Moon, Sun, Scale, Clock,
  AlertTriangle, Check, X, ChevronDown, ChevronUp
} from 'lucide-react';
import ZoneA_StatusStrip, { StatusType, StatusChange } from './ZoneA_StatusStrip';
import ZoneC_PlanMemory from './ZoneC_PlanMemory';

// Types
interface LabReading {
  value: number;
  unit: string;
  date: string;
  status: 'low' | 'normal' | 'high';
  reference?: { low: number; high: number };
}

interface ThyroidLabs {
  tsh: LabReading[];
  freeT4?: LabReading[];
  freeT3?: LabReading[];
  totalT4?: LabReading[];
  totalT3?: LabReading[];
}

interface MedicationChange {
  date: string;
  medication: string;
  previousDose?: string;
  newDose: string;
  reason?: string;
}

interface ThyroidMedication {
  name: string;
  dose: string;
  frequency: string;
  startDate?: string;
  brand?: string;
}

interface Symptom {
  name: string;
  present: boolean;
  severity?: 'mild' | 'moderate' | 'severe';
}

interface ThyroidData {
  // Diagnosis type
  diagnosisType: 'hypothyroid' | 'hyperthyroid' | 'hashimoto' | 'graves' | 'subclinical-hypo' | 'subclinical-hyper';

  // Status
  status: StatusType;
  headline: string;
  statusChanges: StatusChange[];
  lastVisitDate?: string;

  // Labs
  labs: ThyroidLabs;
  tshGoal?: { low: number; high: number };

  // Medications
  currentMedication?: ThyroidMedication;
  medicationHistory: MedicationChange[];

  // Symptoms
  hypoSymptoms: Symptom[];
  hyperSymptoms: Symptom[];
  labSymptomDiscordance?: string;

  // Vitals
  heartRate?: { value: number; status: 'low' | 'normal' | 'high' };
  weight?: { current: number; change: number; unit: string };

  // Plan Memory
  lastVisitChanges?: Array<{ action: string; details?: string }>;
  watching?: Array<{ item: string; reason?: string; status?: 'normal' | 'watching' | 'concerning' }>;
  nextTriggers?: Array<{ condition: string; action: string }>;
  lastNoteExcerpt?: string;
}

interface ThyroidDashboardProps {
  data: ThyroidData;
  className?: string;
}

// Diagnosis labels
const diagnosisLabels: Record<string, string> = {
  'hypothyroid': 'Hypothyroidism',
  'hyperthyroid': 'Hyperthyroidism',
  'hashimoto': "Hashimoto's Thyroiditis",
  'graves': "Graves' Disease",
  'subclinical-hypo': 'Subclinical Hypothyroidism',
  'subclinical-hyper': 'Subclinical Hyperthyroidism'
};

export default function ThyroidDashboard({ data, className = '' }: ThyroidDashboardProps) {
  const [showAllMedHistory, setShowAllMedHistory] = useState(false);

  // Get lab status color
  const getLabStatusColor = (status: string) => {
    switch (status) {
      case 'low': return 'text-blue-600 bg-blue-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  // Get trend between last two readings
  const getLabTrend = (readings: LabReading[]) => {
    if (readings.length < 2) return null;
    const current = readings[0].value;
    const previous = readings[1].value;
    const diff = current - previous;
    const percentChange = (diff / previous) * 100;

    if (Math.abs(percentChange) < 5) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zone A: Status Strip */}
      <ZoneA_StatusStrip
        disease={diagnosisLabels[data.diagnosisType] || 'Thyroid Disorder'}
        status={data.status}
        headline={data.headline}
        changes={data.statusChanges}
        lastVisitDate={data.lastVisitDate}
      />

      {/* Zone B: Disease-Specific Dashboard (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Thyroid Function Snapshot */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">Thyroid Function</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* TSH */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">TSH</span>
                {getLabTrend(data.labs.tsh) && (
                  <div className="flex items-center gap-1">
                    {getLabTrend(data.labs.tsh) === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                    ) : getLabTrend(data.labs.tsh) === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                )}
              </div>

              {/* TSH Values */}
              <div className="flex items-end gap-2">
                {data.labs.tsh.slice(0, 3).map((reading, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div key={idx} className={`flex-1 text-center ${!isLatest && 'opacity-60'}`}>
                      <div className={`text-xl font-bold px-2 py-1 rounded ${getLabStatusColor(reading.status)}`}>
                        {reading.value}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(reading.date)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Goal Range */}
              {data.tshGoal && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Goal: {data.tshGoal.low} - {data.tshGoal.high} mIU/L
                </div>
              )}
            </div>

            {/* Free T4 */}
            {data.labs.freeT4 && data.labs.freeT4.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Free T4</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold px-2 py-0.5 rounded ${getLabStatusColor(data.labs.freeT4[0].status)}`}>
                    {data.labs.freeT4[0].value}
                  </span>
                  <span className="text-sm text-gray-500">{data.labs.freeT4[0].unit}</span>
                  {getLabTrend(data.labs.freeT4) === 'up' && <TrendingUp className="w-4 h-4 text-gray-400" />}
                  {getLabTrend(data.labs.freeT4) === 'down' && <TrendingDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
            )}

            {/* Free T3 */}
            {data.labs.freeT3 && data.labs.freeT3.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Free T3</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold px-2 py-0.5 rounded ${getLabStatusColor(data.labs.freeT3[0].status)}`}>
                    {data.labs.freeT3[0].value}
                  </span>
                  <span className="text-sm text-gray-500">{data.labs.freeT3[0].unit}</span>
                  {getLabTrend(data.labs.freeT3) === 'up' && <TrendingUp className="w-4 h-4 text-gray-400" />}
                  {getLabTrend(data.labs.freeT3) === 'down' && <TrendingDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
            )}

            {/* Vitals */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
              {data.heartRate && (
                <div className={`p-3 rounded-lg ${
                  data.heartRate.status === 'normal' ? 'bg-green-50' :
                  data.heartRate.status === 'high' ? 'bg-red-50' : 'bg-blue-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Heart className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Heart Rate</span>
                  </div>
                  <div className={`text-lg font-bold ${
                    data.heartRate.status === 'normal' ? 'text-green-700' :
                    data.heartRate.status === 'high' ? 'text-red-700' : 'text-blue-700'
                  }`}>
                    {data.heartRate.value} bpm
                  </div>
                </div>
              )}

              {data.weight && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-1 mb-1">
                    <Scale className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Weight</span>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {data.weight.current} {data.weight.unit}
                  </div>
                  {data.weight.change !== 0 && (
                    <div className={`text-xs ${data.weight.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {data.weight.change > 0 ? '+' : ''}{data.weight.change} {data.weight.unit}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Medication Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Medication Timeline</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Current Medication */}
            {data.currentMedication && (
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-indigo-600 uppercase">Current</span>
                  {data.currentMedication.startDate && (
                    <span className="text-xs text-gray-500">
                      Since {formatDate(data.currentMedication.startDate)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="font-bold text-indigo-900">{data.currentMedication.name}</span>
                    {data.currentMedication.brand && (
                      <span className="text-sm text-indigo-600 ml-1">({data.currentMedication.brand})</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-lg font-semibold text-indigo-800">
                  {data.currentMedication.dose} {data.currentMedication.frequency}
                </div>
              </div>
            )}

            {/* Medication History */}
            {data.medicationHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Dose Changes</span>
                  {data.medicationHistory.length > 3 && (
                    <button
                      onClick={() => setShowAllMedHistory(!showAllMedHistory)}
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      {showAllMedHistory ? 'Show less' : 'Show all'}
                    </button>
                  )}
                </div>

                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

                  <div className="space-y-3">
                    {(showAllMedHistory ? data.medicationHistory : data.medicationHistory.slice(0, 3)).map((change, idx) => (
                      <div key={idx} className="relative flex items-start gap-3 pl-7">
                        {/* Timeline dot */}
                        <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />

                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">
                              {change.previousDose ? `${change.previousDose} → ${change.newDose}` : change.newDose}
                            </span>
                            <span className="text-xs text-gray-500">{formatDate(change.date)}</span>
                          </div>
                          {change.reason && (
                            <p className="text-xs text-gray-600 mt-1">{change.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {data.medicationHistory.length === 0 && !data.currentMedication && (
              <div className="text-center py-4 text-gray-500">
                <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No medication history</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Symptom Alignment */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <ThermometerSun className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Symptom Alignment</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Lab/Symptom Discordance Warning */}
            {data.labSymptomDiscordance && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-amber-800">Discordance Noted</span>
                    <p className="text-sm text-amber-700 mt-1">{data.labSymptomDiscordance}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Hypo Symptoms */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Moon className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Hypothyroid Symptoms</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data.hypoSymptoms.map((symptom, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded ${
                      symptom.present ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                  >
                    {symptom.present ? (
                      <Check className="w-4 h-4 text-blue-600" />
                    ) : (
                      <X className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm ${symptom.present ? 'text-blue-800' : 'text-gray-500'}`}>
                      {symptom.name}
                    </span>
                    {symptom.present && symptom.severity && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        symptom.severity === 'severe' ? 'bg-red-100 text-red-700' :
                        symptom.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {symptom.severity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hyper Symptoms */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">Hyperthyroid Symptoms</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data.hyperSymptoms.map((symptom, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded ${
                      symptom.present ? 'bg-orange-50' : 'bg-gray-50'
                    }`}
                  >
                    {symptom.present ? (
                      <Check className="w-4 h-4 text-orange-600" />
                    ) : (
                      <X className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm ${symptom.present ? 'text-orange-800' : 'text-gray-500'}`}>
                      {symptom.name}
                    </span>
                    {symptom.present && symptom.severity && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        symptom.severity === 'severe' ? 'bg-red-100 text-red-700' :
                        symptom.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {symptom.severity}
                      </span>
                    )}
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
