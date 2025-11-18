/**
 * Quick Vital Entry Component
 * Super simple interface for patients to log vitals
 * Created: 2025-01-18
 */

import { useState } from 'react';
import { Activity, Droplet, Heart, Weight, Check, X, Mic } from 'lucide-react';

interface VitalEntry {
  bloodSugar?: number;
  weight?: number;
  systolic?: number;
  diastolic?: number;
  notes?: string;
}

interface QuickVitalEntryProps {
  onSave: (vitals: VitalEntry) => Promise<void>;
  onCancel: () => void;
  patientGoals?: {
    targetBloodSugar?: { min: number; max: number };
    targetWeight?: number;
    targetBP?: { systolic: number; diastolic: number };
  };
}

export default function QuickVitalEntry({ onSave, onCancel, patientGoals }: QuickVitalEntryProps) {
  const [vitals, setVitals] = useState<VitalEntry>({});
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (Object.keys(vitals).length === 0) {
      alert('Please enter at least one vital sign');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(vitals);
    } catch (error) {
      console.error('Error saving vitals:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getBloodSugarStatus = (value?: number) => {
    if (!value || !patientGoals?.targetBloodSugar) return 'gray';
    const { min, max } = patientGoals.targetBloodSugar;
    if (value < min) return 'yellow';
    if (value > max) return 'red';
    return 'green';
  };

  const getWeightStatus = (value?: number) => {
    if (!value || !patientGoals?.targetWeight) return 'gray';
    const diff = value - patientGoals.targetWeight;
    if (diff > 10) return 'red';
    if (diff > 5) return 'yellow';
    return 'green';
  };

  const getBPStatus = (systolic?: number, diastolic?: number) => {
    if (!systolic || !diastolic || !patientGoals?.targetBP) return 'gray';
    if (systolic > patientGoals.targetBP.systolic + 10 || diastolic > patientGoals.targetBP.diastolic + 10) return 'red';
    if (systolic > patientGoals.targetBP.systolic || diastolic > patientGoals.targetBP.diastolic) return 'yellow';
    return 'green';
  };

  const StatusIndicator = ({ status }: { status: string }) => {
    const colors = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      gray: 'bg-gray-300'
    };
    return <div className={`w-3 h-3 rounded-full ${colors[status as keyof typeof colors]}`} />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold">Log Your Vitals</h2>
          <p className="text-blue-100 text-sm mt-1">Quick entry - tap what you measured today</p>
        </div>

        {/* Vital Entry Cards */}
        <div className="p-6 space-y-4">
          {/* Blood Sugar */}
          <div className={`border-2 rounded-xl p-4 transition-all ${
            activeField === 'bloodSugar' ? 'border-red-500 bg-red-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Droplet className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Blood Sugar</h3>
                  <p className="text-xs text-gray-500">Fasting: 80-130 mg/dL</p>
                </div>
              </div>
              <StatusIndicator status={getBloodSugarStatus(vitals.bloodSugar)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={vitals.bloodSugar || ''}
                onChange={(e) => setVitals({ ...vitals, bloodSugar: parseFloat(e.target.value) })}
                onFocus={() => setActiveField('bloodSugar')}
                onBlur={() => setActiveField(null)}
                className="flex-1 text-3xl font-bold text-center border-2 border-gray-300 rounded-lg p-3 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                placeholder="120"
              />
              <span className="text-gray-600 font-medium">mg/dL</span>
            </div>
          </div>

          {/* Weight */}
          <div className={`border-2 rounded-xl p-4 transition-all ${
            activeField === 'weight' ? 'border-green-500 bg-green-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Weight className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Weight</h3>
                  <p className="text-xs text-gray-500">
                    {patientGoals?.targetWeight ? `Target: ${patientGoals.targetWeight} lbs` : 'Track your weight'}
                  </p>
                </div>
              </div>
              <StatusIndicator status={getWeightStatus(vitals.weight)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={vitals.weight || ''}
                onChange={(e) => setVitals({ ...vitals, weight: parseFloat(e.target.value) })}
                onFocus={() => setActiveField('weight')}
                onBlur={() => setActiveField(null)}
                className="flex-1 text-3xl font-bold text-center border-2 border-gray-300 rounded-lg p-3 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="170"
              />
              <span className="text-gray-600 font-medium">lbs</span>
            </div>
          </div>

          {/* Blood Pressure */}
          <div className={`border-2 rounded-xl p-4 transition-all ${
            activeField === 'bp' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Heart className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Blood Pressure</h3>
                  <p className="text-xs text-gray-500">Target: &lt;130/80 mmHg</p>
                </div>
              </div>
              <StatusIndicator status={getBPStatus(vitals.systolic, vitals.diastolic)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={vitals.systolic || ''}
                onChange={(e) => setVitals({ ...vitals, systolic: parseFloat(e.target.value) })}
                onFocus={() => setActiveField('bp')}
                onBlur={() => setActiveField(null)}
                className="flex-1 text-3xl font-bold text-center border-2 border-gray-300 rounded-lg p-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                placeholder="120"
              />
              <span className="text-2xl text-gray-600 font-bold">/</span>
              <input
                type="number"
                value={vitals.diastolic || ''}
                onChange={(e) => setVitals({ ...vitals, diastolic: parseFloat(e.target.value) })}
                onFocus={() => setActiveField('bp')}
                onBlur={() => setActiveField(null)}
                className="flex-1 text-3xl font-bold text-center border-2 border-gray-300 rounded-lg p-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                placeholder="80"
              />
              <span className="text-gray-600 font-medium text-sm">mmHg</span>
            </div>
          </div>

          {/* Notes (Optional) */}
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Notes (Optional)</h3>
            </div>
            <textarea
              value={vitals.notes || ''}
              onChange={(e) => setVitals({ ...vitals, notes: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
              rows={2}
              placeholder="How are you feeling? Any concerns?"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 inline-block mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || Object.keys(vitals).length === 0}
              className={`flex-1 py-3 px-4 font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                isSaving || Object.keys(vitals).length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700'
              }`}
            >
              <Check className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Vitals'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
