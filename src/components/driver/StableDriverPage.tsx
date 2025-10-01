'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getQuestionsForMedication } from '@/lib/priorAuth/medicationQuestions';
import { templateStorage } from '@/lib/templateStorage';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

// Medication keywords that trigger prior auth - expanded list
const PRIOR_AUTH_MEDICATIONS = [
  'ozempic',
  'wegovy',
  'mounjaro',
  'saxenda',
  'trulicity',
  'humira',
  'enbrel',
  'remicade',
  'stelara',
  'cosentyx',
  'dupixent',
  'xeljanz',
  'otezla',
  'taltz',
  'skyrizi',
  'farxiga',
  'jardiance',
  'lantus',
  'toujeo',
  'dexcom',
  'libre',
  'prolia',
  'forteo',
  'tymlos',
  'lispro',
  'humalog',
];

interface PriorAuthData {
  medication: string;
  diagnosis: string;
  dosage: string;
  duration: string;
  previousTreatments: string;
  clinicalRationale: string;
}

// Add custom CSS for animations
const animationStyles = `
  @keyframes pulse-slow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }
  .animate-pulse-slow {
    animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;

export default function StableDriverPage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState('');
  const [patientId, setPatientId] = useState(`PT-${Date.now().toString(36).toUpperCase()}`);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(30 * 60);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [soapNote, setSoapNote] = useState('');
  const [patientSummary, setPatientSummary] = useState('');
  const [showPriorAuth, setShowPriorAuth] = useState(false);
  const [priorAuthData, setPriorAuthData] = useState<PriorAuthData>({
    medication: '',
    diagnosis: '',
    dosage: '',
    duration: '',
    previousTreatments: '',
    clinicalRationale: '',
  });
  const [detectedMedications, setDetectedMedications] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [noteData, setNoteData] = useState<any>(null);
  const [currentMedQuestions, setCurrentMedQuestions] = useState<{ [med: string]: string[] }>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<{
    [med: string]: { [q: string]: boolean };
  }>({});
  const [capturedAnswers, setCapturedAnswers] = useState<{
    [med: string]: { [q: string]: string };
  }>({});
  const [activeMedication, setActiveMedication] = useState<string>('');
  const [interimText, setInterimText] = useState('');

  const sessionTimerRef = useRef<NodeJS.Timeout>();
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Load templates and saved notes on mount
  useEffect(() => {
    loadTemplates();
    loadSavedNotes();
    // Generate new patient ID each session
    setPatientId(`PT-${Date.now().toString(36).toUpperCase()}`);
  }, []);

  const loadTemplates = async () => {
    try {
      const templatesData = templateStorage.getTemplates();
      setTemplates(templatesData);
      // Auto-select first template if available
      if (templatesData.length > 0 && !selectedTemplate) {
        setSelectedTemplate(templatesData[0]);
      }
    } catch (error) {
      logError('StableDriverPage', 'Error message', {});
      setTemplates([]);
    }
  };

  const loadSavedNotes = async () => {
    try {
      const response = await fetch('/api/charts/save?limit=5');
      if (response.ok) {
        const data = await response.json();
        setSavedNotes(data.charts || []);
      }
    } catch (error) {
      logError('StableDriverPage', 'Error message', {});
    }
  };

  // Initialize speech recognition only once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          // Update interim display
          setInterimText(interim);

          // Update final transcript
          if (final) {
            setTranscript(prev => prev + final);
          }
        };

        recognition.onerror = (event: any) => {
          logError('StableDriverPage', 'Error message', {});
          if (event.error !== 'no-speech') {
            setError(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setInterimText('');
        };

        recognitionRef.current = recognition;
      } catch (err) {
        logError('StableDriverPage', 'Error message', {});
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Check for medications whenever transcript changes
  useEffect(() => {
    if (!transcript) return;

    const lowerText = transcript.toLowerCase();

    // Check for medications
    PRIOR_AUTH_MEDICATIONS.forEach(med => {
      if (lowerText.includes(med) && !detectedMedications.includes(med)) {
        logDebug('StableDriverPage', 'Debug message', {});

        // Add to detected list
        setDetectedMedications(prev => [...prev, med]);

        // Show prior auth form
        setShowPriorAuth(true);

        // Visual alert - flash the screen
        document.body.style.backgroundColor = '#fee2e2';
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 300);

        // Set first medication as active if none selected
        if (!activeMedication) {
          setActiveMedication(med);
          setPriorAuthData(prev => ({
            ...prev,
            medication: med.charAt(0).toUpperCase() + med.slice(1),
          }));
        }

        // Load questions for this medication
        const questions = getQuestionsForMedication(med);
        setCurrentMedQuestions(prev => ({ ...prev, [med]: questions }));

        // Initialize answered tracking for this medication
        const questionsMap: { [key: string]: boolean } = {};
        questions.forEach(q => (questionsMap[q] = false));
        setAnsweredQuestions(prev => ({ ...prev, [med]: questionsMap }));
        setCapturedAnswers(prev => ({ ...prev, [med]: {} }));

        // Extract context
        extractContext(lowerText, med);
      }
    });

    // Check for answered questions for all detected medications
    detectedMedications.forEach(med => {
      if (currentMedQuestions[med]) {
        checkAnsweredQuestions(transcript, med);
      }
    });
  }, [transcript, detectedMedications, activeMedication]);

  // Extract context for prior auth
  const extractContext = (text: string, medication: string) => {
    // Look for diagnosis
    if (text.includes('diabetes') || text.includes('type 2')) {
      setPriorAuthData(prev => ({ ...prev, diagnosis: 'Type 2 Diabetes Mellitus' }));
    }
    if (text.includes('obesity') || text.includes('weight')) {
      setPriorAuthData(prev => ({
        ...prev,
        diagnosis: prev.diagnosis ? prev.diagnosis + ', Obesity' : 'Obesity',
      }));
    }

    // Look for dosage
    const dosageMatch = text.match(/(\d+)\s*(mg|milligrams?|units?)/i);
    if (dosageMatch) {
      setPriorAuthData(prev => ({ ...prev, dosage: dosageMatch[0] }));
    }

    // Look for duration
    const durationMatch = text.match(/(\d+)\s*(months?|weeks?)/i);
    if (durationMatch) {
      setPriorAuthData(prev => ({ ...prev, duration: durationMatch[0] }));
    }

    // Look for previous treatments
    if (text.includes('failed') || text.includes('tried')) {
      const context = text.substring(
        Math.max(0, text.indexOf('failed') - 20),
        text.indexOf('failed') + 50
      );
      setPriorAuthData(prev => ({ ...prev, previousTreatments: context }));
    }
  };

  // Check answered questions for a specific medication
  const checkAnsweredQuestions = (text: string, medication: string) => {
    const lowerText = text.toLowerCase();
    const questions = currentMedQuestions[medication] || [];
    const medAnswered = answeredQuestions[medication] || {};

    questions.forEach(question => {
      const questionLower = question.toLowerCase();
      let answered = false;
      let answer = '';

      // Check for A1C
      if (questionLower.includes('a1c') && lowerText.includes('a1c')) {
        answered = true;
        const match = text.match(/a1c[^.]*\./i);
        answer = match ? match[0] : 'A1C mentioned';
      }

      // Check for BMI
      if (questionLower.includes('bmi') && lowerText.includes('bmi')) {
        answered = true;
        const match = text.match(/bmi[^.]*\./i);
        answer = match ? match[0] : 'BMI mentioned';
      }

      // Check for metformin
      if (questionLower.includes('metformin') && lowerText.includes('metformin')) {
        answered = true;
        const match = text.match(/metformin[^.]*\./i);
        answer = match ? match[0] : 'Metformin mentioned';
      }

      // Check for eGFR/kidney
      if (
        (questionLower.includes('egfr') || questionLower.includes('kidney')) &&
        (lowerText.includes('egfr') || lowerText.includes('kidney'))
      ) {
        answered = true;
        const match = text.match(/(?:egfr|kidney)[^.]*\./i);
        answer = match ? match[0] : 'Kidney function mentioned';
      }

      // Check for fracture
      if (questionLower.includes('fracture') && lowerText.includes('fracture')) {
        answered = true;
        const match = text.match(/fracture[^.]*\./i);
        answer = match ? match[0] : 'Fracture history mentioned';
      }

      // Check for T-score
      if (questionLower.includes('t-score') && lowerText.includes('t-score')) {
        answered = true;
        const match = text.match(/t-score[^.]*\./i);
        answer = match ? match[0] : 'T-score mentioned';
      }

      if (answered && !medAnswered[question]) {
        setAnsweredQuestions(prev => ({
          ...prev,
          [medication]: { ...prev[medication], [question]: true },
        }));
        setCapturedAnswers(prev => ({
          ...prev,
          [medication]: { ...prev[medication], [question]: answer },
        }));
      }
    });
  };

  // Session timeout
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      setSessionTimeRemaining(prev => {
        if (prev <= 0) {
          handleSessionTimeout();
          return 0;
        }
        if (prev === 120) {
          alert('Your session will expire in 2 minutes. Please save your work.');
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, []);

  const handleSessionTimeout = () => {
    alert('Your session has expired for security. Please log in again.');
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    router.push('/');
  };

  // Recording functions
  const startRecording = async () => {
    try {
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      // Also start audio recording for backup
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err: any) {
      setError(`Microphone access error: ${err.message}`);
    }
  };

  const pauseRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsRecording(false);
    setIsPaused(false);
    setInterimText('');
  };

  // Save note to database
  const saveNote = async () => {
    setSaveStatus('saving');
    try {
      const response = await fetch('/api/charts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName: `Patient ${patientId}`,
          chiefComplaint: transcript.substring(0, 100),
          transcript,
          soapNote: noteData?.soap || {},
          diagnoses: noteData?.diagnoses || [],
          medications: detectedMedications.map(m => ({ name: m, requiresPriorAuth: true })),
          priorAuthRequired: detectedMedications.length > 0,
          priorAuthData,
          templateUsed: selectedTemplate?.id,
        }),
      });

      if (response.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
        loadSavedNotes(); // Reload saved notes
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      logError('StableDriverPage', 'Error message', {});
      setSaveStatus('error');
    }
  };

  // Generate SOAP note
  const generateSOAP = async () => {
    if (!transcript || transcript.trim().length === 0) {
      setError('Please record or enter a transcript first');
      return;
    }

    if (!patientId) {
      setError('Patient ID is required');
      return;
    }

    setLoading(true);
    setError('');
    setSoapNote('');

    try {
      const requestBody = {
        transcript: transcript.trim(),
        meta: {
          patientId,
          format: 'soap',
          timestamp: new Date().toISOString(),
        },
        template: selectedTemplate || null,
      };

      logDebug('StableDriverPage', 'Debug message', {});

      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError('StableDriverPage', 'Error message', {});
        let errorMessage = 'Failed to generate SOAP note';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setNoteData(result);

      // Clear any previous errors since we got a successful response
      setError('');

      // Format SOAP note - handle different response structures
      if (result.soap) {
        const soap = result.soap;
        const formattedNote = [
          'SUBJECTIVE:',
          soap.subjective || soap.S || 'Patient information not available',
          '',
          'OBJECTIVE:',
          soap.objective || soap.O || 'Clinical findings not available',
          '',
          'ASSESSMENT:',
          soap.assessment || soap.A || 'Assessment pending',
          '',
          'PLAN:',
          soap.plan || soap.P || 'Treatment plan to be determined',
        ].join('\n');
        setSoapNote(formattedNote);
      } else if (result.note) {
        // Handle alternative response format
        setSoapNote(result.note);
      } else {
        // Fallback format
        setSoapNote(
          `CLINICAL NOTE\n\nTranscript:\n${transcript}\n\nGenerated: ${new Date().toLocaleString()}`
        );
      }

      // Show success message briefly
      logInfo('StableDriverPage', 'Info message', {});
    } catch (error: any) {
      logError('StableDriverPage', 'Error message', {});
      setError(`Error: ${error.message || 'Failed to generate SOAP note. Please try again.'}`);

      // Provide a basic SOAP note as fallback
      if (transcript && transcript.trim().length > 0) {
        const fallbackNote = [
          'SUBJECTIVE:',
          transcript.substring(0, 500),
          '',
          'OBJECTIVE:',
          '[Clinical examination pending]',
          '',
          'ASSESSMENT:',
          '[Clinical assessment based on above findings]',
          '',
          'PLAN:',
          '[Treatment plan to be determined based on assessment]',
          '',
          'Note: Generated locally due to API error',
        ].join('\n');
        setSoapNote(fallbackNote);
        setNoteData({ soap: { subjective: transcript }, fallback: true });

        // Clear error since we provided a fallback note
        setError('');
        logDebug('StableDriverPage', 'Debug message', {});
      }
    } finally {
      setLoading(false);
    }
  };

  // Save prior auth data for all medications
  const savePriorAuthData = () => {
    const allPAData = detectedMedications.map(med => ({
      medication: med.charAt(0).toUpperCase() + med.slice(1),
      diagnosis: priorAuthData.diagnosis,
      dosage: priorAuthData.dosage,
      duration: priorAuthData.duration,
      previousTreatments: priorAuthData.previousTreatments,
      clinicalRationale: priorAuthData.clinicalRationale,
      patientId,
      transcript,
      questions: currentMedQuestions[med] || [],
      answeredQuestions: answeredQuestions[med] || {},
      capturedAnswers: capturedAnswers[med] || {},
      timestamp: new Date().toISOString(),
      id: `PA-${med}-${Date.now()}`,
      status: 'ready_to_submit',
    }));

    // Get existing PA data
    const existing = localStorage.getItem('pending_pa_submissions');
    const paList = existing ? JSON.parse(existing) : [];

    // Add all medication PAs to the list
    allPAData.forEach(paData => {
      paList.push(paData);
      logDebug('StableDriverPage', 'Debug message', {});
    });

    localStorage.setItem('pending_pa_submissions', JSON.stringify(paList));

    return allPAData;
  };

  // Submit prior auth
  const submitPriorAuth = async () => {
    setLoading(true);
    try {
      // Save to localStorage first
      savePriorAuthData();

      alert('Prior authorization saved! View in Prior Auth History.');
      setShowPriorAuth(false);

      // Open prior auth history in new tab
      window.open('/driver/priorauth', '_blank');
    } catch (error: any) {
      setError(`Failed to save prior auth: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{animationStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Professional Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-blue-100">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Medical Dictation Pro
                </h1>
                <p className="text-sm text-gray-600 mt-1">AI-Powered Clinical Documentation</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Session: {Math.floor(sessionTimeRemaining / 60)}:
                  {String(sessionTimeRemaining % 60).padStart(2, '0')}
                </span>
                <button
                  onClick={() => setSessionTimeRemaining(30 * 60)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Extend
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Dictation Area */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                {/* Patient ID and Template Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patient ID
                    </label>
                    <input
                      type="text"
                      value={patientId}
                      onChange={e => setPatientId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      placeholder="Auto-generated patient ID"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template (Optional)
                    </label>
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={e => {
                        const value = e.target.value;
                        if (value === '') {
                          setSelectedTemplate(null);
                        } else if (value === 'create-new') {
                          router.push('/driver/template-studio');
                        } else {
                          const template = templates.find(t => t.id === value);
                          if (template) {
                            setSelectedTemplate(template);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {templates.length === 0 && <option value="">No templates available</option>}
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} - {template.specialty}
                        </option>
                      ))}
                      <option value="create-new" className="font-semibold text-blue-600">
                        ➕ Create New Template
                      </option>
                    </select>
                  </div>
                </div>

                {/* Recording Controls */}
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex gap-3 mb-3">
                    <button
                      onClick={startRecording}
                      disabled={isRecording}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <span
                        className={`w-3 h-3 ${isRecording ? 'animate-pulse' : ''} bg-white rounded-full`}
                      ></span>
                      {isRecording ? 'Recording...' : 'Start'}
                    </button>

                    {isRecording && !isPaused && (
                      <button
                        onClick={pauseRecording}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        Pause
                      </button>
                    )}

                    {isRecording && isPaused && (
                      <button
                        onClick={resumeRecording}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Resume
                      </button>
                    )}

                    <button
                      onClick={stopRecording}
                      disabled={!isRecording}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Stop
                    </button>
                  </div>
                  {isRecording && (
                    <p className="text-sm text-red-600 animate-pulse">
                      ● Live transcription active - speak clearly...
                    </p>
                  )}
                </div>

                {/* Live Transcript */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Live Transcript
                  </label>
                  <div className="relative">
                    <textarea
                      id="transcript-area"
                      value={transcript + (interimText ? ' ' + interimText : '')}
                      onChange={e => setTranscript(e.target.value)}
                      className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="Your dictation will appear here in real-time as you speak..."
                    />
                    {interimText && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-yellow-100 text-xs rounded">
                        Listening...
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {transcript.length} characters | {transcript.split(' ').filter(w => w).length}{' '}
                    words
                  </p>
                </div>

                {/* Detected Medications */}
                {detectedMedications.length > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg animate-pulse-slow">
                    <p className="text-sm font-bold text-red-700">
                      ⚠️ PRIOR AUTH MEDICATIONS DETECTED:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detectedMedications.map((med, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-semibold animate-bounce"
                        >
                          {med.toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-red-600 mt-2 font-semibold">
                      Check right panel for required questions!
                    </p>
                  </div>
                )}

                {/* Generation and Save Buttons */}
                <div className="flex gap-3 items-center">
                  <button
                    onClick={generateSOAP}
                    disabled={loading || !transcript}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Generate SOAP Note
                      </>
                    )}
                  </button>

                  {soapNote && (
                    <button
                      onClick={saveNote}
                      disabled={saveStatus === 'saving'}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                    >
                      {saveStatus === 'saving' ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                          Saving...
                        </>
                      ) : saveStatus === 'saved' ? (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Saved!
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"
                            />
                          </svg>
                          Save Note
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setTranscript('');
                      setSoapNote('');
                      setPatientSummary('');
                      setDetectedMedications([]);
                      setInterimText('');
                      setError('');
                      setNoteData(null);
                      setCurrentMedQuestions({});
                      setAnsweredQuestions({});
                      setCapturedAnswers({});
                      setSaveStatus('idle');
                      setPatientId(`PT-${Date.now().toString(36).toUpperCase()}`);
                    }}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* SOAP Note Display */}
              {soapNote && (
                <div className="bg-white rounded-lg shadow p-6 mt-6">
                  <h3 className="text-lg font-semibold mb-3">SOAP Note</h3>
                  <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
                    {soapNote}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-1">
              {/* Multiple Medication Tabs */}
              {detectedMedications.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg mb-4">
                  <div className="flex flex-wrap gap-2 p-3 border-b">
                    {detectedMedications.map(med => (
                      <button
                        key={med}
                        onClick={() => {
                          setActiveMedication(med);
                          setPriorAuthData(prev => ({
                            ...prev,
                            medication: med.charAt(0).toUpperCase() + med.slice(1),
                          }));
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                          activeMedication === med
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {med.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prior Auth Questions Guide */}
              {activeMedication && currentMedQuestions[activeMedication] && (
                <div className="bg-blue-50 rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-400">
                  <h3 className="text-lg font-bold text-blue-800 mb-4">
                    📋 Required Info for {activeMedication.toUpperCase()}
                  </h3>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {currentMedQuestions[activeMedication].map((question, idx) => {
                      const isAnswered = answeredQuestions[activeMedication]?.[question] || false;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${isAnswered ? 'bg-green-100' : 'bg-white'} border`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={isAnswered ? 'text-green-600' : 'text-gray-400'}>
                              {isAnswered ? '✓' : '○'}
                            </span>
                            <p className="text-sm text-gray-700">{question}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-xs text-gray-600">
                    {
                      Object.values(answeredQuestions[activeMedication] || {}); // .filter(Boolean)
                        .length
                    }{' '}
                    of {currentMedQuestions[activeMedication].length} answered
                  </div>
                </div>
              )}

              {/* Prior Auth Form */}
              {showPriorAuth && (
                <div className="bg-red-50 rounded-lg shadow-lg p-4 mb-6 border-4 border-red-400 animate-pulse-slow">
                  <h3 className="text-base font-bold text-red-700 mb-3">🚨 PRIOR AUTH REQUIRED</h3>

                  <button
                    onClick={submitPriorAuth}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Save PA Data
                  </button>
                </div>
              )}

              {/* Quick Links & Recent Notes */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Tools</h3>
                  <div className="space-y-2">
                    <Link
                      href="/driver/priorauth"
                      className="block w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center font-medium"
                    >
                      Prior Auth History
                    </Link>
                    <Link
                      href="/driver/template-studio"
                      className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center font-medium"
                    >
                      Template Editor
                    </Link>
                    <Link
                      href="/doctor/dashboard"
                      className="block w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center font-medium"
                    >
                      Doctor Dashboard
                    </Link>
                  </div>
                </div>

                {/* Recent Saved Notes */}
                {savedNotes.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Notes</h3>
                    <div className="space-y-2">
                      {savedNotes.slice(0, 3).map((note: any) => (
                        <div
                          key={note.id}
                          className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {note.patient_name || note.patient_id}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date(note.encounter_date).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-300 text-red-700 p-3 rounded mt-4">
                  {error}
                  <button onClick={() => setError('')} className="ml-2 text-red-500">
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
