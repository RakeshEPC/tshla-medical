'use client';
import React, { useState, useEffect } from 'react';
import {
  extractClinicalData,
  generateSmartPAPrompts,
  ClinicalData,
} from '@/lib/priorAuth/clinicalDataExtractor';
import { findMedication, priorAuthMedications } from '@/lib/priorAuth/medicationDatabase';
import { extractMedicationsFromTranscript } from '@/lib/priorAuth/paValidator';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface EnhancedPriorAuthProps {
  transcript: string;
  patientInfo: {
    email?: string;
    dob?: string;
  };
  isListening?: boolean;
  onDataExtracted?: (data: ClinicalData) => void;
}

export default function EnhancedPriorAuth({
  transcript,
  patientInfo,
  isListening = false,
  onDataExtracted,
}: EnhancedPriorAuthProps) {
  const [clinicalData, setClinicalData] = useState<ClinicalData>({});
  const [detectedMeds, setDetectedMeds] = useState<string[]>([]);
  const [selectedMed, setSelectedMed] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [missingPrompts, setMissingPrompts] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Extract clinical data in real-time as doctor dictates
  useEffect(() => {
    if (transcript && transcript.length > 50) {
      const extracted = extractClinicalData(transcript);
      setClinicalData(extracted);

      // Detect medications
      const meds = extractMedicationsFromTranscript(transcript);
      setDetectedMeds(meds);

      // Auto-expand if PA medication detected
      if (meds.length > 0 && !selectedMed) {
        setSelectedMed(meds[0]);
        setIsExpanded(true);
      }

      // Generate prompts for missing info
      if (selectedMed) {
        const prompts = generateSmartPAPrompts(extracted, selectedMed);
        setMissingPrompts(prompts);
      }

      if (onDataExtracted) {
        onDataExtracted(extracted);
      }
    }
  }, [transcript, selectedMed]);

  const handleQuickEdit = (field: keyof ClinicalData, value: any) => {
    setClinicalData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSavePA = async () => {
    // Save the PA data
    const paData = {
      medication: selectedMed,
      clinicalData,
      patientInfo,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/priorauth/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paData),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      logError('EnhancedPriorAuth', 'Error message', {});
    }
  };

  // Don't show if no PA meds detected
  if (detectedMeds.length === 0) {
    return null;
  }

  const medInfo = selectedMed ? findMedication(selectedMed) : null;

  return (
    <div
      className={`
      fixed top-20 right-4 w-96 z-50
      bg-white rounded-xl shadow-2xl border-2 
      ${isListening ? 'border-green-400 animate-pulse' : 'border-amber-400'}
      transition-all duration-300
      ${isExpanded ? 'max-h-[80vh]' : 'max-h-20'}
      overflow-hidden
    `}
    >
      {/* Header - Always Visible */}
      <div
        className="px-4 py-3 bg-gradient-to-r from-amber-100 to-orange-100 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-amber-900">Prior Auth Required</h3>
              <p className="text-xs text-amber-700">
                {detectedMeds.length} medication{detectedMeds.length > 1 ? 's' : ''} detected
              </p>
            </div>
          </div>
          <button className="text-amber-700 hover:text-amber-900">{isExpanded ? '▼' : '▲'}</button>
        </div>

        {/* Live Status Indicator */}
        {isListening && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-700">Extracting clinical data...</span>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-3 max-h-[calc(80vh-80px)] overflow-y-auto">
          {/* Medication Selector */}
          <div className="mb-3">
            <select
              value={selectedMed}
              onChange={e => setSelectedMed(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded"
            >
              {detectedMeds.map(med => (
                <option key={med} value={med}>
                  {med}
                </option>
              ))}
            </select>
          </div>

          {/* Extracted Clinical Data - Editable */}
          <div className="space-y-2 mb-3">
            <h4 className="font-semibold text-sm text-gray-700 flex items-center justify-between">
              Extracted Clinical Data
              <button
                onClick={() => setEditMode(!editMode)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
            </h4>

            <div className="bg-gray-50 rounded p-2 space-y-2 text-xs">
              {/* Primary Diagnosis */}
              <div className="flex items-center justify-between">
                <span className="font-medium">Primary Dx:</span>
                {editMode ? (
                  <input
                    type="text"
                    value={clinicalData.primaryDiagnosis || ''}
                    onChange={e => handleQuickEdit('primaryDiagnosis', e.target.value)}
                    className="px-1 py-0.5 border rounded text-xs flex-1 ml-2"
                  />
                ) : (
                  <span
                    className={clinicalData.primaryDiagnosis ? 'text-green-700' : 'text-red-500'}
                  >
                    {clinicalData.primaryDiagnosis || '❌ Missing'}
                  </span>
                )}
              </div>

              {/* ICD-10 */}
              <div className="flex items-center justify-between">
                <span className="font-medium">ICD-10:</span>
                {editMode ? (
                  <input
                    type="text"
                    value={clinicalData.icd10Codes?.join(', ') || ''}
                    onChange={e =>
                      handleQuickEdit(
                        'icd10Codes',
                        e.target.value.split(',').map(s => s.trim())
                      )
                    }
                    className="px-1 py-0.5 border rounded text-xs flex-1 ml-2"
                  />
                ) : (
                  <span
                    className={clinicalData.icd10Codes?.length ? 'text-green-700' : 'text-red-500'}
                  >
                    {clinicalData.icd10Codes?.join(', ') || '❌ Missing'}
                  </span>
                )}
              </div>

              {/* BMI */}
              <div className="flex items-center justify-between">
                <span className="font-medium">BMI:</span>
                {editMode ? (
                  <input
                    type="number"
                    value={clinicalData.bmi || ''}
                    onChange={e => handleQuickEdit('bmi', parseFloat(e.target.value))}
                    className="px-1 py-0.5 border rounded text-xs w-20"
                  />
                ) : (
                  <span className={clinicalData.bmi ? 'text-green-700' : 'text-gray-500'}>
                    {clinicalData.bmi || '—'}
                  </span>
                )}
              </div>

              {/* HbA1c */}
              <div className="flex items-center justify-between">
                <span className="font-medium">HbA1c:</span>
                {editMode ? (
                  <input
                    type="text"
                    value={clinicalData.hba1c || ''}
                    onChange={e => handleQuickEdit('hba1c', e.target.value)}
                    className="px-1 py-0.5 border rounded text-xs w-20"
                  />
                ) : (
                  <span className={clinicalData.hba1c ? 'text-green-700' : 'text-gray-500'}>
                    {clinicalData.hba1c || '—'}
                  </span>
                )}
              </div>

              {/* Prior Meds */}
              <div>
                <span className="font-medium">Prior Meds Tried:</span>
                {editMode ? (
                  <textarea
                    value={
                      clinicalData.priorMedications
                        ?.map(m => `${m.medication}: ${m.reason}`)
                        .join('\n') || ''
                    }
                    onChange={e => {
                      const meds = e.target.value.split('\n').map(line => {
                        const [med, reason] = line.split(':');
                        return { medication: med?.trim() || '', reason: reason?.trim() || '' };
                      });
                      handleQuickEdit('priorMedications', meds);
                    }}
                    className="w-full px-1 py-0.5 border rounded text-xs mt-1"
                    rows={2}
                  />
                ) : (
                  <div
                    className={`mt-1 ${clinicalData.priorMedications?.length ? 'text-green-700' : 'text-red-500'}`}
                  >
                    {clinicalData.priorMedications?.length ? (
                      <ul className="list-disc list-inside">
                        {clinicalData.priorMedications.map((med, idx) => (
                          <li key={idx}>
                            {med.medication}: {med.reason}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      '❌ Missing'
                    )}
                  </div>
                )}
              </div>

              {/* Clinical Justification */}
              <div>
                <span className="font-medium">Clinical Justification:</span>
                {editMode ? (
                  <textarea
                    value={clinicalData.clinicalJustification || ''}
                    onChange={e => handleQuickEdit('clinicalJustification', e.target.value)}
                    className="w-full px-1 py-0.5 border rounded text-xs mt-1"
                    rows={2}
                  />
                ) : (
                  <p
                    className={`mt-1 ${clinicalData.clinicalJustification ? 'text-green-700' : 'text-red-500'}`}
                  >
                    {clinicalData.clinicalJustification || '❌ Missing'}
                  </p>
                )}
              </div>

              {/* Lab Results */}
              {clinicalData.labResults && clinicalData.labResults.length > 0 && (
                <div>
                  <span className="font-medium">Labs:</span>
                  <ul className="mt-1 text-green-700">
                    {clinicalData.labResults.map((lab, idx) => (
                      <li key={idx}>
                        {lab.testName}: {lab.value} {lab.unit || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Missing Information Prompts */}
          {missingPrompts.length > 0 && (
            <div className="mb-3 p-2 bg-red-50 rounded">
              <h4 className="font-semibold text-xs text-red-800 mb-1">🎤 Ask Patient/Dictate:</h4>
              <ul className="space-y-1">
                {missingPrompts.map((prompt, idx) => (
                  <li key={idx} className="text-xs text-red-700">
                    • {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSavePA}
              className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Save PA Data
            </button>
            <button
              onClick={() => {
                const text = `
PRIOR AUTH: ${selectedMed}
Dx: ${clinicalData.primaryDiagnosis || 'TBD'}
ICD-10: ${clinicalData.icd10Codes?.join(', ') || 'TBD'}
BMI: ${clinicalData.bmi || 'TBD'}
HbA1c: ${clinicalData.hba1c || 'TBD'}
Prior Meds: ${clinicalData.priorMedications?.map(m => m.medication).join(', ') || 'TBD'}
Justification: ${clinicalData.clinicalJustification || 'TBD'}
                `.trim();
                navigator.clipboard.writeText(text);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Copy
            </button>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="mt-2 p-2 bg-green-100 text-green-700 text-xs rounded">
              ✓ PA data saved successfully!
            </div>
          )}

          {/* Medication Info */}
          {medInfo && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs text-gray-600">
                <p>
                  <strong>Success Rate:</strong> {medInfo.successRate}%
                </p>
                <p>
                  <strong>Typical Approval:</strong> {medInfo.averageApprovalTime}
                </p>
                <p>
                  <strong>Common ICD-10:</strong> {medInfo.commonICD10.join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
