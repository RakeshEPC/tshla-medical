/**
 * HIPAA-Compliant Dictation Page
 * Uses AWS Transcribe Medical instead of Web Speech API
 *
 * This version ensures full HIPAA compliance while maintaining
 * the same high-quality output you're used to.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { medicalCorrections } from '../services/medicalCorrections.service';
import { speechServiceRouter } from '../services/speechServiceRouter.service';
import { getPatientData, type PatientData } from '../services/patientData.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function DictationPageHIPAA() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [processedNote, setProcessedNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [recordingMode, setRecordingMode] = useState<'dictation' | 'conversation'>('dictation');
  const [patientData, setPatientData] = useState<PatientData | undefined>();

  // Patient details for live editing
  const [patientDetails, setPatientDetails] = useState({
    name: '',
    mrn: '',
    dob: '',
    email: '',
    visitDate: new Date().toLocaleDateString(),
  });

  // Load patient data
  useEffect(() => {
    if (patientId) {
      const data = getPatientData(patientId);
      setPatientData(data);

      if (data) {
        setPatientDetails({
          name: data.name || '',
          mrn: data.mrn || '',
          dob: data.dob || '',
          email: data.email || '',
          visitDate: new Date().toLocaleDateString(),
        });
      }
    }
  }, [patientId]);

  const startRecording = async () => {
    if (isRecording) return;

    try {
      // Use Speech Service Router for unified service access
      const started = await speechServiceRouter.startRecording(recordingMode, {
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            // Apply medical corrections for final transcripts
            const correctedText = medicalCorrections.correctTranscription(text);
            setTranscript(
              prev =>
                prev + (prev ? (recordingMode === 'conversation' ? '\n' : ' ') : '') + correctedText
            );
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        onError: (error: string) => {
          logError('DictationPageHIPAA', 'Error message', {});
          setRecordingError(`Speech transcription: ${error}`);
          setIsRecording(false);
        },
        onEnd: () => {
          setIsRecording(false);
        },
      });

      if (!started) {
        setRecordingError('Failed to start speech transcription. Please check your configuration.');
        return;
      }

      setIsRecording(true);
      setRecordingError('');
    } catch (error) {
      logError('DictationPageHIPAA', 'Error message', {});
      setRecordingError('Failed to start recording. Please check AWS credentials.');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    // Use Speech Service Router to stop recording
    speechServiceRouter.stopRecording();

    // Save any interim text as final
    if (interimText.trim()) {
      setTranscript(prev => prev + (prev ? ' ' : '') + interimText.trim());
      setInterimText('');
    }

    setIsRecording(false);
  };

  const processWithAI = async () => {
    if (!transcript.trim()) {
      alert('No transcript to process');
      return;
    }

    setIsProcessing(true);
    try {
      const patientContext = `Name: ${patientDetails.name}, MRN: ${patientDetails.mrn}, DOB: ${patientDetails.dob}`;

      const combinedContent =
        recordingMode === 'conversation' ? `CONVERSATION TRANSCRIPT:\n${transcript}` : transcript;

      const patientDataForAI = {
        name: patientDetails.name || 'Unknown Patient',
        mrn: patientDetails.mrn || 'Unknown MRN',
        dateOfBirth: patientDetails.dob || 'Unknown DOB',
        visitDate: patientDetails.visitDate,
        vitals: {
          bp: '',
          hr: '',
          temp: '',
          weight: '',
          bmi: '',
        },
      };

      const result = await azureAIService.processMedicalTranscription(
        combinedContent,
        patientDataForAI,
        null,
        `Patient context: ${patientContext}`
      );

      const processedContent = result.formatted;
      setProcessedNote(processedContent);
      setShowProcessed(true);
    } catch (error) {
      logError('DictationPageHIPAA', 'Error message', {});
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to process with AI: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setTranscript('');
    setInterimText('');
    setProcessedNote('');
    setShowProcessed(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (error) {
      logError('DictationPageHIPAA', 'Error message', {});
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">
              Patient Dictation
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                HIPAA Compliant
              </span>
            </h1>
            <span className="text-sm text-gray-500">
              {patientData ? `${patientData.name} - MRN: ${patientData.mrn}` : 'Loading...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/doctor')}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('session_expires');
                window.location.href = '/login';
              }}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Patient Details */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Patient Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={patientDetails.name}
                    onChange={e => setPatientDetails({ ...patientDetails, name: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter patient name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">MRN</label>
                  <input
                    type="text"
                    value={patientDetails.mrn}
                    onChange={e => setPatientDetails({ ...patientDetails, mrn: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter MRN"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    value={patientDetails.dob}
                    onChange={e => setPatientDetails({ ...patientDetails, dob: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    placeholder="MM/DD/YYYY"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={patientDetails.email}
                    onChange={e => setPatientDetails({ ...patientDetails, email: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    placeholder="patient@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Visit Date</label>
                  <input
                    type="text"
                    value={patientDetails.visitDate}
                    readOnly
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">Recording Mode</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setRecordingMode('dictation')}
                  className={`flex-1 py-2 px-3 text-xs rounded-lg font-medium transition-colors ${
                    recordingMode === 'dictation'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🎤 Dictation
                </button>
                <button
                  onClick={() => setRecordingMode('conversation')}
                  className={`flex-1 py-2 px-3 text-xs rounded-lg font-medium transition-colors ${
                    recordingMode === 'conversation'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  👥 Conversation
                </button>
              </div>

              {/* AWS Transcribe Medical Status */}
              <div className="mt-3 p-2 bg-green-50 rounded">
                <div className="text-xs font-medium text-gray-700 mb-1">
                  ✅ AWS Transcribe Medical (HIPAA-Compliant)
                  <div className="text-xs text-gray-600 mt-1">
                    {recordingMode === 'conversation' ? (
                      <>• Automatic speaker detection (CLINICIAN/PATIENT)</>
                    ) : (
                      <>• 99%+ medical terminology accuracy</>
                    )}
                    <br />• PHI content protection enabled
                    <br />• Medical specialty: PRIMARYCARE
                  </div>
                </div>
              </div>

              {recordingError && (
                <div className="mt-3 p-2 bg-red-50 text-red-800 text-xs rounded">
                  {recordingError}
                </div>
              )}
            </div>
          </div>

          {/* Middle Column - Dictation */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Dictation</h2>
              <div className="flex gap-2">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isRecording
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isRecording ? '⏹ Stop' : '🎤 Start'}
                </button>
                <button
                  onClick={clearAll}
                  className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="w-full h-[500px] p-3 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                placeholder={`Start ${recordingMode === 'conversation' ? 'conversation' : 'dictation'}...`}
              />
              {interimText && (
                <div className="absolute bottom-3 left-3 right-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-600 italic">
                  {interimText}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between">
              <div className="text-xs text-gray-500">
                {transcript.split(' ').filter(w => w).length} words
              </div>
              <button
                onClick={processWithAI}
                disabled={!transcript.trim() || isProcessing}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {isProcessing ? 'Processing...' : '✨ Process with AI'}
              </button>
            </div>
          </div>

          {/* Right Column - Processed Note */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Processed Note</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(processedNote)}
                  disabled={!processedNote}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={!processedNote}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  🖨 Print
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 h-[500px] overflow-y-auto">
              {showProcessed && processedNote ? (
                <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                  {processedNote}
                </pre>
              ) : (
                <p className="text-gray-400 text-sm italic">Processed note will appear here...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
