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

interface PatientRecord {
  id: string;
  patientId: string;
  patientName: string;
  time: string;
  chiefComplaint: string;
  status: 'completed' | 'in-progress' | 'pending';
  hasPriorAuth: boolean;
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
  @keyframes slide-down {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
`;

export default function StableDriverPageRevamped() {
  const router = useRouter();
  const [transcript, setTranscript] = useState('');
  const [patientId, setPatientId] = useState(`PT-${Date.now().toString(36).toUpperCase()}`);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(30 * 60);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [todayPatients, setTodayPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [soapNote, setSoapNote] = useState('');
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

  // Load templates and today's patients on mount
  useEffect(() => {
    loadTemplates();
    loadTodayPatients();
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
      logError('StableDriverPageRevamped', 'Error message', {});
      setTemplates([]);
    }
  };

  const loadTodayPatients = async () => {
    try {
      const response = await fetch('/api/charts/save?today=true');
      if (response.ok) {
        const data = await response.json();
        const charts = data.charts || [];

        // Transform to patient records for display
        const patientRecords: PatientRecord[] = charts.map((chart: any) => ({
          id: chart.id,
          patientId: chart.patient_id,
          patientName: chart.patient_name || `Patient ${chart.patient_id}`,
          time: new Date(chart.encounter_date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          chiefComplaint: chart.chief_complaint || 'General consultation',
          status: chart.is_finalized ? 'completed' : 'in-progress',
          hasPriorAuth: chart.prior_auth_required || false,
        }));

        setTodayPatients(patientRecords);
      }
    } catch (error) {
      logError('StableDriverPageRevamped', 'Error message', {});
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
          logError('StableDriverPageRevamped', 'Error message', {});
          if (event.error !== 'no-speech') {
            setError(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setInterimText('');
        };

        recognitionRef.current = recognition;
      } catch (err) {
        logError('StableDriverPageRevamped', 'Error message', {});
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
        logDebug('StableDriverPageRevamped', 'Debug message', {});

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
        loadTodayPatients(); // Reload patient list
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      logError('StableDriverPageRevamped', 'Error message', {});
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

      logDebug('StableDriverPageRevamped', 'Debug message', {});

      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError('StableDriverPageRevamped', 'Error message', {});
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
      logInfo('StableDriverPageRevamped', 'Info message', {});
    } catch (error: any) {
      logError('StableDriverPageRevamped', 'Error message', {});
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
        logDebug('StableDriverPageRevamped', 'Debug message', {});
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
      logDebug('StableDriverPageRevamped', 'Debug message', {});
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
      <div className="min-h-screen bg-gray-50">
        {/* Compact Header with Quick Tools */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-6">
                <h1 className="text-xl font-bold text-gray-900">Medical Dictation</h1>
                <div className="flex items-center gap-2">
                  <Link
                    href="/driver/priorauth"
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                  >
                    Prior Auth
                  </Link>
                  <Link
                    href="/driver/template-studio-enhanced"
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Templates+
                  </Link>
                  <Link
                    href="/doctor/dashboard"
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">
                  Session: {Math.floor(sessionTimeRemaining / 60)}:
                  {String(sessionTimeRemaining % 60).padStart(2, '0')}
                </span>
                <button
                  onClick={() => setSessionTimeRemaining(30 * 60)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Extend
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Left Column - Today's Patients List */}
            <div className="col-span-3">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <h2 className="font-semibold text-gray-900">Today's Patients</h2>
                  <p className="text-xs text-gray-500 mt-1">{todayPatients.length} patients seen</p>
                </div>
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                  {todayPatients.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No patients yet today
                    </div>
                  ) : (
                    <div className="divide-y">
                      {todayPatients.map(patient => (
                        <div
                          key={patient.id}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors animate-slide-down"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {patient.patientName}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {patient.chiefComplaint}
                              </p>
                            </div>
                            <div className="ml-2 flex-shrink-0 text-right">
                              <p className="text-xs text-gray-500">{patient.time}</p>
                              {patient.hasPriorAuth && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                  PA
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                                patient.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : patient.status === 'in-progress'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {patient.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column - Main Dictation Area */}
            <div className="col-span-6">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4">
                  {/* Patient ID and Template Selection */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Patient ID
                      </label>
                      <input
                        type="text"
                        value={patientId}
                        onChange={e => setPatientId(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                        placeholder="Auto-generated"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Template
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
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">No template</option>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                        <option value="create-new" className="font-semibold">
                          + New Template
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Recording Controls */}
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex gap-2">
                      <button
                        onClick={startRecording}
                        disabled={isRecording}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        <span
                          className={`w-2 h-2 ${isRecording ? 'animate-pulse' : ''} bg-white rounded-full`}
                        ></span>
                        {isRecording ? 'Recording' : 'Start'}
                      </button>

                      {isRecording && !isPaused && (
                        <button
                          onClick={pauseRecording}
                          className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                          Pause
                        </button>
                      )}

                      {isRecording && isPaused && (
                        <button
                          onClick={resumeRecording}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Resume
                        </button>
                      )}

                      <button
                        onClick={stopRecording}
                        disabled={!isRecording}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Stop
                      </button>

                      {isRecording && (
                        <p className="ml-auto text-xs text-red-600 animate-pulse self-center">
                          ● Recording...
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Live Transcript */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Live Transcript
                    </label>
                    <div className="relative">
                      <textarea
                        value={transcript + (interimText ? ' ' + interimText : '')}
                        onChange={e => setTranscript(e.target.value)}
                        className="w-full h-48 px-3 py-2 text-sm border border-gray-300 rounded font-mono"
                        placeholder="Start speaking to begin transcription..."
                      />
                      {interimText && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-yellow-100 text-xs rounded">
                          Listening...
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {transcript.split(' ').filter(w => w).length} words
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={generateSOAP}
                      disabled={loading || !transcript}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Generating...' : 'Generate SOAP'}
                    </button>

                    {soapNote && (
                      <button
                        onClick={saveNote}
                        disabled={saveStatus === 'saving'}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saveStatus === 'saving'
                          ? 'Saving...'
                          : saveStatus === 'saved'
                            ? 'Saved!'
                            : 'Save Note'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setTranscript('');
                        setSoapNote('');
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
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      New Patient
                    </button>
                  </div>
                </div>

                {/* SOAP Note Display */}
                {soapNote && (
                  <div className="border-t p-4">
                    <h3 className="text-sm font-semibold mb-2">SOAP Note</h3>
                    <div className="whitespace-pre-wrap font-mono text-xs bg-gray-50 p-3 rounded border">
                      {soapNote}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Prior Auth Medications */}
            <div className="col-span-3">
              {/* Prior Auth Alert */}
              {detectedMedications.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 mb-3 animate-pulse-slow">
                  <p className="text-sm font-bold text-red-700 mb-2">⚠️ PRIOR AUTH DETECTED</p>
                  <div className="space-y-1">
                    {detectedMedications.map((med, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-800">
                          {med.toUpperCase()}
                        </span>
                        <button
                          onClick={() => {
                            setActiveMedication(med);
                            setPriorAuthData(prev => ({
                              ...prev,
                              medication: med.charAt(0).toUpperCase() + med.slice(1),
                            }));
                          }}
                          className={`px-2 py-0.5 text-xs rounded ${
                            activeMedication === med
                              ? 'bg-red-600 text-white'
                              : 'bg-red-200 text-red-700 hover:bg-red-300'
                          }`}
                        >
                          {activeMedication === med ? 'Active' : 'Select'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={submitPriorAuth}
                    className="w-full mt-3 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Save All PA Data
                  </button>
                </div>
              )}

              {/* Required Questions for Active Medication */}
              {activeMedication && currentMedQuestions[activeMedication] && (
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-4 py-3 border-b bg-blue-50">
                    <h3 className="text-sm font-semibold text-blue-800">
                      Required for {activeMedication.toUpperCase()}
                    </h3>
                    <p className="text-xs text-blue-600 mt-1">
                      {
                        Object.values(answeredQuestions[activeMedication] || {}); // .filter(Boolean)
                          .length
                      }
                      /{currentMedQuestions[activeMedication].length} answered
                    </p>
                  </div>

                  <div className="max-h-[calc(100vh-350px)] overflow-y-auto p-3">
                    <div className="space-y-2">
                      {currentMedQuestions[activeMedication].map((question, idx) => {
                        const isAnswered = answeredQuestions[activeMedication]?.[question] || false;
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded text-xs ${
                              isAnswered
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              <span className={isAnswered ? 'text-green-600' : 'text-gray-400'}>
                                {isAnswered ? '✓' : '○'}
                              </span>
                              <p className="text-gray-700">{question}</p>
                            </div>
                            {isAnswered && capturedAnswers[activeMedication]?.[question] && (
                              <p className="ml-5 mt-1 text-xs text-gray-600 italic">
                                "{capturedAnswers[activeMedication][question]}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-3 bg-red-50 border border-red-300 text-red-700 p-3 rounded text-sm">
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
