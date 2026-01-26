/**
 * Staff Medication Refills Page
 * Full-page view for medication refill queue management
 * Created: 2026-01-26
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StaffMedicationRefills from '../components/StaffMedicationRefills';

export default function StaffMedicationRefillsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Medication Refills</h1>
                <p className="text-sm text-gray-600">Manage patient medication refill requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaffMedicationRefills />
      </div>
    </div>
  );
}
