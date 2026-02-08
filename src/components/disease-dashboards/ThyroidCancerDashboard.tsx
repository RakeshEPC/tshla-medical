/**
 * Thyroid Cancer Dashboard Component
 *
 * Disease-specific clinical cockpit for thyroid cancer surveillance.
 * 3-column layout: Cancer Overview | Surveillance Panel | Imaging & Anatomy
 */

import { useState } from 'react';
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Calendar, Radio, Scan, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import ZoneA_StatusStrip, { StatusType, StatusChange } from './ZoneA_StatusStrip';
import ZoneC_PlanMemory from './ZoneC_PlanMemory';

// Types
interface Surgery {
  type: string;
  date: string;
  details?: string;
}

interface RAITreatment {
  date: string;
  dose: string;
  indication?: string;
}

interface LabReading {
  value: number;
  unit: string;
  date: string;
  status: 'undetectable' | 'low' | 'normal' | 'elevated' | 'high';
}

interface ImagingStudy {
  type: string;
  date: string;
  findings: string;
  status: 'clear' | 'stable' | 'concerning' | 'new-finding';
}

interface ThyroidCancerData {
  // Cancer Specifics
  cancerType: string; // PTC, FTC, MTC, ATC, etc.
  stage?: string;
  riskCategory: 'low' | 'intermediate' | 'high';

  // Status
  status: StatusType;
  headline: string;
  statusChanges: StatusChange[];
  lastVisitDate?: string;

  // Surgical History
  surgeries: Surgery[];

  // RAI History
  raiTreatments: RAITreatment[];

  // Surveillance Labs
  thyroglobulin: LabReading[];
  thyroglobulinAntibody: LabReading[];
  tsh: LabReading[];
  tshSuppressionTarget?: { low: number; high: number };

  // Imaging
  lastUltrasound?: ImagingStudy;
  otherImaging?: ImagingStudy[];
  residualTissue?: string;
  suspiciousNodes?: string[];

  // Plan Memory
  lastVisitChanges?: Array<{ action: string; details?: string }>;
  watching?: Array<{ item: string; reason?: string; status?: 'normal' | 'watching' | 'concerning' }>;
  nextTriggers?: Array<{ condition: string; action: string }>;
  lastNoteExcerpt?: string;
}

interface ThyroidCancerDashboardProps {
  data: ThyroidCancerData;
  className?: string;
}

// Risk category colors
const riskCategoryConfig: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-800', label: 'Low Risk' },
  intermediate: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Intermediate Risk' },
  high: { bg: 'bg-red-100', text: 'text-red-800', label: 'High Risk' }
};

// Lab status colors
const labStatusConfig: Record<string, string> = {
  undetectable: 'text-green-600 bg-green-50',
  low: 'text-green-600 bg-green-50',
  normal: 'text-gray-600 bg-gray-50',
  elevated: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50'
};

export default function ThyroidCancerDashboard({ data, className = '' }: ThyroidCancerDashboardProps) {
  const [showAllSurgeries, setShowAllSurgeries] = useState(false);
  const [showAllRAI, setShowAllRAI] = useState(false);

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get trend
  const getLabTrend = (readings: LabReading[]) => {
    if (readings.length < 2) return null;
    const current = readings[0].value;
    const previous = readings[1].value;
    if (current === previous) return 'stable';
    return current > previous ? 'up' : 'down';
  };

  const riskConfig = riskCategoryConfig[data.riskCategory];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zone A: Status Strip */}
      <ZoneA_StatusStrip
        disease={`Thyroid Cancer (${data.cancerType})`}
        status={data.status}
        headline={data.headline}
        changes={data.statusChanges}
        lastVisitDate={data.lastVisitDate}
      />

      {/* Zone B: Disease-Specific Dashboard (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Cancer Overview */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-rose-50 px-4 py-3 border-b border-rose-100">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-600" />
              <h3 className="font-semibold text-rose-900">Cancer Overview</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Type, Stage, Risk */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Histology</span>
                <span className="font-semibold text-gray-900">{data.cancerType}</span>
              </div>

              {data.stage && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Stage</span>
                  <span className="font-semibold text-gray-900">{data.stage}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: riskConfig.bg.replace('bg-', '') }}>
                <span className="text-sm text-gray-600">ATA Risk</span>
                <span className={`font-semibold px-2 py-0.5 rounded ${riskConfig.bg} ${riskConfig.text}`}>
                  {riskConfig.label}
                </span>
              </div>
            </div>

            {/* Surgical History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Surgical History</span>
                {data.surgeries.length > 2 && (
                  <button
                    onClick={() => setShowAllSurgeries(!showAllSurgeries)}
                    className="text-xs text-rose-600"
                  >
                    {showAllSurgeries ? 'Show less' : `+${data.surgeries.length - 2} more`}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(showAllSurgeries ? data.surgeries : data.surgeries.slice(0, 2)).map((surgery, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <span className="font-medium text-gray-800">{surgery.type}</span>
                      <span className="text-sm text-gray-500 ml-2">{formatDate(surgery.date)}</span>
                      {surgery.details && (
                        <p className="text-xs text-gray-600 mt-0.5">{surgery.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RAI History */}
            {data.raiTreatments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">RAI History</span>
                  {data.raiTreatments.length > 2 && (
                    <button
                      onClick={() => setShowAllRAI(!showAllRAI)}
                      className="text-xs text-rose-600"
                    >
                      {showAllRAI ? 'Show less' : `+${data.raiTreatments.length - 2} more`}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {(showAllRAI ? data.raiTreatments : data.raiTreatments.slice(0, 2)).map((rai, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-amber-50 rounded">
                      <Radio className="w-4 h-4 text-amber-500 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-800">{rai.dose}</span>
                        <span className="text-sm text-gray-500 ml-2">{formatDate(rai.date)}</span>
                        {rai.indication && (
                          <p className="text-xs text-gray-600 mt-0.5">{rai.indication}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Surveillance Panel */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">Surveillance</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Thyroglobulin */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Thyroglobulin</span>
                {getLabTrend(data.thyroglobulin) && (
                  <div className="flex items-center gap-1">
                    {getLabTrend(data.thyroglobulin) === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    ) : getLabTrend(data.thyroglobulin) === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-end gap-2">
                {data.thyroglobulin.slice(0, 4).map((reading, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div key={idx} className={`flex-1 text-center ${!isLatest && 'opacity-60'}`}>
                      <div className={`text-lg font-bold px-1 py-0.5 rounded ${labStatusConfig[reading.status]}`}>
                        {reading.status === 'undetectable' ? '<0.1' : reading.value}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(reading.date)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tg Antibody */}
            {data.thyroglobulinAntibody.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tg Antibody</span>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold px-2 py-0.5 rounded ${labStatusConfig[data.thyroglobulinAntibody[0].status]}`}>
                    {data.thyroglobulinAntibody[0].value} {data.thyroglobulinAntibody[0].unit}
                  </span>
                  {getLabTrend(data.thyroglobulinAntibody) === 'down' && (
                    <TrendingDown className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>
            )}

            {/* TSH Suppression */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">TSH Suppression</span>
                {data.tshSuppressionTarget && (
                  <span className="text-xs text-purple-600">
                    Target: {data.tshSuppressionTarget.low}-{data.tshSuppressionTarget.high}
                  </span>
                )}
              </div>

              {data.tsh.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${
                    data.tsh[0].status === 'low' ? 'text-green-600' :
                    data.tsh[0].status === 'normal' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {data.tsh[0].value}
                  </span>
                  <span className="text-sm text-gray-500">{data.tsh[0].unit}</span>
                  {data.tsh[0].status === 'low' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">On Target</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Imaging & Anatomy */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Imaging & Anatomy</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Last Ultrasound */}
            {data.lastUltrasound && (
              <div className={`rounded-lg p-4 ${
                data.lastUltrasound.status === 'clear' ? 'bg-green-50' :
                data.lastUltrasound.status === 'stable' ? 'bg-gray-50' :
                data.lastUltrasound.status === 'concerning' ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Last Neck Ultrasound</span>
                  <span className="text-xs text-gray-500">{formatDate(data.lastUltrasound.date)}</span>
                </div>
                <p className="text-sm text-gray-700">{data.lastUltrasound.findings}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                  data.lastUltrasound.status === 'clear' ? 'bg-green-100 text-green-700' :
                  data.lastUltrasound.status === 'stable' ? 'bg-gray-200 text-gray-700' :
                  data.lastUltrasound.status === 'concerning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {data.lastUltrasound.status.replace('-', ' ')}
                </span>
              </div>
            )}

            {/* Residual Tissue */}
            {data.residualTissue && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Residual Tissue</span>
                <p className="text-sm text-gray-800 mt-1">{data.residualTissue}</p>
              </div>
            )}

            {/* Suspicious Nodes */}
            {data.suspiciousNodes && data.suspiciousNodes.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Nodes Under Surveillance</span>
                </div>
                <ul className="space-y-1">
                  {data.suspiciousNodes.map((node, idx) => (
                    <li key={idx} className="text-sm text-amber-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {node}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Other Imaging */}
            {data.otherImaging && data.otherImaging.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 mb-2 block">Other Imaging</span>
                <div className="space-y-2">
                  {data.otherImaging.map((study, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-800">{study.type}</span>
                        <span className="text-xs text-gray-500 ml-2">{formatDate(study.date)}</span>
                        <p className="text-xs text-gray-600">{study.findings}</p>
                      </div>
                    </div>
                  ))}
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
