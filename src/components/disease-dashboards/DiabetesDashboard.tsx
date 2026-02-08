/**
 * Diabetes Dashboard Component
 *
 * Disease-specific clinical cockpit for diabetes patients.
 * 3-column layout: Medications | Glycemic Control | Complications
 */

import { useState, useEffect } from 'react';
import {
  Pill, Activity, AlertTriangle, Eye, Heart, Brain,
  TrendingUp, TrendingDown, Minus, Droplets, Scale,
  Gauge, Syringe, ChevronDown, ChevronUp, Smartphone
} from 'lucide-react';
import ZoneA_StatusStrip, { StatusType, StatusChange } from './ZoneA_StatusStrip';
import ZoneC_PlanMemory from './ZoneC_PlanMemory';

// Types
interface DiabetesMedication {
  name: string;
  dosage: string;
  category: 'basal' | 'bolus' | 'glp1' | 'sglt2' | 'oral' | 'other';
  trend?: 'up' | 'down' | 'stable';
  changeAmount?: string;
}

interface A1CReading {
  value: number;
  date: string;
}

interface CGMMetrics {
  timeInRange?: number;
  timeBelowRange?: number;
  timeAboveRange?: number;
  averageGlucose?: number;
  gmi?: number;
  coefficientOfVariation?: number;
}

interface ComplicationStatus {
  category: 'eyes' | 'kidneys' | 'neuropathy' | 'cardiovascular' | 'feet';
  status: 'normal' | 'watch' | 'abnormal' | 'unknown';
  lastChecked?: string;
  details?: string;
}

interface DiabetesData {
  // Status
  status: StatusType;
  headline: string;
  statusChanges: StatusChange[];
  lastVisitDate?: string;

  // Medications
  medications: DiabetesMedication[];
  devices?: {
    cgm?: string;
    pump?: string;
  };

  // Glycemic
  a1cHistory: A1CReading[];
  cgmMetrics?: CGMMetrics;
  hypoglycemiaFrequency?: {
    perWeek: number;
    trend: 'up' | 'down' | 'stable';
  };
  patterns?: string[];

  // Complications
  complications: ComplicationStatus[];
  weight?: {
    current: number;
    change: number;
    unit: string;
  };
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    status: 'normal' | 'elevated' | 'high';
  };
  lipids?: {
    ldl?: number;
    hdl?: number;
    status: 'normal' | 'borderline' | 'high';
  };

  // Plan Memory
  lastVisitChanges?: Array<{ action: string; details?: string }>;
  watching?: Array<{ item: string; reason?: string; status?: 'normal' | 'watching' | 'concerning' }>;
  nextTriggers?: Array<{ condition: string; action: string }>;
  lastNoteExcerpt?: string;
}

interface DiabetesDashboardProps {
  data: DiabetesData;
  className?: string;
}

// Medication category labels and colors
const medCategoryConfig: Record<string, { label: string; icon: typeof Pill; color: string }> = {
  basal: { label: 'Basal Insulin', icon: Syringe, color: 'text-blue-600 bg-blue-50' },
  bolus: { label: 'Bolus Insulin', icon: Syringe, color: 'text-purple-600 bg-purple-50' },
  glp1: { label: 'GLP-1/GIP', icon: Pill, color: 'text-green-600 bg-green-50' },
  sglt2: { label: 'SGLT2i', icon: Droplets, color: 'text-cyan-600 bg-cyan-50' },
  oral: { label: 'Oral Agents', icon: Pill, color: 'text-amber-600 bg-amber-50' },
  other: { label: 'Other', icon: Pill, color: 'text-gray-600 bg-gray-50' }
};

// Complication icons
const complicationIcons: Record<string, typeof Eye> = {
  eyes: Eye,
  kidneys: Droplets,
  neuropathy: Brain,
  cardiovascular: Heart,
  feet: Activity
};

export default function DiabetesDashboard({ data, className = '' }: DiabetesDashboardProps) {
  const [expandedMedCategories, setExpandedMedCategories] = useState<Record<string, boolean>>({
    basal: true,
    bolus: true,
    glp1: true,
    sglt2: true,
    oral: true,
    other: false
  });

  // Group medications by category
  const medsByCategory = data.medications.reduce((acc, med) => {
    if (!acc[med.category]) acc[med.category] = [];
    acc[med.category].push(med);
    return acc;
  }, {} as Record<string, DiabetesMedication[]>);

  // Get A1C trend
  const getA1CTrend = () => {
    if (data.a1cHistory.length < 2) return null;
    const current = data.a1cHistory[0].value;
    const previous = data.a1cHistory[1].value;
    const diff = current - previous;
    return {
      direction: diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'stable',
      amount: Math.abs(diff).toFixed(1),
      isGood: diff < 0
    };
  };

  const a1cTrend = getA1CTrend();

  // TIR status color
  const getTIRColor = (tir?: number) => {
    if (!tir) return 'text-gray-500';
    if (tir >= 70) return 'text-green-600';
    if (tir >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zone A: Status Strip */}
      <ZoneA_StatusStrip
        disease="Diabetes"
        status={data.status}
        headline={data.headline}
        changes={data.statusChanges}
        lastVisitDate={data.lastVisitDate}
      />

      {/* Zone B: Disease-Specific Dashboard (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Medication Stack */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Medications</h3>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Medication Categories */}
            {Object.entries(medsByCategory).map(([category, meds]) => {
              const config = medCategoryConfig[category];
              const Icon = config?.icon || Pill;
              const isExpanded = expandedMedCategories[category];

              return (
                <div key={category}>
                  <button
                    onClick={() => setExpandedMedCategories(prev => ({
                      ...prev,
                      [category]: !prev[category]
                    }))}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config?.color.split(' ')[0]}`} />
                      <span className="text-sm font-medium text-gray-700">
                        {config?.label || category}
                      </span>
                      <span className="text-xs text-gray-400">({meds.length})</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2">
                      {meds.map((med, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded ${config?.color.split(' ')[1] || 'bg-gray-50'}`}
                        >
                          <div>
                            <span className="font-medium text-gray-800">{med.name}</span>
                            <span className="text-sm text-gray-600 ml-2">{med.dosage}</span>
                          </div>
                          {med.trend && (
                            <div className="flex items-center gap-1">
                              {med.trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-blue-500" />
                              ) : med.trend === 'down' ? (
                                <TrendingDown className="w-4 h-4 text-amber-500" />
                              ) : (
                                <Minus className="w-4 h-4 text-gray-400" />
                              )}
                              {med.changeAmount && (
                                <span className="text-xs text-gray-500">{med.changeAmount}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Devices */}
            {data.devices && (data.devices.cgm || data.devices.pump) && (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Devices</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.devices.cgm && (
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 text-sm rounded">
                      CGM: {data.devices.cgm}
                    </span>
                  )}
                  {data.devices.pump && (
                    <span className="px-2 py-1 bg-violet-50 text-violet-700 text-sm rounded">
                      Pump: {data.devices.pump}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Glycemic Control (Center - Most Important) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">Glycemic Control</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* A1C Trend */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">A1C Trend</span>
                {a1cTrend && (
                  <div className="flex items-center gap-1">
                    {a1cTrend.direction === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : a1cTrend.direction === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm font-medium ${a1cTrend.isGood ? 'text-green-600' : 'text-red-600'}`}>
                      {a1cTrend.direction !== 'stable' && `${a1cTrend.amount}%`}
                    </span>
                  </div>
                )}
              </div>

              {/* A1C Values */}
              <div className="flex items-end gap-3">
                {data.a1cHistory.slice(0, 4).reverse().map((reading, idx) => {
                  const isLatest = idx === data.a1cHistory.slice(0, 4).length - 1;
                  return (
                    <div key={idx} className="text-center flex-1">
                      <div
                        className={`text-2xl font-bold ${
                          isLatest
                            ? reading.value <= 7 ? 'text-green-600' :
                              reading.value <= 8 ? 'text-amber-600' : 'text-red-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {reading.value}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(reading.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CGM Metrics */}
            {data.cgmMetrics && (
              <div className="grid grid-cols-2 gap-3">
                {/* Time in Range */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">Time in Range</span>
                  </div>
                  <div className={`text-2xl font-bold ${getTIRColor(data.cgmMetrics.timeInRange)}`}>
                    {data.cgmMetrics.timeInRange ?? '--'}%
                  </div>
                  <div className="text-xs text-gray-500">Goal: ≥70%</div>
                </div>

                {/* Time Below Range (Lows) */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-medium text-gray-600">Time Below</span>
                  </div>
                  <div className={`text-2xl font-bold ${
                    (data.cgmMetrics.timeBelowRange || 0) <= 4 ? 'text-green-600' :
                    (data.cgmMetrics.timeBelowRange || 0) <= 10 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {data.cgmMetrics.timeBelowRange ?? '--'}%
                  </div>
                  <div className="text-xs text-gray-500">Goal: ≤4%</div>
                </div>

                {/* Average Glucose */}
                {data.cgmMetrics.averageGlucose && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">Avg Glucose</div>
                    <div className="text-xl font-bold text-gray-800">
                      {data.cgmMetrics.averageGlucose} mg/dL
                    </div>
                  </div>
                )}

                {/* GMI */}
                {data.cgmMetrics.gmi && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">GMI</div>
                    <div className="text-xl font-bold text-gray-800">
                      {data.cgmMetrics.gmi}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hypoglycemia */}
            {data.hypoglycemiaFrequency && (
              <div className={`p-3 rounded-lg ${
                data.hypoglycemiaFrequency.perWeek === 0 ? 'bg-green-50' :
                data.hypoglycemiaFrequency.perWeek <= 2 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${
                      data.hypoglycemiaFrequency.perWeek === 0 ? 'text-green-600' :
                      data.hypoglycemiaFrequency.perWeek <= 2 ? 'text-amber-600' : 'text-red-600'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">Lows/Week</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${
                      data.hypoglycemiaFrequency.perWeek === 0 ? 'text-green-700' :
                      data.hypoglycemiaFrequency.perWeek <= 2 ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      {data.hypoglycemiaFrequency.perWeek}
                    </span>
                    {data.hypoglycemiaFrequency.trend === 'up' && (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    )}
                    {data.hypoglycemiaFrequency.trend === 'down' && (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Patterns */}
            {data.patterns && data.patterns.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-2">Pattern Flags</div>
                <div className="flex flex-wrap gap-2">
                  {data.patterns.map((pattern, idx) => (
                    <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Complications & Risk */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600" />
              <h3 className="font-semibold text-gray-900">Complications & Risk</h3>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Complication Status Grid */}
            {data.complications.map((comp, idx) => {
              const Icon = complicationIcons[comp.category] || AlertTriangle;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    comp.status === 'normal' ? 'bg-green-50' :
                    comp.status === 'watch' ? 'bg-amber-50' :
                    comp.status === 'abnormal' ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${
                      comp.status === 'normal' ? 'text-green-600' :
                      comp.status === 'watch' ? 'text-amber-600' :
                      comp.status === 'abnormal' ? 'text-red-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <span className="font-medium text-gray-800 capitalize">{comp.category}</span>
                      {comp.details && (
                        <p className="text-xs text-gray-600">{comp.details}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      comp.status === 'normal' ? 'text-green-700' :
                      comp.status === 'watch' ? 'text-amber-700' :
                      comp.status === 'abnormal' ? 'text-red-700' : 'text-gray-500'
                    }`}>
                      {comp.status === 'normal' ? '✓' :
                       comp.status === 'watch' ? '⚠️' :
                       comp.status === 'abnormal' ? '✗' : '?'}
                    </span>
                    {comp.lastChecked && (
                      <p className="text-xs text-gray-500">{comp.lastChecked}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Weight & BP */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
              {data.weight && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Scale className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">Weight</span>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {data.weight.current} {data.weight.unit}
                  </div>
                  {data.weight.change !== 0 && (
                    <div className={`text-xs ${
                      data.weight.change < 0 ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {data.weight.change > 0 ? '+' : ''}{data.weight.change} {data.weight.unit}
                    </div>
                  )}
                </div>
              )}

              {data.bloodPressure && (
                <div className={`rounded-lg p-3 ${
                  data.bloodPressure.status === 'normal' ? 'bg-green-50' :
                  data.bloodPressure.status === 'elevated' ? 'bg-amber-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">BP</span>
                  </div>
                  <div className={`text-lg font-bold ${
                    data.bloodPressure.status === 'normal' ? 'text-green-700' :
                    data.bloodPressure.status === 'elevated' ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {data.bloodPressure.systolic}/{data.bloodPressure.diastolic}
                  </div>
                </div>
              )}
            </div>

            {/* Lipids */}
            {data.lipids && (
              <div className={`p-3 rounded-lg ${
                data.lipids.status === 'normal' ? 'bg-green-50' :
                data.lipids.status === 'borderline' ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Lipids</span>
                  <div className="flex gap-3">
                    {data.lipids.ldl && (
                      <span className="text-sm">LDL: <strong>{data.lipids.ldl}</strong></span>
                    )}
                    {data.lipids.hdl && (
                      <span className="text-sm">HDL: <strong>{data.lipids.hdl}</strong></span>
                    )}
                  </div>
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
