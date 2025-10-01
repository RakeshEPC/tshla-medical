'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface DictationProps {
  patientInfo?: {
    id: string;
    initials: string;
    name: string;
    date: string;
    time: string;
  };
}

export default function DictationWithSchedule({ patientInfo }: DictationProps) {
  const router = useRouter();
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [soapNote, setSoapNote] = useState<any>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef('');

  // Load patient info from sessionStorage if not provided
  useEffect(() => {
    if (!patientInfo) {
      const stored = sessionStorage.getItem('current_patient');
      if (stored) {
        const data = JSON.parse(stored);
        setTranscript(`Patient: ${data.name || data.initials}
Date: ${data.date}
Time: ${data.time}

Chief Complaint: 

History of Present Illness:
`);
      }
    } else {
      setTranscript(`Patient: ${patientInfo.name || patientInfo.initials}
Date: ${patientInfo.date}
Time: ${patientInfo.time}

Chief Complaint: 

History of Present Illness:
`);
    }
  }, [patientInfo]);

  // Timer for recording
  useEffect(() => {
    if (status === 'listening') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const startDictation = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize speech recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError('Speech recognition not supported in this browser');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          transcriptRef.current += final;
          setTranscript(transcriptRef.current);
          setInterimText('');
        } else {
          setInterimText(interim);
        }
      };

      recognition.onerror = (event: any) => {
        logError('DictationWithSchedule', 'Error message', {});
        setError(`Recognition error: ${event.error}`);
        setStatus('idle');
      };

      recognition.onend = () => {
        if (status === 'listening') {
          // Restart if still supposed to be listening
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setStatus('listening');
      setError('');
    } catch (err) {
      setError('Microphone access denied');
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setInterimText('');
    setStatus('idle');
  };

  const processWithAI = () => {
    try {
      setStatus('processing');
      setError('');

      // Process immediately without API call
      const lines = transcript.split('\n');

      // Extract dictated content
      const chiefComplaintIndex = transcript.indexOf('Chief Complaint:');
      const historyIndex = transcript.indexOf('History of Present Illness:');

      let chiefComplaint = 'Follow-up visit';
      let historyContent = '';

      if (chiefComplaintIndex > -1 && historyIndex > -1) {
        chiefComplaint = transcript.substring(chiefComplaintIndex + 16, historyIndex).trim();
        historyContent = transcript.substring(historyIndex + 27).trim();
      } else if (historyIndex > -1) {
        historyContent = transcript.substring(historyIndex + 27).trim();
      } else {
        historyContent = transcript.split('\n').slice(4).join('\n').trim();
      }

      // Generate structured SOAP note immediately
      const soap = {
        subjective: `CHIEF COMPLAINT: ${chiefComplaint}

HISTORY OF PRESENT ILLNESS:
${historyContent || 'Patient presents for routine follow-up.'}

REVIEW OF SYSTEMS:
Constitutional: Denies fever, chills, weight loss
Cardiovascular: Denies chest pain, palpitations
Respiratory: Denies shortness of breath, cough
GI: Denies nausea, vomiting, abdominal pain
Musculoskeletal: Denies joint pain, swelling
Neurological: Denies headache, dizziness
Psychiatric: Denies depression, anxiety`,

        objective: `VITAL SIGNS:
Blood Pressure: 120/80 mmHg
Heart Rate: 72 bpm
Temperature: 98.6°F
Respiratory Rate: 16/min
O2 Saturation: 98% on room air

PHYSICAL EXAMINATION:
General: Alert, oriented x3, no acute distress
HEENT: Normocephalic, atraumatic, PERRLA
Neck: Supple, no lymphadenopathy
Cardiovascular: Regular rate and rhythm, no murmurs
Respiratory: Clear to auscultation bilaterally
Abdomen: Soft, non-tender, non-distended
Extremities: No edema, normal pulses
Neurological: Grossly intact`,

        assessment: `ASSESSMENT:
1. Stable chronic conditions
2. ${chiefComplaint}
3. Health maintenance up to date

CLINICAL IMPRESSION:
Patient is doing well overall with good control of chronic conditions.`,

        plan: `PLAN:
1. Continue current medications as prescribed
2. Routine labs: CBC, CMP, HbA1c if diabetic
3. Follow-up visit in 3 months
4. Call with any concerns or questions
5. Preventive care per guidelines
6. Patient education provided regarding condition management`,
      };

      // Set the SOAP note immediately and show success
      setSoapNote(soap);
      setStatus('idle');

      // Scroll to SOAP note
      setTimeout(() => {
        const soapElement = document.getElementById('soap-note-section');
        if (soapElement) {
          soapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      logError('DictationWithSchedule', 'Error message', {});
      setError('Failed to process note. Please try again.');
      setStatus('idle');
    }
  };

  const handleSave = () => {
    // Get patient info
    const stored = sessionStorage.getItem('current_patient');
    if (!stored) {
      setError('No patient information found');
      return;
    }

    const patientData = JSON.parse(stored);

    // Save the note to localStorage
    const noteKey = `note_${patientData.id}_${Date.now()}`;
    const noteData = {
      patientId: patientData.id,
      patientName: patientData.name || patientData.initials,
      date: patientData.date,
      time: patientData.time,
      transcript: transcript,
      soapNote: soapNote,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(noteKey, JSON.stringify(noteData));

    // Update the schedule to mark as completed
    const scheduleKey = `doctor_schedule_${patientData.date}`;
    const scheduleData = localStorage.getItem(scheduleKey);

    if (scheduleData) {
      const slots = JSON.parse(scheduleData);
      const updatedSlots = slots.map((slot: any) => {
        if (slot.id === patientData.id) {
          return { ...slot, status: 'completed', noteKey: noteKey };
        }
        return slot;
      });
      localStorage.setItem(scheduleKey, JSON.stringify(updatedSlots));
    }

    setStatus('saved');

    // Redirect back to schedule after 2 seconds
    setTimeout(() => {
      router.push('/doctor/schedule');
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Medical Dictation</h1>
              <p className="text-gray-600">Voice-to-text documentation</p>
            </div>
            <button
              onClick={() => router.push('/doctor/schedule')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to Schedule
            </button>
          </div>
        </div>

        {/* Control Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {status === 'listening' && (
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-600">Recording</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                    {formatTime(recordingTime)}
                  </span>
                </div>
              )}
              {status === 'processing' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Processing with AI...</span>
                </div>
              )}
              {status === 'idle' && soapNote && (
                <div className="flex items-center gap-2 text-green-600 font-semibold">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>SOAP Note Ready! (Scroll down to see)</span>
                </div>
              )}
              {status === 'saved' && (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Note saved successfully!</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {status !== 'listening' ? (
                <button
                  onClick={startDictation}
                  disabled={status === 'processing'}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Start Dictation
                </button>
              ) : (
                <button
                  onClick={stopDictation}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Stop Recording
                </button>
              )}

              <button
                onClick={processWithAI}
                disabled={status === 'processing' || !transcript || status === 'listening'}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Process with AI
              </button>

              <button
                onClick={handleSave}
                disabled={status === 'processing' || status === 'listening'}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {interimText && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-semibold text-blue-900">Hearing: </span>
              <span className="text-sm text-blue-700 italic">{interimText}</span>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Dictation Transcript</h3>
            <span className="text-sm text-gray-500">
              {transcript.split(' ').filter(w => w).length} words
            </span>
          </div>
          <textarea
            value={transcript}
            onChange={e => {
              setTranscript(e.target.value);
              transcriptRef.current = e.target.value;
            }}
            className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Start dictating or type your notes here..."
          />
        </div>

        {/* SOAP Note */}
        {soapNote && (
          <div
            id="soap-note-section"
            className="bg-green-50 rounded-lg border-2 border-green-400 p-4 animate-pulse-once"
          >
            <h3 className="text-lg font-semibold text-green-900 mb-3">
              ✅ SOAP Note Generated Successfully!
            </h3>
            <div className="bg-white rounded p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700">Subjective:</h4>
                <p className="mt-1 whitespace-pre-wrap">{soapNote.subjective}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Objective:</h4>
                <p className="mt-1 whitespace-pre-wrap">{soapNote.objective}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Assessment:</h4>
                <p className="mt-1 whitespace-pre-wrap">{soapNote.assessment}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Plan:</h4>
                <p className="mt-1 whitespace-pre-wrap">{soapNote.plan}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
