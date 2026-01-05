import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PreVisitData {
  id: string;
  ai_summary: string;
  chief_complaint: string;
  medication_changes: any[];
  abnormal_labs: any[];
  previous_notes: string;
  medications_list: string;
  lab_results: string;
  vitals: any;
  completed: boolean;
  completed_at: string;
}

interface Props {
  appointmentId: number;
}

export default function PreVisitSummary({ appointmentId }: Props) {
  const [previsitData, setPrevisitData] = useState<PreVisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadPreVisitData();
  }, [appointmentId]);

  const loadPreVisitData = async () => {
    try {
      const { data, error } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('completed', true)
        .single();

      if (error) {
        console.log('No pre-visit data found:', error);
        setPrevisitData(null);
      } else {
        setPrevisitData(data);
      }
    } catch (error) {
      console.error('Error loading pre-visit data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-blue-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-blue-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!previsitData) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-yellow-900">No Pre-Visit Data Available</h3>
            <p className="text-sm text-yellow-700">Staff has not completed pre-visit preparation for this appointment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg overflow-hidden mb-6 shadow-md">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 cursor-pointer hover:from-purple-700 hover:to-purple-800 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-xl font-bold">Pre-Visit Summary</h2>
              <p className="text-purple-100 text-sm">
                Prepared by staff • {new Date(previsitData.completed_at).toLocaleString()}
              </p>
            </div>
          </div>
          <button className="text-white text-2xl font-bold hover:scale-110 transition-transform">
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6 space-y-6">
          {/* AI Summary */}
          {previsitData.ai_summary && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>🤖</span> AI Clinical Summary
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {previsitData.ai_summary}
              </div>
            </div>
          )}

          {/* Chief Complaint */}
          {previsitData.chief_complaint && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>🩺</span> Chief Complaint
              </h3>
              <p className="text-gray-700">{previsitData.chief_complaint}</p>
            </div>
          )}

          {/* Grid: Medications & Labs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Medication Changes */}
            {previsitData.medication_changes && previsitData.medication_changes.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>💊</span> Medication Changes
                </h3>
                <div className="space-y-2">
                  {previsitData.medication_changes.map((med: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-orange-400 pl-3 py-1">
                      <p className="font-semibold text-gray-900">{med.medication}</p>
                      <p className="text-sm text-gray-600">{med.change}</p>
                      {med.reason && <p className="text-xs text-gray-500">{med.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Abnormal Labs */}
            {previsitData.abnormal_labs && previsitData.abnormal_labs.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>🧪</span> Abnormal Labs
                </h3>
                <div className="space-y-2">
                  {previsitData.abnormal_labs.map((lab: any, idx: number) => (
                    <div
                      key={idx}
                      className={`border-l-4 ${
                        lab.status === 'high' ? 'border-red-400' : 'border-blue-400'
                      } pl-3 py-1`}
                    >
                      <p className="font-semibold text-gray-900">
                        {lab.test}: {lab.value}
                      </p>
                      <p className="text-sm text-gray-600">{lab.significance}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Current Medications (Full List) */}
          {previsitData.medications_list && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>💊</span> Current Medications
              </h3>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded">
                {previsitData.medications_list}
              </pre>
            </div>
          )}

          {/* Vitals */}
          {previsitData.vitals && Object.keys(previsitData.vitals).some(k => previsitData.vitals[k]) && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>🩺</span> Today's Vitals
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {previsitData.vitals.bp && (
                  <div>
                    <p className="text-xs text-gray-600">Blood Pressure</p>
                    <p className="text-lg font-semibold">{previsitData.vitals.bp}</p>
                  </div>
                )}
                {previsitData.vitals.hr && (
                  <div>
                    <p className="text-xs text-gray-600">Heart Rate</p>
                    <p className="text-lg font-semibold">{previsitData.vitals.hr} bpm</p>
                  </div>
                )}
                {previsitData.vitals.temp && (
                  <div>
                    <p className="text-xs text-gray-600">Temperature</p>
                    <p className="text-lg font-semibold">{previsitData.vitals.temp}°F</p>
                  </div>
                )}
                {previsitData.vitals.weight && (
                  <div>
                    <p className="text-xs text-gray-600">Weight</p>
                    <p className="text-lg font-semibold">{previsitData.vitals.weight} lbs</p>
                  </div>
                )}
                {previsitData.vitals.height && (
                  <div>
                    <p className="text-xs text-gray-600">Height</p>
                    <p className="text-lg font-semibold">{previsitData.vitals.height} in</p>
                  </div>
                )}
                {previsitData.vitals.bmi && (
                  <div>
                    <p className="text-xs text-gray-600">BMI</p>
                    <p className="text-lg font-semibold">{previsitData.vitals.bmi}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lab Results (Full) */}
          {previsitData.lab_results && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>🧪</span> Recent Lab Results
              </h3>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded">
                {previsitData.lab_results}
              </pre>
            </div>
          )}

          {/* Collapse Button */}
          <div className="text-center pt-4 border-t">
            <button
              onClick={() => setExpanded(false)}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
            >
              ▲ Collapse Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
