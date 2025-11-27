/**
 * PCM Calls Tab
 * Kanban workflow for patient calls
 */

import { PCMEnrollment } from '../../../types/pcm.database.types';

interface PCMCallsTabProps {
  enrollments: PCMEnrollment[];
}

export default function PCMCallsTab({ enrollments }: PCMCallsTabProps) {
  return (
    <div>
      <p className="text-gray-600 mb-4">
        PCM Call workflow - {enrollments.length} active patients
      </p>
      {/* Reuse existing PCMStaffWorkflow component here */}
      <div className="text-sm text-gray-500">
        TODO: Import PCMStaffWorkflow component
      </div>
    </div>
  );
}
