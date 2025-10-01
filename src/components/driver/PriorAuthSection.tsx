'use client';
import React, { useState, useEffect } from 'react';
import { PriorAuthRequest, PriorAuthMedication, MissingField } from '@/types/priorAuth';
import { findMedication, priorAuthMedications } from '@/lib/priorAuth/medicationDatabase';
import {
  validatePriorAuth,
  extractMedicationsFromTranscript,
  generatePAPrompts,
} from '@/lib/priorAuth/paValidator';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface PriorAuthSectionProps {
  transcript: string;
  patientInfo: {
    email?: string;
    dob?: string;
  };
  onSubmitPA?: (request: PriorAuthRequest) => void;
}

export default function PriorAuthSection({
  transcript,
  patientInfo,
  onSubmitPA,
}: PriorAuthSectionProps) {
  const [detectedMeds, setDetectedMeds] = useState<string[]>([]);
  const [selectedMed, setSelectedMed] = useState<string>('');
  const [medInfo, setMedInfo] = useState<PriorAuthMedication | null>(null);
  const [paRequest, setPaRequest] = useState<Partial<PriorAuthRequest>>({});
  const [validation, setValidation] = useState<any>(null);
  const [showMissingInfo, setShowMissingInfo] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [labInputs, setLabInputs] = useState<Record<string, any>>({});

  // Detect medications from transcript
  useEffect(() => {
    if (transcript) {
      const meds = extractMedicationsFromTranscript(transcript);
      setDetectedMeds(meds);
      if (meds.length > 0 && !selectedMed) {
        setSelectedMed(meds[0]);
      }
    }
  }, [transcript]);

  // Load medication info when selected
  useEffect(() => {
    if (selectedMed) {
      const info = findMedication(selectedMed);
      setMedInfo(info || null);

      // Initialize PA request
      setPaRequest({
        id: `PA-${Date.now()}`,
        medication: selectedMed,
        status: 'pending',
        createdAt: new Date().toISOString(),
        urgency: 'routine',
      });
    }
  }, [selectedMed]);

  // Validate PA request
  useEffect(() => {
    if (paRequest.medication) {
      const result = validatePriorAuth(paRequest);
      setValidation(result);
      setShowMissingInfo(!result.isComplete);
    }
  }, [paRequest]);

  const handleLabInput = (labName: string, value: string, date: string) => {
    const labs = paRequest.labResults || [];
    const existingIndex = labs.findIndex(l => l.testName === labName);

    if (existingIndex >= 0) {
      labs[existingIndex] = { testName: labName, value, date };
    } else {
      labs.push({ testName: labName, value, date });
    }

    setPaRequest({ ...paRequest, labResults: labs });
  };

  const handleSubmit = async () => {
    if (!validation?.isComplete) {
      alert('Please complete all required fields before submitting');
      return;
    }

    const completeRequest: PriorAuthRequest = {
      ...(paRequest as PriorAuthRequest),
      patientId: patientInfo.email || 'unknown',
      attachments: [
        {
          type: 'note',
          fileName: 'clinical_note.txt',
          content: transcript,
        },
      ],
    };

    if (onSubmitPA) {
      onSubmitPA(completeRequest);
    }

    // Call API to submit PA
    try {
      const response = await fetch('/api/priorauth/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeRequest),
      });

      if (response.ok) {
        alert('Prior Authorization submitted successfully!');
      }
    } catch (error) {
      logError('PriorAuthSection', 'Error message', {});
    }
  };

  if (detectedMeds.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 p-6 bg-amber-50 rounded-xl border-2 border-amber-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
          ⚠️ Prior Authorization Required
        </h2>
        <span className="text-sm text-amber-700">
          {detectedMeds.length} medication{detectedMeds.length > 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Medication Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Medication for PA
        </label>
        <select
          value={selectedMed}
          onChange={e => setSelectedMed(e.target.value)}
          className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white"
        >
          {detectedMeds.map(med => (
            <option key={med} value={med}>
              {med}
            </option>
          ))}
        </select>
      </div>

      {medInfo && (
        <>
          {/* Medication Details */}
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-800">{medInfo.brandName}</h3>
                {medInfo.genericName && (
                  <p className="text-sm text-gray-600">({medInfo.genericName})</p>
                )}
                <div className="mt-2">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {medInfo.category}
                  </span>
                  <span className="text-xs ml-2 text-gray-600">
                    Approval: {medInfo.averageApprovalTime}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Success Rate</p>
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${medInfo.successRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{medInfo.successRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="bg-white rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-gray-800 mb-3">Typical Requirements</h4>
            <div className="space-y-2">
              {medInfo.typicalRequirements.map((req, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`req-${idx}`}
                    className="mt-0.5"
                    onChange={e => {
                      if (e.target.checked) {
                        setPaRequest({
                          ...paRequest,
                          clinicalJustification:
                            (paRequest.clinicalJustification || '') + '\n' + req,
                        });
                      }
                    }}
                  />
                  <label htmlFor={`req-${idx}`} className="text-sm text-gray-700">
                    {req}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Information Alert */}
          {showMissingInfo && validation && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-red-800 mb-2">❌ Missing Required Information</h4>
              <div className="space-y-3">
                {validation.missingFields
                  .filter((f: MissingField) => f.required)
                  .map((field: MissingField) => (
                    <div key={field.field} className="border-l-4 border-red-500 pl-3">
                      <p className="text-sm font-medium text-red-700">{field.description}</p>
                      <p className="text-xs text-red-600 mt-1">{field.prompt}</p>

                      {/* Input fields for missing data */}
                      {field.field === 'diagnosis' && (
                        <input
                          type="text"
                          placeholder="Enter diagnosis"
                          className="mt-2 w-full px-2 py-1 border rounded text-sm"
                          onChange={e =>
                            setPaRequest({
                              ...paRequest,
                              diagnosis: [e.target.value],
                            })
                          }
                        />
                      )}

                      {field.field === 'icd10Codes' && (
                        <div className="mt-2">
                          <select
                            className="w-full px-2 py-1 border rounded text-sm"
                            onChange={e =>
                              setPaRequest({
                                ...paRequest,
                                icd10Codes: [e.target.value],
                              })
                            }
                          >
                            <option value="">Select ICD-10 code</option>
                            {medInfo.commonICD10.map(code => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {field.field.startsWith('lab_') && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Lab value"
                            className="px-2 py-1 border rounded text-sm"
                            onChange={e =>
                              setLabInputs({
                                ...labInputs,
                                [field.field]: { ...labInputs[field.field], value: e.target.value },
                              })
                            }
                          />
                          <input
                            type="date"
                            className="px-2 py-1 border rounded text-sm"
                            onChange={e => {
                              const labName = field.description;
                              handleLabInput(
                                labName,
                                labInputs[field.field]?.value || '',
                                e.target.value
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Alternative Medications */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-800 mb-2">
              💡 Alternative Options (May not require PA)
            </h4>
            <div className="space-y-2">
              {medInfo.alternatives
                .filter(alt => !alt.priorAuthRequired)
                .map((alt, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{alt.name}</span>
                      {alt.generic && (
                        <span className="text-xs text-gray-600 ml-2">({alt.generic})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Tier {alt.tier}
                      </span>
                      {alt.notes && <span className="text-xs text-gray-600">{alt.notes}</span>}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Clinical Justification */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clinical Justification
            </label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Explain medical necessity and why alternatives are not suitable..."
              value={paRequest.clinicalJustification || ''}
              onChange={e =>
                setPaRequest({
                  ...paRequest,
                  clinicalJustification: e.target.value,
                })
              }
            />
          </div>

          {/* Tried Alternatives */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Previously Tried Medications
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="List medications tried and reasons for discontinuation..."
              value={(paRequest.triedAlternatives || []).join(', ')}
              onChange={e =>
                setPaRequest({
                  ...paRequest,
                  triedAlternatives: e.target.value.split(',').map(s => s.trim()),
                })
              }
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!validation?.isComplete}
              className={`px-4 py-2 rounded-lg font-semibold ${
                validation?.isComplete
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Submit PA Request
            </button>

            <button
              onClick={() => {
                const prompts = generatePAPrompts(selectedMed, transcript);
                alert('Additional information needed:\n\n' + prompts.join('\n\n'));
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Generate PA Questions
            </button>

            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              onClick={() => {
                // Download PA form template
                const formContent = `
PRIOR AUTHORIZATION REQUEST
========================
Date: ${new Date().toLocaleDateString()}
Patient: ${patientInfo.email}
DOB: ${patientInfo.dob}

MEDICATION: ${medInfo.brandName} (${medInfo.genericName || 'N/A'})
DIAGNOSIS: ${paRequest.diagnosis?.join(', ') || ''}
ICD-10: ${paRequest.icd10Codes?.join(', ') || ''}

CLINICAL JUSTIFICATION:
${paRequest.clinicalJustification || ''}

ALTERNATIVES TRIED:
${paRequest.triedAlternatives?.join(', ') || ''}

LAB RESULTS:
${paRequest.labResults?.map(l => `${l.testName}: ${l.value} (${l.date})`).join('\n') || ''}
                `.trim();

                const blob = new Blob([formContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `PA_${medInfo.brandName}_${Date.now()}.txt`;
                a.click();
              }}
            >
              Download PA Form
            </button>
          </div>

          {/* Suggestions */}
          {validation?.suggestions && validation.suggestions.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <h5 className="text-sm font-semibold text-yellow-800 mb-2">📋 Suggestions</h5>
              <ul className="text-xs text-yellow-700 space-y-1">
                {validation.suggestions.map((sug: string, idx: number) => (
                  <li key={idx}>• {sug}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
