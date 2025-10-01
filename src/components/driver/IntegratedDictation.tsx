'use client';
import React, { useState, useEffect } from 'react';
import { preVisitService } from '@/lib/supabase/previsit-service';
import SimpleDictation from './SimpleDictation';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface IntegratedDictationProps {
  patientId: string;
  visitDate: string;
  onSave: (text: string, data: any) => void;
}

export default function IntegratedDictation({
  patientId,
  visitDate,
  onSave,
}: IntegratedDictationProps) {
  const [compiledText, setCompiledText] = useState('');
  const [preVisitData, setPreVisitData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadAndCompileData();

    // Subscribe to real-time updates
    const unsubscribe = preVisitService.subscribeToVisitUpdates(
      patientId,
      visitDate,
      handleRealtimeUpdate
    );

    return () => {
      unsubscribe();
    };
  }, [patientId, visitDate]);

  const loadAndCompileData = async () => {
    setLoading(true);
    setSyncStatus('syncing');

    try {
      // Get compiled data from service
      const result = await preVisitService.getCompiledVisitData(patientId, visitDate);

      if (result.success) {
        setPreVisitData(result.data);
        setCompiledText(result.formattedText || '');
        setSyncStatus('synced');
        setLastUpdate(new Date());
      } else {
        logError('IntegratedDictation', 'Error message', {});
        setSyncStatus('error');
        // Fallback to basic template
        setCompiledText(getBasicTemplate());
      }
    } catch (error) {
      logError('IntegratedDictation', 'Error message', {});
      setSyncStatus('error');
      setCompiledText(getBasicTemplate());
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (update: any) => {
    logDebug('IntegratedDictation', 'Debug message', {});
    setSyncStatus('syncing');

    // Append update notification to the text
    const updateNotice = `\n[REAL-TIME UPDATE: ${update.type} data updated at ${new Date().toLocaleTimeString()}]\n`;
    setCompiledText(prev => prev + updateNotice);

    // Reload the full data
    loadAndCompileData();
  };

  const getBasicTemplate = () => {
    return `PATIENT ID: ${patientId}
DATE: ${visitDate}

CHIEF COMPLAINT:

SUBJECTIVE:

OBJECTIVE:

ASSESSMENT:

PLAN:
`;
  };

  const handleTextChange = (newText: string) => {
    setCompiledText(newText);
  };

  const handleSave = () => {
    onSave(compiledText, preVisitData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading and compiling pre-visit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync Status Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Integrated Visit Data</h3>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                syncStatus === 'synced'
                  ? 'bg-green-100 text-green-700'
                  : syncStatus === 'syncing'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-green-500'
                    : syncStatus === 'syncing'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                }`}
              ></div>
              <span>
                {syncStatus === 'synced'
                  ? 'All data synced'
                  : syncStatus === 'syncing'
                    ? 'Syncing...'
                    : 'Sync error'}
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {lastUpdate && <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* Pre-visit Data Summary */}
        {preVisitData?.currentVisit && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {/* Chief Complaints */}
            {preVisitData.currentVisit.previsitData?.chief_complaints?.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Chief Complaints</h4>
                <ul className="text-xs text-blue-700">
                  {preVisitData.currentVisit.previsitData.chief_complaints.map(
                    (cc: string, i: number) => (
                      <li key={i}>• {cc}</li>
                    )
                  )}
                </ul>
              </div>
            )}

            {/* Questionnaires */}
            {preVisitData.currentVisit.questionnaires?.length > 0 && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <h4 className="text-sm font-semibold text-purple-900 mb-1">Screenings</h4>
                {preVisitData.currentVisit.questionnaires.map((q: any, i: number) => (
                  <div key={i} className="text-xs text-purple-700">
                    <span className="font-semibold">{q.questionnaire_type}:</span> {q.score} (
                    {q.severity})
                  </div>
                ))}
              </div>
            )}

            {/* Completion Status */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Pre-visit Status</h4>
              <div className="text-xs text-gray-700">
                <p>
                  Status:{' '}
                  {preVisitData.currentVisit.previsitData?.completion_status || 'Not started'}
                </p>
                {preVisitData.currentVisit.previsitData?.completed_at && (
                  <p>
                    Completed:{' '}
                    {new Date(preVisitData.currentVisit.previsitData.completed_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dictation Component with Pre-populated Data */}
      <SimpleDictation initialText={compiledText} onTextChange={handleTextChange} />

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Save Integrated Note
        </button>
      </div>

      {/* Real-time Updates Log */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 Real-time Integration</h4>
        <p className="text-xs text-gray-600">
          This dictation automatically updates when the patient submits new pre-visit information.
          Any questionnaires, symptoms, or requests submitted through the patient portal will appear
          here instantly.
        </p>
      </div>
    </div>
  );
}
