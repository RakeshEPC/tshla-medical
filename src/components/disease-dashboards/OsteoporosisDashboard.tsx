/**
 * Osteoporosis Dashboard Component
 *
 * Disease-specific clinical cockpit for osteoporosis/osteopenia patients.
 * 3-column layout: Bone Density | Medication Timeline | Risk Factors
 */

import { useState } from 'react';
import {
  Activity, Pill, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Calendar, Bone, Scale, Clock, CheckCircle, XCircle, Pause
} from 'lucide-react';
import ZoneA_StatusStrip, { StatusType, StatusChange } from './ZoneA_StatusStrip';
import ZoneC_PlanMemory from './ZoneC_PlanMemory';

// Types
interface TScore {
  site: 'spine' | 'hip' | 'femoral-neck' | 'forearm';
  value: number;
  date: string;
  previousValue?: number;
}

interface DEXAScan {
  date: string;
  tScores: TScore[];
  provider?: string;
}

interface Fracture {
  site: string;
  date: string;
  traumatic: boolean;
}

interface MedicationEntry {
  name: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'stopped' | 'on-holiday';
  stopReason?: string;
  duration?: string;
}

interface RiskFactor {
  name: string;
  present: boolean;
  details?: string;
}

interface OsteoporosisData {
  // Diagnosis
  diagnosis: 'osteoporosis' | 'osteopenia' | 'severe-osteoporosis';

  // Status
  status: StatusType;
  headline: string;
  statusChanges: StatusChange[];
  lastVisitDate?: string;

  // Bone Density
  dexaScans: DEXAScan[];
  lowestTScore?: number;
  fraxScore?: { hip: number; major: number };

  // Fractures
  fractures: Fracture[];

  // Medications
  currentMedication?: MedicationEntry;
  medicationHistory: MedicationEntry[];
  drugHoliday?: {
    active: boolean;
    startDate?: string;
    duration?: string;
    reason?: string;
  };

  // Risk Factors
  primaryRiskFactors: RiskFactor[];
  secondaryCauses?: RiskFactor[];

  // Labs
  vitaminD?: { value: number; status: 'low' | 'normal' | 'optimal' };
  calcium?: { value: number; status: 'low' | 'normal' | 'high' };
  pth?: { value: number; status: 'normal' | 'elevated' };

  // Plan Memory
  lastVisitChanges?: Array<{ action: string; details?: string }>;
  watching?: Array<{ item: string; reason?: string; status?: 'normal' | 'watching' | 'concerning' }>;
  nextTriggers?: Array<{ condition: string; action: string }>;
  lastNoteExcerpt?: string;
}

interface OsteoporosisDashboardProps {
  data: OsteoporosisData;
  className?: string;
}

// Diagnosis labels
const diagnosisConfig: Record<string, { label: string; bg: string; text: string }> = {
  'osteoporosis': { label: 'Osteoporosis', bg: 'bg-red-100', text: 'text-red-800' },
  'osteopenia': { label: 'Osteopenia', bg: 'bg-amber-100', text: 'text-amber-800' },
  'severe-osteoporosis': { label: 'Severe Osteoporosis', bg: 'bg-red-200', text: 'text-red-900' }
};

// T-Score interpretation
const getTScoreColor = (value: number) => {
  if (value >= -1) return 'text-green-600';
  if (value >= -2.5) return 'text-amber-600';
  return 'text-red-600';
};

const getTScoreLabel = (value: number) => {
  if (value >= -1) return 'Normal';
  if (value >= -2.5) return 'Osteopenia';
  return 'Osteoporosis';
};

export default function OsteoporosisDashboard({ data, className = '' }: OsteoporosisDashboardProps) {
  const [showAllMeds, setShowAllMeds] = useState(false);

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get latest DEXA
  const latestDexa = data.dexaScans[0];

  // Medication status icon
  const getMedStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'stopped': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'on-holiday': return <Pause className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  const diagConfig = diagnosisConfig[data.diagnosis];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zone A: Status Strip */}
      <ZoneA_StatusStrip
        disease={diagConfig.label}
        status={data.status}
        headline={data.headline}
        changes={data.statusChanges}
        lastVisitDate={data.lastVisitDate}
      />

      {/* Zone B: Disease-Specific Dashboard (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Bone Density Summary */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <Bone className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">Bone Density</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Latest DEXA */}
            {latestDexa && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Latest DEXA</span>
                  <span className="text-xs text-gray-500">{formatDate(latestDexa.date)}</span>
                </div>

                <div className="space-y-3">
                  {latestDexa.tScores.map((score, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 capitalize">
                        {score.site.replace('-', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getTScoreColor(score.value)}`}>
                          {score.value.toFixed(1)}
                        </span>
                        {score.previousValue !== undefined && (
                          <span className="flex items-center text-xs text-gray-500">
                            {score.value > score.previousValue ? (
                              <TrendingUp className="w-3 h-3 text-green-500" />
                            ) : score.value < score.previousValue ? (
                              <TrendingDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <Minus className="w-3 h-3 text-gray-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {data.lowestTScore !== undefined && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Lowest T-Score</span>
                      <div>
                        <span className={`text-xl font-bold ${getTScoreColor(data.lowestTScore)}`}>
                          {data.lowestTScore.toFixed(1)}
                        </span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          data.lowestTScore >= -1 ? 'bg-green-100 text-green-700' :
                          data.lowestTScore >= -2.5 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {getTScoreLabel(data.lowestTScore)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FRAX Score */}
            {data.fraxScore && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">FRAX Hip</span>
                  <div className={`text-xl font-bold ${
                    data.fraxScore.hip >= 3 ? 'text-red-600' :
                    data.fraxScore.hip >= 1 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {data.fraxScore.hip}%
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">FRAX Major</span>
                  <div className={`text-xl font-bold ${
                    data.fraxScore.major >= 20 ? 'text-red-600' :
                    data.fraxScore.major >= 10 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {data.fraxScore.major}%
                  </div>
                </div>
              </div>
            )}

            {/* Fracture History */}
            {data.fractures.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">Fracture History</span>
                </div>
                <ul className="space-y-1">
                  {data.fractures.map((fx, idx) => (
                    <li key={idx} className="text-sm text-red-700 flex items-center justify-between">
                      <span>{fx.site} {!fx.traumatic && '(fragility)'}</span>
                      <span className="text-xs text-red-500">{formatDate(fx.date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Labs */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
              {data.vitaminD && (
                <div className={`p-2 rounded text-center ${
                  data.vitaminD.status === 'low' ? 'bg-red-50' :
                  data.vitaminD.status === 'optimal' ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  <span className="text-xs text-gray-500">Vit D</span>
                  <div className={`font-bold ${
                    data.vitaminD.status === 'low' ? 'text-red-600' :
                    data.vitaminD.status === 'optimal' ? 'text-green-600' : 'text-gray-700'
                  }`}>
                    {data.vitaminD.value}
                  </div>
                </div>
              )}
              {data.calcium && (
                <div className={`p-2 rounded text-center ${
                  data.calcium.status !== 'normal' ? 'bg-amber-50' : 'bg-gray-50'
                }`}>
                  <span className="text-xs text-gray-500">Ca</span>
                  <div className={`font-bold ${
                    data.calcium.status !== 'normal' ? 'text-amber-600' : 'text-gray-700'
                  }`}>
                    {data.calcium.value}
                  </div>
                </div>
              )}
              {data.pth && (
                <div className={`p-2 rounded text-center ${
                  data.pth.status === 'elevated' ? 'bg-amber-50' : 'bg-gray-50'
                }`}>
                  <span className="text-xs text-gray-500">PTH</span>
                  <div className={`font-bold ${
                    data.pth.status === 'elevated' ? 'text-amber-600' : 'text-gray-700'
                  }`}>
                    {data.pth.value}
                  </div>
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
            {/* Drug Holiday Alert */}
            {data.drugHoliday?.active && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Pause className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-800">On Drug Holiday</span>
                </div>
                {data.drugHoliday.startDate && (
                  <p className="text-sm text-amber-700 mt-1">
                    Since {formatDate(data.drugHoliday.startDate)}
                    {data.drugHoliday.duration && ` (${data.drugHoliday.duration})`}
                  </p>
                )}
                {data.drugHoliday.reason && (
                  <p className="text-xs text-amber-600 mt-1">{data.drugHoliday.reason}</p>
                )}
              </div>
            )}

            {/* Current Medication */}
            {data.currentMedication && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-green-600 uppercase">Current</span>
                  <span className="text-xs text-gray-500">
                    Since {formatDate(data.currentMedication.startDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-900">{data.currentMedication.name}</span>
                </div>
                {data.currentMedication.duration && (
                  <p className="text-sm text-green-700 mt-1">
                    Duration: {data.currentMedication.duration}
                  </p>
                )}
              </div>
            )}

            {/* Medication History */}
            {data.medicationHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">History</span>
                  {data.medicationHistory.length > 3 && (
                    <button
                      onClick={() => setShowAllMeds(!showAllMeds)}
                      className="text-xs text-indigo-600"
                    >
                      {showAllMeds ? 'Show less' : 'Show all'}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

                  <div className="space-y-3">
                    {(showAllMeds ? data.medicationHistory : data.medicationHistory.slice(0, 3)).map((med, idx) => (
                      <div key={idx} className="relative flex items-start gap-3 pl-7">
                        <div className="absolute left-1.5 top-1.5">
                          {getMedStatusIcon(med.status)}
                        </div>

                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">{med.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              med.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              med.status === 'stopped' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {med.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(med.startDate)}
                            {med.endDate && ` - ${formatDate(med.endDate)}`}
                          </p>
                          {med.stopReason && (
                            <p className="text-xs text-gray-600 mt-1 italic">
                              Stopped: {med.stopReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Risk Factors */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Risk Factors</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Primary Risk Factors */}
            <div>
              <span className="text-sm font-medium text-gray-600 mb-2 block">Primary Factors</span>
              <div className="space-y-2">
                {data.primaryRiskFactors.map((factor, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded ${
                      factor.present ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    {factor.present ? (
                      <CheckCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm ${factor.present ? 'text-red-800' : 'text-gray-500'}`}>
                      {factor.name}
                    </span>
                    {factor.present && factor.details && (
                      <span className="text-xs text-red-600">({factor.details})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Secondary Causes */}
            {data.secondaryCauses && data.secondaryCauses.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 mb-2 block">Secondary Causes</span>
                <div className="space-y-2">
                  {data.secondaryCauses.filter(c => c.present).map((cause, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-amber-50 rounded">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-amber-800">{cause.name}</span>
                      {cause.details && (
                        <span className="text-xs text-amber-600">({cause.details})</span>
                      )}
                    </div>
                  ))}
                  {data.secondaryCauses.every(c => !c.present) && (
                    <p className="text-sm text-gray-500 italic">None identified</p>
                  )}
                </div>
              </div>
            )}
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
