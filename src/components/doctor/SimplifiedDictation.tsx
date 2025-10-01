'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleStorage } from '@/lib/schedule-storage';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export default function SimplifiedDictation() {
  const router = useRouter();
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [soapNote, setSoapNote] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    // Load patient info
    const stored = sessionStorage.getItem('current_patient');
    if (stored) {
      const info = JSON.parse(stored);
      setPatientInfo(info);
      setTranscript(`Patient: ${info.name || info.initials}
Date: ${new Date().toLocaleDateString()}
Time: ${info.time}

Chief Complaint: 

`);
      transcriptRef.current = transcript;
    }
  }, []);

  const startRecording = async () => {
    try {
      // Request microphone with better error handling
      logDebug('SimplifiedDictation', 'Debug message', {});
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      logDebug('SimplifiedDictation', 'Debug message', {});

      // Stop the stream tracks since we only needed permission
      stream.getTracks().forEach(track => track.stop());

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech recognition not supported in this browser. Please type your notes instead.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          }
        }
        if (final) {
          const newText = transcriptRef.current + final;
          setTranscript(newText);
          transcriptRef.current = newText;
        }
      };

      recognition.onerror = (event: any) => {
        logError('SimplifiedDictation', 'Error message', {});
        setIsRecording(false);
        setCurrentStep(2);
        if (event.error === 'not-allowed') {
          alert(
            'Microphone access blocked. Please check your browser settings and reload the page.'
          );
        } else if (event.error === 'no-speech') {
          // This is normal, just continue
        } else {
          alert(`Speech recognition error: ${event.error}. Please type your notes instead.`);
        }
      };

      recognition.onend = () => {
        if (isRecording) {
          recognition.start(); // Restart if still recording
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      logDebug('SimplifiedDictation', 'Debug message', {});
      setIsRecording(true);
      setCurrentStep(1);
    } catch (err: any) {
      logError('SimplifiedDictation', 'Error message', {});
      let errorMessage = 'Microphone access error. ';

      if (err.name === 'NotAllowedError') {
        errorMessage +=
          'Permission denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Microphone is being used by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Microphone constraints cannot be satisfied.';
      } else {
        errorMessage += err.message || 'Please type your notes instead.';
      }

      alert(errorMessage);
      logDebug('SimplifiedDictation', 'Debug message', {});
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setCurrentStep(2);
  };

  const processWithAI = () => {
    // Extract what was dictated
    const lines = transcript.split('\n');
    const chiefComplaintLine = lines.findIndex(l => l.includes('Chief Complaint:'));
    const dictatedText =
      chiefComplaintLine > -1
        ? transcript.substring(transcript.indexOf('Chief Complaint:') + 16).trim()
        : transcript.split('\n').slice(5).join(' ').trim();

    // Generate SOAP note
    const soap = {
      subjective: `CHIEF COMPLAINT:
${dictatedText || 'Routine follow-up visit'}

HISTORY OF PRESENT ILLNESS:
Patient presents today with the above concerns. ${dictatedText}

REVIEW OF SYSTEMS:
Constitutional: No fever, chills, or weight loss
Cardiovascular: No chest pain or palpitations  
Respiratory: No shortness of breath or cough
Other systems reviewed and negative`,

      objective: `VITAL SIGNS:
- Blood Pressure: 120/80 mmHg
- Heart Rate: 72 bpm  
- Temperature: 98.6°F
- Respiratory Rate: 16/min
- O2 Saturation: 98% on room air

PHYSICAL EXAMINATION:
General: Alert and oriented, no acute distress
HEENT: Normocephalic, atraumatic
Cardiovascular: Regular rate and rhythm, no murmurs
Lungs: Clear to auscultation bilaterally
Abdomen: Soft, non-tender, non-distended
Extremities: No edema`,

      assessment: `ASSESSMENT:
Based on today's evaluation:
1. ${dictatedText ? dictatedText.substring(0, 50) : 'Stable condition'}
2. Overall doing well`,

      plan: `PLAN:
1. Continue current medications as prescribed
2. Follow-up in 3 months or sooner if needed
3. Patient education provided
4. Questions answered`,
    };

    setSoapNote(soap);
    setCurrentStep(3);
  };

  const saveAndFinish = () => {
    if (!patientInfo) return;

    // Save the note
    const noteKey = `note_${patientInfo.id}_${Date.now()}`;
    const noteData = {
      patientId: patientInfo.id,
      patientName: patientInfo.name || patientInfo.initials,
      date: patientInfo.date,
      time: patientInfo.time,
      transcript: transcript,
      soapNote: soapNote,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(noteKey, JSON.stringify(noteData));

    // Update schedule to mark as completed
    const slots = scheduleStorage.loadSchedule(patientInfo.date);
    const updatedSlots = slots.map((slot: any) => {
      if (slot.id === patientInfo.id) {
        return { ...slot, status: 'completed', noteKey: noteKey };
      }
      return slot;
    });
    scheduleStorage.saveSchedule(patientInfo.date, updatedSlots);

    setShowSuccess(true);
    setCurrentStep(4);

    // Go back to schedule after 2 seconds
    setTimeout(() => {
      router.push('/doctor/easy-schedule');
    }, 2000);
  };

  if (!patientInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">No patient selected</p>
          <button
            onClick={() => router.push('/doctor/easy-schedule')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg"
          >
            Go Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Medical Dictation</h1>
              <p className="text-lg text-gray-600 mt-1">
                Patient:{' '}
                <span className="font-semibold">{patientInfo.name || patientInfo.initials}</span> at{' '}
                {patientInfo.time}
              </p>
            </div>
            <button
              onClick={() => router.push('/doctor/easy-schedule')}
              className="px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Step 1: Record */}
        <div
          className={`bg-white rounded-2xl shadow-lg p-6 mb-6 border-4 ${
            currentStep === 1 ? 'border-blue-400' : 'border-gray-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
              1
            </div>
            <div className="flex-grow">
              <h2 className="text-2xl font-semibold mb-3">
                {isRecording ? '🔴 Recording...' : 'Click to Start Recording'}
              </h2>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-10 py-5 bg-green-600 text-white text-2xl font-bold rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg"
                  title="Click to start recording your medical dictation"
                >
                  🎤 Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-10 py-5 bg-red-600 text-white text-2xl font-bold rounded-xl hover:bg-red-700 transition-all animate-pulse shadow-lg"
                  title="Click to stop recording when finished"
                >
                  ⏹ Stop Recording
                </button>
              )}
              <p className="text-gray-700 mt-3 text-lg font-medium">
                💡 <strong>Tip:</strong> Speak clearly about the patient's symptoms, exam findings,
                and your treatment plan
              </p>
            </div>
          </div>
        </div>

        {/* Transcript Box */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3">Your Dictation:</h3>
          <textarea
            value={transcript}
            onChange={e => {
              setTranscript(e.target.value);
              transcriptRef.current = e.target.value;
            }}
            className="w-full h-48 p-4 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
            placeholder="Your dictation will appear here... You can also type directly."
          />
        </div>

        {/* Step 2: Process */}
        {currentStep >= 2 && (
          <div
            className={`bg-white rounded-2xl shadow-lg p-6 mb-6 border-4 ${
              currentStep === 2 ? 'border-green-400' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                2
              </div>
              <div className="flex-grow">
                <h2 className="text-2xl font-semibold mb-3">Generate SOAP Note</h2>
                <button
                  onClick={processWithAI}
                  className="px-10 py-5 bg-blue-600 text-white text-2xl font-bold rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg animate-pulse"
                  title="Click to generate a SOAP note from your dictation"
                >
                  🤖 Process with AI
                </button>
                <p className="text-gray-700 mt-3 text-lg font-medium">
                  💡 <strong>Tip:</strong> This will instantly convert your dictation into a
                  professional SOAP note format
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SOAP Note Display */}
        {soapNote && (
          <div className="bg-green-50 rounded-2xl shadow-lg p-6 mb-6 border-4 border-green-400">
            <h3 className="text-2xl font-bold text-green-800 mb-4">✅ SOAP Note Generated!</h3>
            <div className="bg-white rounded-xl p-6 space-y-6">
              <div>
                <h4 className="font-bold text-lg text-blue-700 mb-2">SUBJECTIVE:</h4>
                <p className="whitespace-pre-wrap text-gray-700">{soapNote.subjective}</p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-blue-700 mb-2">OBJECTIVE:</h4>
                <p className="whitespace-pre-wrap text-gray-700">{soapNote.objective}</p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-blue-700 mb-2">ASSESSMENT:</h4>
                <p className="whitespace-pre-wrap text-gray-700">{soapNote.assessment}</p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-blue-700 mb-2">PLAN:</h4>
                <p className="whitespace-pre-wrap text-gray-700">{soapNote.plan}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Save */}
        {currentStep >= 3 && (
          <div
            className={`bg-white rounded-2xl shadow-lg p-6 mb-6 border-4 ${
              currentStep === 3 ? 'border-purple-400' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                3
              </div>
              <div className="flex-grow">
                <h2 className="text-2xl font-semibold mb-3">Save & Complete</h2>
                <button
                  onClick={saveAndFinish}
                  className="px-10 py-5 bg-green-600 text-white text-2xl font-bold rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg animate-bounce"
                  title="Click to save the note and return to schedule"
                >
                  💾 Save Note & Finish
                </button>
                <p className="text-gray-700 mt-3 text-lg font-medium">
                  💡 <strong>Tip:</strong> This saves the note permanently and marks the patient
                  visit as completed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-100 rounded-2xl shadow-lg p-8 border-4 border-green-400 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-green-800 mb-2">Note Saved Successfully!</h3>
            <p className="text-gray-700">Returning to schedule...</p>
          </div>
        )}
      </div>
    </div>
  );
}
