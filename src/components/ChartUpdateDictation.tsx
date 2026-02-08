/**
 * Chart Update Dictation Component
 *
 * Voice-powered chart updates with AI extraction.
 * Staff dictates clinical updates (meds, labs, vitals, etc.)
 * and AI extracts structured data for review before applying to chart.
 */

import { useState, useEffect, useCallback } from 'react';
import { speechServiceRouter } from '../services/speechServiceRouter.service';
import { logError, logInfo } from '../services/logger.service';
import {
  Mic, MicOff, Loader, Check, AlertCircle, X,
  Pill, Thermometer, TestTube, AlertTriangle,
  Users, Stethoscope, ChevronDown, ChevronUp
} from 'lucide-react';

// Types for extracted data
interface MedicationUpdate {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  status?: 'active' | 'discontinued' | 'prior';
  rxnorm_code?: string;
  completeness: number;
  missingFields: string[];
}

interface LabUpdate {
  test_name: string;
  value: number | string;
  unit?: string;
  date?: string;
  date_inferred?: boolean;
  loinc_code?: string;
  completeness: number;
  missingFields: string[];
}

interface VitalUpdate {
  type: string;
  value: number | string;
  systolic?: number;
  diastolic?: number;
  unit?: string;
  date?: string;
  completeness: number;
}

interface ConditionUpdate {
  condition: string;
  icd10?: string;
  status?: 'active' | 'resolved' | 'chronic';
}

interface AllergyUpdate {
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
}

interface FamilyHistoryUpdate {
  condition: string;
  relative: string;
  age_of_onset?: string;
}

interface ChartUpdateResult {
  medications: MedicationUpdate[];
  labs: LabUpdate[];
  vitals: VitalUpdate[];
  conditions: ConditionUpdate[];
  allergies: AllergyUpdate[];
  familyHistory: FamilyHistoryUpdate[];
  socialHistory: any;
  rawTranscript: string;
  processingTimeMs: number;
  overallCompleteness: number;
  itemsNeedingReview: number;
}

interface MergeDecision {
  action: 'add' | 'update' | 'skip';
  reason: string;
  existingId?: string;
  matchScore?: number;
}

interface MergeResult {
  medication?: MedicationUpdate;
  lab?: LabUpdate;
  vital?: VitalUpdate;
  decision: MergeDecision;
  enrichedData?: {
    rxnorm_code?: string;
    loinc_code?: string;
    normalized_name?: string;
  };
}

interface ChartMergeResult {
  medications: MergeResult[];
  labs: MergeResult[];
  vitals: MergeResult[];
  summary: {
    medicationsToAdd: number;
    medicationsToUpdate: number;
    medicationsSkipped: number;
    labsToAdd: number;
    labsToUpdate: number;
    labsSkipped: number;
    vitalsToAdd: number;
    vitalsToUpdate: number;
    vitalsSkipped: number;
  };
}

interface ChartUpdateDictationProps {
  patientId: string;
  patientName?: string;
  tshlaId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export default function ChartUpdateDictation({
  patientId,
  patientName,
  tshlaId,
  isOpen,
  onClose,
  onSuccess
}: ChartUpdateDictationProps) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingError, setRecordingError] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string>('');

  // Extracted data
  const [extractedData, setExtractedData] = useState<ChartUpdateResult | null>(null);
  const [mergeResult, setMergeResult] = useState<ChartMergeResult | null>(null);

  // UI state
  const [step, setStep] = useState<'record' | 'preview' | 'applying'>('record');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    medications: true,
    labs: true,
    vitals: true,
    conditions: false,
    allergies: false,
    history: false
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimText('');
      setExtractedData(null);
      setMergeResult(null);
      setStep('record');
      setRecordingError('');
      setProcessingError('');
    }
  }, [isOpen]);

  // Start voice recording
  const startRecording = async () => {
    setRecordingError('');

    try {
      const callbacks = {
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            setTranscript(prev => prev + ' ' + text);
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        onError: (error: string) => {
          setRecordingError(error);
        },
        onEnd: () => {
          setIsRecording(false);
        }
      };

      const success = await speechServiceRouter.startRecording('dictation', callbacks);

      if (success) {
        setIsRecording(true);
        logInfo('ChartUpdateDictation', 'Recording started');
      } else {
        throw new Error('Failed to start recording');
      }
    } catch (error) {
      logError('ChartUpdateDictation', 'Failed to start recording', { error });
      setRecordingError('Failed to start recording. Please check your microphone.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    try {
      speechServiceRouter.stopRecording();
      setIsRecording(false);
      setInterimText('');
      logInfo('ChartUpdateDictation', 'Recording stopped');
    } catch (error) {
      logError('ChartUpdateDictation', 'Error stopping recording', { error });
      setIsRecording(false);
    }
  };

  // Process transcript with AI
  const processTranscript = async () => {
    if (!transcript.trim()) {
      setRecordingError('No transcript to process. Please record some audio first.');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      const response = await fetch(`${apiBase}/api/chart-update/process-and-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          patientId,
          tshlaId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process transcript');
      }

      const result = await response.json();

      if (result.success) {
        setExtractedData(result.data.extracted);
        setMergeResult(result.data.merge);
        setStep('preview');
        logInfo('ChartUpdateDictation', 'Transcript processed successfully', {
          medications: result.data.extracted.medications.length,
          labs: result.data.extracted.labs.length,
          vitals: result.data.extracted.vitals.length
        });
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error: any) {
      logError('ChartUpdateDictation', 'Processing failed', { error: error.message });
      setProcessingError(error.message || 'Failed to process transcript');
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply approved changes
  const applyChanges = async () => {
    if (!mergeResult) return;

    setStep('applying');
    setProcessingError('');

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      const response = await fetch(`${apiBase}/api/chart-update/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mergeResult,
          patientId,
          tshlaId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply changes');
      }

      const result = await response.json();

      if (result.success || result.applied > 0) {
        logInfo('ChartUpdateDictation', 'Changes applied successfully', {
          applied: result.applied
        });

        if (onSuccess) {
          onSuccess(result);
        }
        onClose();
      } else {
        throw new Error(result.errors?.join(', ') || 'No changes applied');
      }

    } catch (error: any) {
      logError('ChartUpdateDictation', 'Apply failed', { error: error.message });
      setProcessingError(error.message || 'Failed to apply changes');
      setStep('preview');
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get completeness badge color
  const getCompletenessBadgeColor = (completeness: number) => {
    if (completeness >= 100) return 'bg-green-100 text-green-800';
    if (completeness >= 67) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Get action badge color
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'add': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'skip': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Update Chart</h2>
            {patientName && (
              <p className="text-purple-100 text-sm">{patientName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Record */}
          {step === 'record' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-800 mb-2">How to use</h3>
                <p className="text-sm text-purple-700">
                  Click record and speak your chart updates naturally. For example:
                </p>
                <ul className="text-sm text-purple-700 mt-2 ml-4 list-disc space-y-1">
                  <li>"Meds: Metformin 500mg twice daily, Lisinopril 10mg once daily"</li>
                  <li>"Blood pressure 128 over 82, weight 185 pounds"</li>
                  <li>"A1C came back at 7.2 percent from last week"</li>
                  <li>"Discontinue the aspirin"</li>
                </ul>
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col items-center space-y-4">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isRecording ? (
                    <MicOff className="w-8 h-8 text-white" />
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </button>
                <p className="text-sm text-gray-600">
                  {isRecording ? 'Click to stop recording' : 'Click to start recording'}
                </p>
              </div>

              {/* Error Display */}
              {recordingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{recordingError}</p>
                </div>
              )}

              {/* Transcript Display */}
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Transcript</h4>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {transcript || <span className="text-gray-400 italic">Your spoken words will appear here...</span>}
                  {interimText && (
                    <span className="text-gray-400 italic"> {interimText}</span>
                  )}
                </p>
              </div>

              {/* Process Button */}
              {transcript.trim() && !isRecording && (
                <button
                  onClick={processTranscript}
                  disabled={isProcessing}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Process & Preview
                    </>
                  )}
                </button>
              )}

              {processingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{processingError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && extractedData && mergeResult && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-purple-800">Extraction Summary</h3>
                    <p className="text-sm text-purple-600">
                      {mergeResult.summary.medicationsToAdd + mergeResult.summary.medicationsToUpdate} medications, {' '}
                      {mergeResult.summary.labsToAdd + mergeResult.summary.labsToUpdate} labs, {' '}
                      {mergeResult.summary.vitalsToAdd + mergeResult.summary.vitalsToUpdate} vitals
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getCompletenessBadgeColor(extractedData.overallCompleteness)}`}>
                    {extractedData.overallCompleteness}% complete
                  </div>
                </div>
                {extractedData.itemsNeedingReview > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">{extractedData.itemsNeedingReview} items need review (missing fields)</span>
                  </div>
                )}
              </div>

              {/* Medications Section */}
              {mergeResult.medications.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('medications')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Pill className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">Medications ({mergeResult.medications.length})</span>
                    </div>
                    {expandedSections.medications ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.medications && (
                    <div className="divide-y">
                      {mergeResult.medications.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.enrichedData?.normalized_name || item.medication?.name}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(item.decision.action)}`}>
                                {item.decision.action}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {item.medication?.dosage && <span>{item.medication.dosage}</span>}
                              {item.medication?.frequency && <span> • {item.medication.frequency}</span>}
                              {item.medication?.route && <span> • {item.medication.route}</span>}
                            </div>
                            {item.medication?.missingFields && item.medication.missingFields.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-amber-600">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="text-xs">Missing: {item.medication.missingFields.join(', ')}</span>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">{item.decision.reason}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs ${getCompletenessBadgeColor(item.medication?.completeness || 0)}`}>
                            {item.medication?.completeness || 0}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Labs Section */}
              {mergeResult.labs.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('labs')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TestTube className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Labs ({mergeResult.labs.length})</span>
                    </div>
                    {expandedSections.labs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.labs && (
                    <div className="divide-y">
                      {mergeResult.labs.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.enrichedData?.normalized_name || item.lab?.test_name}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(item.decision.action)}`}>
                                {item.decision.action}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium text-gray-800">{item.lab?.value}</span>
                              {item.lab?.unit && <span> {item.lab.unit}</span>}
                              {item.lab?.date && <span> • {item.lab.date}</span>}
                              {item.lab?.date_inferred && (
                                <span className="text-amber-600 text-xs ml-1">(date inferred)</span>
                              )}
                            </div>
                            {item.enrichedData?.loinc_code && (
                              <span className="text-xs text-gray-500">LOINC: {item.enrichedData.loinc_code}</span>
                            )}
                            <p className="text-xs text-gray-500 mt-1">{item.decision.reason}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs ${getCompletenessBadgeColor(item.lab?.completeness || 0)}`}>
                            {item.lab?.completeness || 0}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Vitals Section */}
              {mergeResult.vitals.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('vitals')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Thermometer className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Vitals ({mergeResult.vitals.length})</span>
                    </div>
                    {expandedSections.vitals ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.vitals && (
                    <div className="divide-y">
                      {mergeResult.vitals.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.vital?.type}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(item.decision.action)}`}>
                                {item.decision.action}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {item.vital?.systolic !== undefined ? (
                                <span className="font-medium text-gray-800">{item.vital.systolic}/{item.vital.diastolic}</span>
                              ) : (
                                <span className="font-medium text-gray-800">{item.vital?.value}</span>
                              )}
                              {item.vital?.unit && <span> {item.vital.unit}</span>}
                              {item.vital?.date && <span> • {item.vital.date}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{item.decision.reason}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs ${getCompletenessBadgeColor(item.vital?.completeness || 100)}`}>
                            {item.vital?.completeness || 100}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conditions, Allergies, History (collapsed by default) */}
              {extractedData.conditions.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('conditions')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Stethoscope className="w-5 h-5 text-rose-600" />
                      <span className="font-medium">Conditions ({extractedData.conditions.length})</span>
                    </div>
                    {expandedSections.conditions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.conditions && (
                    <div className="p-4 space-y-2">
                      {extractedData.conditions.map((condition, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span>{condition.condition}</span>
                          {condition.status && (
                            <span className="text-xs text-gray-500">({condition.status})</span>
                          )}
                          {condition.icd10 && (
                            <span className="text-xs text-gray-400">ICD-10: {condition.icd10}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {extractedData.allergies.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('allergies')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">Allergies ({extractedData.allergies.length})</span>
                    </div>
                    {expandedSections.allergies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.allergies && (
                    <div className="p-4 space-y-2">
                      {extractedData.allergies.map((allergy, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-medium">{allergy.allergen}</span>
                          {allergy.reaction && <span className="text-sm text-gray-600">- {allergy.reaction}</span>}
                          {allergy.severity && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              allergy.severity === 'severe' ? 'bg-red-100 text-red-700' :
                              allergy.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {allergy.severity}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {extractedData.familyHistory.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('history')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <span className="font-medium">Family History ({extractedData.familyHistory.length})</span>
                    </div>
                    {expandedSections.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.history && (
                    <div className="p-4 space-y-2">
                      {extractedData.familyHistory.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-medium">{item.condition}</span>
                          <span className="text-sm text-gray-600">- {item.relative}</span>
                          {item.age_of_onset && <span className="text-xs text-gray-500">({item.age_of_onset})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Raw Transcript (collapsible) */}
              <details className="border rounded-lg">
                <summary className="p-4 cursor-pointer text-sm text-gray-600 hover:bg-gray-50">
                  View raw transcript
                </summary>
                <div className="p-4 pt-0 text-sm text-gray-700 bg-gray-50">
                  {extractedData.rawTranscript}
                </div>
              </details>

              {/* Error Display */}
              {processingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{processingError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Applying */}
          {step === 'applying' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-800">Applying changes...</p>
              <p className="text-sm text-gray-600">Updating patient chart</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between">
          {step === 'record' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <div></div>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => {
                  setStep('record');
                  setExtractedData(null);
                  setMergeResult(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                ← Back to Recording
              </button>
              <button
                onClick={applyChanges}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                Apply to Chart
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
