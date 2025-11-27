/**
 * Reports Tab
 * Aggregated PCM reports and analytics
 */

import { PCMEnrollment } from '../../../types/pcm.database.types';

interface ReportsTabProps {
  enrollments: PCMEnrollment[];
}

export default function ReportsTab({ enrollments }: ReportsTabProps) {
  const highRisk = enrollments.filter(e => e.risk_level === 'high').length;
  const mediumRisk = enrollments.filter(e => e.risk_level === 'medium').length;
  const lowRisk = enrollments.filter(e => e.risk_level === 'low').length;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">PCM Program Overview</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-600">{highRisk}</div>
          <div className="text-sm text-red-900">High Risk</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-yellow-600">{mediumRisk}</div>
          <div className="text-sm text-yellow-900">Medium Risk</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600">{lowRisk}</div>
          <div className="text-sm text-green-900">Low Risk</div>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        Detailed reports coming soon...
      </div>
    </div>
  );
}
