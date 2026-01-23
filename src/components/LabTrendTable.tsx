/**
 * Lab Trend Table Component
 * Shows lab results in table format: test names in rows, dates in columns
 * Click lab name to graph progress over time
 * Priority labs at top: A1C, LDL, Urine Microalb/Crt, Serum Creatinine, TSH, Free T4
 * Created: 2026-01-23
 */

import { useState } from 'react';
import { TrendingUp, ChevronRight } from 'lucide-react';
import LabGraphModal from './LabGraphModal';

interface LabValue {
  value: number | string;
  date: string;
  unit: string;
}

interface LabTrendTableProps {
  labs: {
    [testName: string]: LabValue[];
  };
}

export default function LabTrendTable({ labs }: LabTrendTableProps) {
  const [selectedLab, setSelectedLab] = useState<string | null>(null);

  // Priority labs (show at top)
  const priorityLabs = [
    'A1C',
    'Hemoglobin A1C',
    'LDL',
    'LDL Cholesterol',
    'Urine Microalbumin/Creatinine Ratio',
    'Urine Microalb/Crt',
    'Serum Creatinine',
    'Creatinine',
    'TSH',
    'Free T4',
  ];

  // Normalize test name for comparison
  const normalizeTestName = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Check if a test is priority
  const isPriorityLab = (testName: string): boolean => {
    const normalized = normalizeTestName(testName);
    return priorityLabs.some((priority) => normalizeTestName(priority) === normalized);
  };

  // Sort labs: priority first, then alphabetical
  const sortedLabNames = Object.keys(labs).sort((a, b) => {
    const aPriority = isPriorityLab(a);
    const bPriority = isPriorityLab(b);

    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;
    return a.localeCompare(b);
  });

  if (sortedLabNames.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No lab results available</p>
        <p className="text-xs text-gray-400 mt-2">
          Lab results will appear here after your visits
        </p>
      </div>
    );
  }

  // Get all unique dates from all labs, sorted descending (newest first)
  const allDates = new Set<string>();
  Object.values(labs).forEach((labValues) => {
    labValues.forEach((lv) => allDates.add(lv.date));
  });
  const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Limit to most recent 5 dates for table view
  const displayDates = sortedDates.slice(0, 5);

  // Get value for specific test and date
  const getValueForDate = (testName: string, date: string): LabValue | null => {
    const labValues = labs[testName];
    return labValues.find((lv) => lv.date === date) || null;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format lab value with unit
  const formatValue = (labValue: LabValue | null): string => {
    if (!labValue) return '—';
    return `${labValue.value} ${labValue.unit}`;
  };

  // Determine if value is abnormal (basic heuristic - can be enhanced)
  const isAbnormal = (testName: string, value: number | string): boolean => {
    if (typeof value !== 'number') return false;

    const normalized = normalizeTestName(testName);

    // A1C
    if (normalized.includes('a1c') || normalized.includes('hemoglobina1c')) {
      return value > 7.0; // Target <7% for diabetes
    }

    // LDL
    if (normalized.includes('ldl')) {
      return value > 100; // Target <100 mg/dL
    }

    // TSH
    if (normalized.includes('tsh')) {
      return value < 0.4 || value > 4.0; // Normal range 0.4-4.0
    }

    // Creatinine
    if (normalized.includes('creatinine') && !normalized.includes('ratio')) {
      return value > 1.2; // Elevated if >1.2 mg/dL
    }

    return false;
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
        <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">Click any test name to see trend graph</p>
          <p className="text-xs text-blue-700 mt-1">
            Showing your most recent 5 results. View graph for full history.
          </p>
        </div>
      </div>

      {/* Lab Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-green-50">
              <th className="text-left p-4 font-semibold text-gray-900 border-b-2 border-gray-300 sticky left-0 bg-gradient-to-r from-blue-50 to-green-50 z-10">
                Lab Test
              </th>
              {displayDates.map((date) => (
                <th
                  key={date}
                  className="text-center p-4 font-semibold text-gray-900 border-b-2 border-gray-300 min-w-[120px]"
                >
                  {formatDate(date)}
                </th>
              ))}
              <th className="text-center p-4 font-semibold text-gray-900 border-b-2 border-gray-300">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLabNames.map((testName, idx) => {
              const isPriority = isPriorityLab(testName);
              const labValues = labs[testName];

              return (
                <tr
                  key={testName}
                  className={`${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-blue-50 transition-colors ${
                    isPriority ? 'font-medium' : ''
                  }`}
                >
                  {/* Test Name (clickable) */}
                  <td
                    className={`p-4 border-b border-gray-200 sticky left-0 z-10 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-blue-50`}
                  >
                    <button
                      onClick={() => setSelectedLab(testName)}
                      className="flex items-center space-x-2 text-left group"
                    >
                      <span
                        className={`${
                          isPriority ? 'text-blue-700 font-semibold' : 'text-gray-900'
                        } group-hover:text-blue-600`}
                      >
                        {testName}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                    </button>
                    {isPriority && (
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                        Priority
                      </span>
                    )}
                  </td>

                  {/* Values for each date */}
                  {displayDates.map((date) => {
                    const labValue = getValueForDate(testName, date);
                    const abnormal =
                      labValue && typeof labValue.value === 'number'
                        ? isAbnormal(testName, labValue.value)
                        : false;

                    return (
                      <td
                        key={date}
                        className={`text-center p-4 border-b border-gray-200 ${
                          abnormal ? 'bg-red-50' : ''
                        }`}
                      >
                        <span
                          className={`${
                            abnormal
                              ? 'text-red-700 font-semibold'
                              : labValue
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        >
                          {formatValue(labValue)}
                        </span>
                      </td>
                    );
                  })}

                  {/* Trend column (clickable) */}
                  <td className="text-center p-4 border-b border-gray-200">
                    <button
                      onClick={() => setSelectedLab(testName)}
                      className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      title="View trend graph"
                    >
                      <TrendingUp className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show message if more than 5 dates */}
      {sortedDates.length > 5 && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Showing 5 most recent results. Click{' '}
            <TrendingUp className="w-4 h-4 inline" /> to see full history.
          </p>
        </div>
      )}

      {/* Lab Graph Modal */}
      {selectedLab && (
        <LabGraphModal
          testName={selectedLab}
          labValues={labs[selectedLab]}
          onClose={() => setSelectedLab(null)}
        />
      )}
    </div>
  );
}
