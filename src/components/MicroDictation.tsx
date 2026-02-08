/**
 * Micro-Dictation Component
 *
 * Enhanced dictation with pause/review capability.
 * Allows staff to pause recording, review AI extractions,
 * approve/edit data, then continue or finalize.
 */

import { useState, useCallback, useRef } from 'react';
import { speechServiceRouter } from '../services/speechServiceRouter.service';
import { logError, logInfo } from '../services/logger.service';
import DictationReviewPanel from './DictationReviewPanel';
import {
  Mic, MicOff, Pause, Play, Check, X,
  Loader, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, Save, Volume2
} from 'lucide-react';

// Types
export interface ExtractedMedication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  status?: 'active' | 'discontinued' | 'prior';
  rxnorm_code?: string;
  completeness: number;
  missingFields: string[];
  approved: boolean;
}

export interface ExtractedLab {
  id: string;
  test_name: string;
  value: number | string;
  unit?: string;
  date?: string;
  date_inferred?: boolean;
  loinc_code?: string;
  completeness: number;
  missingFields: string[];
  approved: boolean;
}

export interface ExtractedVital {
  id: string;
  type: string;
  value: number | string;
  systolic?: number;
  diastolic?: number;
  unit?: string;
  date?: string;
  completeness: number;
  approved: boolean;
}

export interface ExtractedCondition {
  id: string;
  condition: string;
  icd10?: string;
  status?: 'active' | 'resolved' | 'chronic';
  approved: boolean;
}

export interface ExtractedAllergy {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  approved: boolean;
}

export interface ExtractionResult {
  medications: ExtractedMedication[];
  labs: ExtractedLab[];
  vitals: ExtractedVital[];
  conditions: ExtractedCondition[];
  allergies: ExtractedAllergy[];
  overallCompleteness: number;
  itemsNeedingReview: number;
}

export interface MicroDictationState {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  fullTranscript: string;
  currentSegment: string;
  interimText: string;
  accumulatedExtractions: ExtractionResult;
  pendingReview: ExtractionResult | null;
  segmentCount: number;
}

interface MicroDictationProps {
  patientId?: string;
  patientName?: string;
  tshlaId?: string;
  onFinalSubmit?: (data: ExtractionResult, transcript: string) => void;
  onCancel?: () => void;
  className?: string;
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Initial empty extraction result
const emptyExtractionResult: ExtractionResult = {
  medications: [],
  labs: [],
  vitals: [],
  conditions: [],
  allergies: [],
  overallCompleteness: 100,
  itemsNeedingReview: 0
};

export default function MicroDictation({
  patientId,
  patientName,
  tshlaId,
  onFinalSubmit,
  onCancel,
  className = ''
}: MicroDictationProps) {
  // State
  const [state, setState] = useState<MicroDictationState>({
    isRecording: false,
    isPaused: false,
    isProcessing: false,
    fullTranscript: '',
    currentSegment: '',
    interimText: '',
    accumulatedExtractions: emptyExtractionResult,
    pendingReview: null,
    segmentCount: 0
  });

  const [error, setError] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Refs
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Start recording
  const startRecording = async () => {
    setError('');

    try {
      const callbacks = {
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            setState(prev => ({
              ...prev,
              currentSegment: prev.currentSegment + ' ' + text,
              interimText: ''
            }));
          } else {
            setState(prev => ({ ...prev, interimText: text }));
          }
        },
        onError: (error: string) => {
          setError(error);
        },
        onEnd: () => {
          setState(prev => ({ ...prev, isRecording: false }));
        }
      };

      const success = await speechServiceRouter.startRecording('dictation', callbacks);

      if (success) {
        setState(prev => ({
          ...prev,
          isRecording: true,
          isPaused: false
        }));

        // Start duration timer
        durationInterval.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);

        logInfo('MicroDictation', 'Recording started');
      } else {
        throw new Error('Failed to start recording');
      }
    } catch (err) {
      logError('MicroDictation', 'Failed to start recording', { error: err });
      setError('Failed to start recording. Please check your microphone.');
    }
  };

  // Pause recording and process current segment
  const pauseAndReview = async () => {
    try {
      // Stop recording
      speechServiceRouter.stopRecording();

      // Stop duration timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: true,
        isProcessing: true,
        interimText: ''
      }));

      logInfo('MicroDictation', 'Paused for review, processing segment');

      // Process current segment with AI
      const segmentText = state.currentSegment.trim();

      if (segmentText) {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

        const response = await fetch(`${apiBase}/api/chart-update/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: segmentText,
            patientId,
            tshlaId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to process segment');
        }

        const result = await response.json();

        if (result.success) {
          // Add IDs and approved=false to extracted items
          const pendingReview: ExtractionResult = {
            medications: (result.data.medications || []).map((m: any) => ({
              ...m,
              id: generateId(),
              approved: false
            })),
            labs: (result.data.labs || []).map((l: any) => ({
              ...l,
              id: generateId(),
              approved: false
            })),
            vitals: (result.data.vitals || []).map((v: any) => ({
              ...v,
              id: generateId(),
              approved: false
            })),
            conditions: (result.data.conditions || []).map((c: any) => ({
              ...c,
              id: generateId(),
              approved: false
            })),
            allergies: (result.data.allergies || []).map((a: any) => ({
              ...a,
              id: generateId(),
              approved: false
            })),
            overallCompleteness: result.data.overallCompleteness || 100,
            itemsNeedingReview: result.data.itemsNeedingReview || 0
          };

          setState(prev => ({
            ...prev,
            pendingReview,
            isProcessing: false
          }));

          logInfo('MicroDictation', 'Segment processed', {
            medications: pendingReview.medications.length,
            labs: pendingReview.labs.length,
            vitals: pendingReview.vitals.length
          });
        }
      } else {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          pendingReview: emptyExtractionResult
        }));
      }

    } catch (err: any) {
      logError('MicroDictation', 'Failed to process segment', { error: err.message });
      setError('Failed to process audio. Please try again.');
      setState(prev => ({
        ...prev,
        isProcessing: false
      }));
    }
  };

  // Approve pending review and continue
  const approveAndContinue = useCallback(() => {
    if (!state.pendingReview) return;

    // Merge approved items into accumulated extractions
    const approved = state.pendingReview;

    setState(prev => {
      const accumulated = prev.accumulatedExtractions;

      return {
        ...prev,
        accumulatedExtractions: {
          medications: [
            ...accumulated.medications,
            ...approved.medications.filter(m => m.approved).map(m => ({ ...m }))
          ],
          labs: [
            ...accumulated.labs,
            ...approved.labs.filter(l => l.approved).map(l => ({ ...l }))
          ],
          vitals: [
            ...accumulated.vitals,
            ...approved.vitals.filter(v => v.approved).map(v => ({ ...v }))
          ],
          conditions: [
            ...accumulated.conditions,
            ...approved.conditions.filter(c => c.approved).map(c => ({ ...c }))
          ],
          allergies: [
            ...accumulated.allergies,
            ...approved.allergies.filter(a => a.approved).map(a => ({ ...a }))
          ],
          overallCompleteness: Math.round(
            (accumulated.overallCompleteness + approved.overallCompleteness) / 2
          ),
          itemsNeedingReview: accumulated.itemsNeedingReview + approved.itemsNeedingReview
        },
        fullTranscript: prev.fullTranscript + ' ' + prev.currentSegment,
        currentSegment: '',
        pendingReview: null,
        isPaused: false,
        segmentCount: prev.segmentCount + 1
      };
    });

    // Start recording again
    startRecording();
  }, [state.pendingReview]);

  // Skip review and continue
  const skipAndContinue = () => {
    setState(prev => ({
      ...prev,
      fullTranscript: prev.fullTranscript + ' ' + prev.currentSegment,
      currentSegment: '',
      pendingReview: null,
      isPaused: false,
      segmentCount: prev.segmentCount + 1
    }));

    startRecording();
  };

  // Update item approval status
  const updateItemApproval = useCallback((
    type: 'medications' | 'labs' | 'vitals' | 'conditions' | 'allergies',
    id: string,
    approved: boolean
  ) => {
    setState(prev => {
      if (!prev.pendingReview) return prev;

      return {
        ...prev,
        pendingReview: {
          ...prev.pendingReview,
          [type]: prev.pendingReview[type].map((item: any) =>
            item.id === id ? { ...item, approved } : item
          )
        }
      };
    });
  }, []);

  // Approve all pending items
  const approveAll = useCallback(() => {
    setState(prev => {
      if (!prev.pendingReview) return prev;

      return {
        ...prev,
        pendingReview: {
          ...prev.pendingReview,
          medications: prev.pendingReview.medications.map(m => ({ ...m, approved: true })),
          labs: prev.pendingReview.labs.map(l => ({ ...l, approved: true })),
          vitals: prev.pendingReview.vitals.map(v => ({ ...v, approved: true })),
          conditions: prev.pendingReview.conditions.map(c => ({ ...c, approved: true })),
          allergies: prev.pendingReview.allergies.map(a => ({ ...a, approved: true }))
        }
      };
    });
  }, []);

  // Stop and finalize
  const stopAndFinalize = async () => {
    // Stop recording if active
    if (state.isRecording) {
      speechServiceRouter.stopRecording();
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: true,
      isProcessing: true
    }));

    // Process final segment if any
    const segmentText = state.currentSegment.trim();

    if (segmentText) {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

        const response = await fetch(`${apiBase}/api/chart-update/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: segmentText,
            patientId,
            tshlaId
          })
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success) {
            const finalExtraction: ExtractionResult = {
              medications: (result.data.medications || []).map((m: any) => ({
                ...m,
                id: generateId(),
                approved: true // Auto-approve for final review
              })),
              labs: (result.data.labs || []).map((l: any) => ({
                ...l,
                id: generateId(),
                approved: true
              })),
              vitals: (result.data.vitals || []).map((v: any) => ({
                ...v,
                id: generateId(),
                approved: true
              })),
              conditions: (result.data.conditions || []).map((c: any) => ({
                ...c,
                id: generateId(),
                approved: true
              })),
              allergies: (result.data.allergies || []).map((a: any) => ({
                ...a,
                id: generateId(),
                approved: true
              })),
              overallCompleteness: result.data.overallCompleteness || 100,
              itemsNeedingReview: result.data.itemsNeedingReview || 0
            };

            // Merge with accumulated
            setState(prev => ({
              ...prev,
              accumulatedExtractions: {
                medications: [...prev.accumulatedExtractions.medications, ...finalExtraction.medications],
                labs: [...prev.accumulatedExtractions.labs, ...finalExtraction.labs],
                vitals: [...prev.accumulatedExtractions.vitals, ...finalExtraction.vitals],
                conditions: [...prev.accumulatedExtractions.conditions, ...finalExtraction.conditions],
                allergies: [...prev.accumulatedExtractions.allergies, ...finalExtraction.allergies],
                overallCompleteness: Math.round(
                  (prev.accumulatedExtractions.overallCompleteness + finalExtraction.overallCompleteness) / 2
                ),
                itemsNeedingReview: prev.accumulatedExtractions.itemsNeedingReview + finalExtraction.itemsNeedingReview
              },
              fullTranscript: prev.fullTranscript + ' ' + prev.currentSegment,
              currentSegment: '',
              isProcessing: false,
              pendingReview: null
            }));
          }
        }
      } catch (err) {
        logError('MicroDictation', 'Failed to process final segment', { error: err });
      }
    }

    setState(prev => ({
      ...prev,
      isProcessing: false,
      isRecording: false
    }));
  };

  // Submit all accumulated data
  const handleFinalSubmit = () => {
    const fullTranscript = (state.fullTranscript + ' ' + state.currentSegment).trim();

    if (onFinalSubmit) {
      onFinalSubmit(state.accumulatedExtractions, fullTranscript);
    }
  };

  // Reset everything
  const resetAll = () => {
    if (state.isRecording) {
      speechServiceRouter.stopRecording();
    }
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }

    setState({
      isRecording: false,
      isPaused: false,
      isProcessing: false,
      fullTranscript: '',
      currentSegment: '',
      interimText: '',
      accumulatedExtractions: emptyExtractionResult,
      pendingReview: null,
      segmentCount: 0
    });
    setRecordingDuration(0);
    setError('');
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Count total accumulated items
  const totalAccumulated =
    state.accumulatedExtractions.medications.length +
    state.accumulatedExtractions.labs.length +
    state.accumulatedExtractions.vitals.length +
    state.accumulatedExtractions.conditions.length +
    state.accumulatedExtractions.allergies.length;

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Micro-Dictation</h2>
            {patientName && (
              <p className="text-indigo-100 text-sm">{patientName}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Duration */}
            {(state.isRecording || recordingDuration > 0) && (
              <div className="bg-white/20 px-3 py-1 rounded-full text-white text-sm font-medium">
                {formatDuration(recordingDuration)}
              </div>
            )}
            {/* Segment counter */}
            {state.segmentCount > 0 && (
              <div className="bg-white/20 px-3 py-1 rounded-full text-white text-sm">
                {state.segmentCount} segment{state.segmentCount !== 1 ? 's' : ''} • {totalAccumulated} items
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Recording State: Not started or recording */}
        {!state.isPaused && !state.pendingReview && (
          <div className="space-y-6">
            {/* Recording Controls */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <button
                  onClick={state.isRecording ? pauseAndReview : startRecording}
                  disabled={state.isProcessing}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    state.isRecording
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  } ${state.isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {state.isRecording ? (
                    <Pause className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-white" />
                  )}
                </button>

                {/* Pulse animation when recording */}
                {state.isRecording && (
                  <div className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping opacity-75" />
                )}
              </div>

              <p className="text-sm text-gray-600 text-center">
                {state.isRecording ? (
                  <>
                    <span className="font-medium text-amber-600">Recording...</span>
                    <br />
                    <span>Click to pause and review</span>
                  </>
                ) : state.isProcessing ? (
                  <span className="text-indigo-600">Processing audio...</span>
                ) : (
                  <>
                    Click to start recording
                    <br />
                    <span className="text-xs text-gray-400">You can pause anytime to review extractions</span>
                  </>
                )}
              </p>

              {/* Stop & Finalize button (visible when recording) */}
              {state.isRecording && (
                <button
                  onClick={stopAndFinalize}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <MicOff className="w-4 h-4" />
                  Stop & Finalize
                </button>
              )}
            </div>

            {/* Live Transcript */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-500 uppercase flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Live Transcript
                </h4>
                {state.fullTranscript && (
                  <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    {showTranscript ? 'Hide full transcript' : 'Show full transcript'}
                  </button>
                )}
              </div>

              {showTranscript && state.fullTranscript && (
                <div className="mb-3 p-3 bg-indigo-50 rounded text-sm text-gray-700 border-l-4 border-indigo-300">
                  <p className="text-xs text-indigo-600 font-medium mb-1">Previous segments:</p>
                  {state.fullTranscript}
                </div>
              )}

              <p className="text-gray-800 min-h-[60px]">
                {state.currentSegment || (
                  <span className="text-gray-400 italic">
                    {state.isRecording ? 'Listening...' : 'Start recording to transcribe'}
                  </span>
                )}
                {state.interimText && (
                  <span className="text-gray-400 italic"> {state.interimText}</span>
                )}
              </p>
            </div>

            {/* Accumulated Items Summary */}
            {totalAccumulated > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2">
                  Approved Items ({totalAccumulated})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {state.accumulatedExtractions.medications.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {state.accumulatedExtractions.medications.length} medications
                    </span>
                  )}
                  {state.accumulatedExtractions.labs.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {state.accumulatedExtractions.labs.length} labs
                    </span>
                  )}
                  {state.accumulatedExtractions.vitals.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {state.accumulatedExtractions.vitals.length} vitals
                    </span>
                  )}
                  {state.accumulatedExtractions.conditions.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {state.accumulatedExtractions.conditions.length} conditions
                    </span>
                  )}
                  {state.accumulatedExtractions.allergies.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {state.accumulatedExtractions.allergies.length} allergies
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Indicator */}
        {state.isProcessing && (
          <div className="flex flex-col items-center py-8">
            <Loader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-600">Extracting clinical data...</p>
          </div>
        )}

        {/* Review Panel */}
        {state.isPaused && state.pendingReview && !state.isProcessing && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-medium text-amber-800 mb-1">Review Extracted Data</h3>
              <p className="text-sm text-amber-700">
                Check the items below and toggle approval. Approved items will be accumulated.
              </p>
            </div>

            <DictationReviewPanel
              extraction={state.pendingReview}
              onItemApprovalChange={updateItemApproval}
              onApproveAll={approveAll}
            />

            {/* Segment transcript */}
            <details className="border rounded-lg">
              <summary className="p-3 cursor-pointer text-sm text-gray-600 hover:bg-gray-50">
                View segment transcript
              </summary>
              <div className="p-3 pt-0 text-sm text-gray-700 bg-gray-50">
                {state.currentSegment}
              </div>
            </details>

            {/* Action buttons */}
            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={skipAndContinue}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Skip & Continue
              </button>
              <div className="flex gap-3">
                <button
                  onClick={approveAndContinue}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Approve & Continue
                </button>
                <button
                  onClick={handleFinalSubmit}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Finalize
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Review State (after stopAndFinalize) */}
        {!state.isRecording && !state.isPaused && !state.isProcessing && totalAccumulated > 0 && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-1">Ready to Submit</h3>
              <p className="text-sm text-green-700">
                {totalAccumulated} items extracted from {state.segmentCount} segment{state.segmentCount !== 1 ? 's' : ''}.
                Review below and submit to chart.
              </p>
            </div>

            <DictationReviewPanel
              extraction={state.accumulatedExtractions}
              onItemApprovalChange={() => {}}
              readOnly
            />

            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={resetAll}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Check className="w-5 h-5" />
                Submit to Chart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {onCancel && (
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
          <button
            onClick={() => {
              resetAll();
              onCancel();
            }}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
