/**
 * Dashboard Selector Component
 *
 * Automatically selects the appropriate disease dashboard based on patient diagnoses.
 * Falls back to general overview if no specific dashboard matches.
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Loader, LayoutDashboard } from 'lucide-react';
import DiabetesDashboard from './DiabetesDashboard';
import ThyroidDashboard from './ThyroidDashboard';
import ThyroidCancerDashboard from './ThyroidCancerDashboard';
import ThyroidNoduleDashboard from './ThyroidNoduleDashboard';
import OsteoporosisDashboard from './OsteoporosisDashboard';

// Dashboard types
export type DashboardType =
  | 'diabetes'
  | 'thyroid'
  | 'thyroid-cancer'
  | 'thyroid-nodule'
  | 'osteoporosis'
  | 'general';

interface Diagnosis {
  diagnosis: string;
  icd10?: string;
  status?: string;
}

interface DashboardSelectorProps {
  patientId: string;
  diagnoses: Diagnosis[];
  patientData?: any; // Full patient data from API
  onDashboardChange?: (dashboard: DashboardType) => void;
  className?: string;
}

// Priority-ordered disease detection patterns
const dashboardPatterns: Array<{ pattern: RegExp; dashboard: DashboardType; label: string }> = [
  {
    pattern: /thyroid.*(cancer|carcinoma|papillary|follicular|medullary|anaplastic)|PTC|FTC|MTC|ATC/i,
    dashboard: 'thyroid-cancer',
    label: 'Thyroid Cancer'
  },
  {
    pattern: /thyroid.*nodule|nodular.*thyroid|thyroid.*mass/i,
    dashboard: 'thyroid-nodule',
    label: 'Thyroid Nodule'
  },
  {
    pattern: /hypothyroid|hyperthyroid|hashimoto|graves|thyroiditis|goiter/i,
    dashboard: 'thyroid',
    label: 'Thyroid Disorder'
  },
  {
    pattern: /diabetes|DM\s*(1|2|type)|T1D|T2D|IDDM|NIDDM|diabetic/i,
    dashboard: 'diabetes',
    label: 'Diabetes'
  },
  {
    pattern: /osteoporosis|osteopenia|bone.*loss|fragility.*fracture/i,
    dashboard: 'osteoporosis',
    label: 'Osteoporosis'
  }
];

// ICD-10 code mapping (fallback)
const icd10Mapping: Record<string, DashboardType> = {
  // Thyroid Cancer
  'C73': 'thyroid-cancer',
  // Thyroid Nodule
  'E04': 'thyroid-nodule',
  'E04.1': 'thyroid-nodule',
  'E04.2': 'thyroid-nodule',
  // Hypothyroidism
  'E03': 'thyroid',
  'E06.3': 'thyroid', // Hashimoto's
  // Hyperthyroidism
  'E05': 'thyroid',
  'E05.0': 'thyroid', // Graves
  // Diabetes
  'E10': 'diabetes', // Type 1
  'E11': 'diabetes', // Type 2
  'E13': 'diabetes', // Other
  // Osteoporosis
  'M80': 'osteoporosis',
  'M81': 'osteoporosis',
  'M85.8': 'osteoporosis' // Osteopenia
};

/**
 * Select the primary dashboard based on diagnoses
 */
export function selectPrimaryDashboard(diagnoses: Diagnosis[]): DashboardType {
  // First try pattern matching on diagnosis text
  for (const { pattern, dashboard } of dashboardPatterns) {
    if (diagnoses.some(d => pattern.test(d.diagnosis))) {
      return dashboard;
    }
  }

  // Fallback to ICD-10 code matching
  for (const diagnosis of diagnoses) {
    if (diagnosis.icd10) {
      // Check exact match
      if (icd10Mapping[diagnosis.icd10]) {
        return icd10Mapping[diagnosis.icd10];
      }
      // Check prefix match (e.g., E10.9 matches E10)
      const prefix = diagnosis.icd10.split('.')[0];
      if (icd10Mapping[prefix]) {
        return icd10Mapping[prefix];
      }
    }
  }

  return 'general';
}

/**
 * Get all applicable dashboards for a patient (for tab selection)
 */
export function getApplicableDashboards(diagnoses: Diagnosis[]): Array<{ type: DashboardType; label: string }> {
  const applicable: Array<{ type: DashboardType; label: string }> = [];

  for (const { pattern, dashboard, label } of dashboardPatterns) {
    if (diagnoses.some(d => pattern.test(d.diagnosis))) {
      applicable.push({ type: dashboard, label });
    }
  }

  // Check ICD-10 codes for anything not caught by patterns
  for (const diagnosis of diagnoses) {
    if (diagnosis.icd10) {
      const prefix = diagnosis.icd10.split('.')[0];
      const dashboardType = icd10Mapping[diagnosis.icd10] || icd10Mapping[prefix];
      if (dashboardType && !applicable.some(a => a.type === dashboardType)) {
        const config = dashboardPatterns.find(p => p.dashboard === dashboardType);
        if (config) {
          applicable.push({ type: dashboardType, label: config.label });
        }
      }
    }
  }

  return applicable;
}

export default function DashboardSelector({
  patientId,
  diagnoses,
  patientData,
  onDashboardChange,
  className = ''
}: DashboardSelectorProps) {
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardType>('general');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Get applicable dashboards
  const applicableDashboards = getApplicableDashboards(diagnoses);

  // Auto-select primary dashboard on mount
  useEffect(() => {
    const primary = selectPrimaryDashboard(diagnoses);
    setSelectedDashboard(primary);
    if (onDashboardChange) {
      onDashboardChange(primary);
    }
  }, [diagnoses]);

  // Load dashboard-specific data
  useEffect(() => {
    if (selectedDashboard === 'general') {
      setIsLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(
          `${apiBase}/api/patient-chart/${patientId}/dashboard?type=${selectedDashboard}`
        );

        if (!response.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const result = await response.json();
        setDashboardData(result.data);
      } catch (err: any) {
        console.error('Dashboard data load error:', err);
        setError(err.message || 'Failed to load dashboard data');
        // Use patient data as fallback
        setDashboardData(transformPatientDataToDashboard(selectedDashboard, patientData));
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [patientId, selectedDashboard, patientData]);

  // Handle dashboard change
  const handleDashboardChange = (dashboard: DashboardType) => {
    setSelectedDashboard(dashboard);
    if (onDashboardChange) {
      onDashboardChange(dashboard);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <Loader className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  // Render error state
  if (error && !dashboardData) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <div>
            <h3 className="font-medium text-red-800">Failed to load dashboard</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Dashboard Selector Tabs (if multiple applicable) */}
      {applicableDashboards.length > 1 && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2">
          <LayoutDashboard className="w-5 h-5 text-gray-400 flex-shrink-0" />
          {applicableDashboards.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleDashboardChange(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDashboard === type
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Render Selected Dashboard */}
      {selectedDashboard === 'diabetes' && dashboardData && (
        <DiabetesDashboard data={dashboardData} />
      )}

      {selectedDashboard === 'thyroid' && dashboardData && (
        <ThyroidDashboard data={dashboardData} />
      )}

      {selectedDashboard === 'thyroid-cancer' && dashboardData && (
        <ThyroidCancerDashboard data={dashboardData} />
      )}

      {selectedDashboard === 'thyroid-nodule' && dashboardData && (
        <ThyroidNoduleDashboard data={dashboardData} />
      )}

      {selectedDashboard === 'osteoporosis' && dashboardData && (
        <OsteoporosisDashboard data={dashboardData} />
      )}

      {selectedDashboard === 'general' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <LayoutDashboard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">General Overview</h3>
          <p className="text-sm text-gray-500">
            No disease-specific dashboard available. Use the standard chart tabs.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Transform general patient data to dashboard format (fallback)
 */
function transformPatientDataToDashboard(dashboardType: DashboardType, patientData: any): any {
  if (!patientData) return null;

  // Extract common data
  const medications = patientData.medications || [];
  const labs = patientData.labs || [];
  const vitals = patientData.vitals || [];
  const conditions = patientData.conditions || patientData.problem_list || [];

  // Create default status
  const defaultData = {
    status: 'unknown' as const,
    headline: 'Review patient data for current status',
    statusChanges: [],
    lastVisitDate: patientData.last_visit_date,
    lastVisitChanges: [],
    watching: [],
    nextTriggers: []
  };

  switch (dashboardType) {
    case 'diabetes':
      return {
        ...defaultData,
        medications: transformMedicationsForDiabetes(medications),
        a1cHistory: extractA1CHistory(labs),
        cgmMetrics: {},
        complications: extractDiabetesComplications(conditions, labs),
        devices: {}
      };

    case 'thyroid':
      return {
        ...defaultData,
        diagnosisType: 'hypothyroid',
        labs: {
          tsh: extractTSHHistory(labs),
          freeT4: extractFT4History(labs),
          freeT3: extractFT3History(labs)
        },
        currentMedication: extractThyroidMedication(medications),
        medicationHistory: [],
        hypoSymptoms: [],
        hyperSymptoms: []
      };

    case 'thyroid-cancer':
      return {
        ...defaultData,
        cancerType: 'PTC',
        riskCategory: 'intermediate',
        surgeries: [],
        raiTreatments: [],
        thyroglobulin: extractThyroglobulinHistory(labs),
        thyroglobulinAntibody: [],
        tsh: extractTSHHistory(labs)
      };

    case 'thyroid-nodule':
      return {
        ...defaultData,
        nodules: [],
        fnaHistory: [],
        tsh: extractTSHHistory(labs)?.[0]
      };

    case 'osteoporosis':
      return {
        ...defaultData,
        diagnosis: 'osteoporosis',
        dexaScans: [],
        fractures: [],
        currentMedication: extractOsteoporosisMedication(medications),
        medicationHistory: [],
        primaryRiskFactors: [],
        vitaminD: extractVitaminD(labs),
        calcium: extractCalcium(labs)
      };

    default:
      return null;
  }
}

// Helper functions to extract data from patient record
function transformMedicationsForDiabetes(meds: any[]) {
  const categoryMap: Record<string, string> = {
    'metformin': 'oral',
    'glipizide': 'oral',
    'glyburide': 'oral',
    'sitagliptin': 'oral',
    'pioglitazone': 'oral',
    'insulin glargine': 'basal',
    'lantus': 'basal',
    'levemir': 'basal',
    'tresiba': 'basal',
    'insulin lispro': 'bolus',
    'humalog': 'bolus',
    'novolog': 'bolus',
    'ozempic': 'glp1',
    'wegovy': 'glp1',
    'mounjaro': 'glp1',
    'trulicity': 'glp1',
    'victoza': 'glp1',
    'jardiance': 'sglt2',
    'farxiga': 'sglt2',
    'invokana': 'sglt2'
  };

  return meds.map(med => {
    const name = (med.medication_name || med.name || '').toLowerCase();
    let category = 'other';
    for (const [key, cat] of Object.entries(categoryMap)) {
      if (name.includes(key)) {
        category = cat;
        break;
      }
    }
    return {
      name: med.medication_name || med.name,
      dosage: med.dosage || '',
      category
    };
  });
}

function extractA1CHistory(labs: any[]) {
  return labs
    .filter(l => /a1c|hba1c|hemoglobin a1c/i.test(l.test_name || l.name || ''))
    .map(l => ({
      value: parseFloat(l.value) || 0,
      date: l.date || l.collected_date
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function extractTSHHistory(labs: any[]) {
  return labs
    .filter(l => /^tsh$/i.test(l.test_name || l.name || ''))
    .map(l => ({
      value: parseFloat(l.value) || 0,
      unit: l.unit || 'mIU/L',
      date: l.date || l.collected_date,
      status: getTSHStatus(parseFloat(l.value))
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function extractFT4History(labs: any[]) {
  return labs
    .filter(l => /free\s*t4|ft4/i.test(l.test_name || l.name || ''))
    .map(l => ({
      value: parseFloat(l.value) || 0,
      unit: l.unit || 'ng/dL',
      date: l.date || l.collected_date,
      status: 'normal' as const
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function extractFT3History(labs: any[]) {
  return labs
    .filter(l => /free\s*t3|ft3/i.test(l.test_name || l.name || ''))
    .map(l => ({
      value: parseFloat(l.value) || 0,
      unit: l.unit || 'pg/mL',
      date: l.date || l.collected_date,
      status: 'normal' as const
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function extractThyroglobulinHistory(labs: any[]) {
  return labs
    .filter(l => /thyroglobulin/i.test(l.test_name || l.name || ''))
    .map(l => ({
      value: parseFloat(l.value) || 0,
      unit: l.unit || 'ng/mL',
      date: l.date || l.collected_date,
      status: parseFloat(l.value) < 0.2 ? 'undetectable' : 'normal' as any
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function extractThyroidMedication(meds: any[]) {
  const thyroidMed = meds.find(m =>
    /levothyroxine|synthroid|tirosint|armour|liothyronine|cytomel|methimazole|ptu/i
      .test(m.medication_name || m.name || '')
  );
  if (!thyroidMed) return undefined;
  return {
    name: thyroidMed.medication_name || thyroidMed.name,
    dose: thyroidMed.dosage || '',
    frequency: thyroidMed.frequency || 'once daily'
  };
}

function extractOsteoporosisMedication(meds: any[]) {
  const osteoMed = meds.find(m =>
    /alendronate|fosamax|risedronate|actonel|ibandronate|boniva|zoledronic|reclast|prolia|denosumab|forteo|teriparatide|tymlos|evenity/i
      .test(m.medication_name || m.name || '')
  );
  if (!osteoMed) return undefined;
  return {
    name: osteoMed.medication_name || osteoMed.name,
    startDate: osteoMed.start_date || '',
    status: 'active' as const
  };
}

function extractVitaminD(labs: any[]) {
  const vitD = labs.find(l => /vitamin\s*d|25.*hydroxy/i.test(l.test_name || l.name || ''));
  if (!vitD) return undefined;
  const value = parseFloat(vitD.value) || 0;
  return {
    value,
    status: value < 20 ? 'low' : value >= 40 ? 'optimal' : 'normal' as any
  };
}

function extractCalcium(labs: any[]) {
  const ca = labs.find(l => /^calcium$/i.test(l.test_name || l.name || ''));
  if (!ca) return undefined;
  const value = parseFloat(ca.value) || 0;
  return {
    value,
    status: value < 8.5 ? 'low' : value > 10.5 ? 'high' : 'normal' as any
  };
}

function extractDiabetesComplications(conditions: any[], labs: any[]) {
  return [
    { category: 'eyes', status: 'unknown', lastChecked: undefined },
    { category: 'kidneys', status: 'unknown', lastChecked: undefined },
    { category: 'neuropathy', status: 'unknown', lastChecked: undefined },
    { category: 'cardiovascular', status: 'unknown', lastChecked: undefined }
  ];
}

function getTSHStatus(value: number): 'low' | 'normal' | 'high' {
  if (value < 0.4) return 'low';
  if (value > 4.0) return 'high';
  return 'normal';
}
