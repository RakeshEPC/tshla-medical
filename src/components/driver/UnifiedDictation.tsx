"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { templateStorage } from "@/lib/templateStorage";
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface UnifiedDictationProps {
  patient: any;
  visitDate: string;
  onSave: (text: string, soapNote: any) => void;
}

export default function UnifiedDictation({ patient, visitDate, onSave }: UnifiedDictationProps) {
  // Pre-populate with complete patient context
  const getInitialText = () => {
    let text = `=== PATIENT INFORMATION ===\n`;
    text += `Name: ${patient.firstName} ${patient.lastName}\n`;
    text += `ID: ${patient.id} | AVA: ${patient.avaId}\n`;
    text += `Date of Birth: ${patient.dob}\n`;
    text += `Visit Date: ${visitDate}\n\n`;
    
    text += `=== ACTIVE CONDITIONS ===\n`;
    patient.conditions
      ?.filter((c: any) => c.status !== 'resolved')
      .forEach((c: any) => {
        text += `• ${c.name} (${c.icd10}) - Since ${c.diagnosisDate}\n`;
        if (c.notes) text += `  Notes: ${c.notes}\n`;
      });
    
    text += `\n=== CURRENT MEDICATIONS ===\n`;
    patient.medications
      ?.filter((m: any) => m.status === 'active')
      .forEach((m: any) => {
        text += `• ${m.name} ${m.dosage} ${m.frequency}\n`;
        text += `  Started: ${m.startDate} | Effectiveness: ${m.effectiveness || 'Not assessed'}\n`;
      });
    
    text += `\n=== RECENT LABS ===\n`;
    patient.labs?.slice(0, 5).forEach((l: any) => {
      const flag = l.abnormal ? ` [${l.abnormal}]` : '';
      text += `• ${l.name}: ${l.value} ${l.unit}${flag} (${l.date})\n`;
    });
    
    // Add mental health screening scores if available
    const phq9 = patient.screeningScores?.PHQ9;
    const gad7 = patient.screeningScores?.GAD7;
    
    if (phq9 || gad7) {
      text += `\n=== MENTAL HEALTH SCREENING ===\n`;
      if (phq9) {
        text += `PHQ-9 Score: ${phq9.score} - ${phq9.severity}\n`;
        text += `  Date: ${phq9.date}\n`;
        if (phq9.score >= 10) {
          text += `  ⚠️ Moderate to severe depression - consider treatment\n`;
        }
      }
      if (gad7) {
        text += `GAD-7 Score: ${gad7.score} - ${gad7.severity}\n`;
        text += `  Date: ${gad7.date}\n`;
        if (gad7.score >= 10) {
          text += `  ⚠️ Moderate to severe anxiety - evaluate management\n`;
        }
      }
    }
    
    // Add last visit info
    if (patient.visitHistory && patient.visitHistory.length > 0) {
      const lastVisit = patient.visitHistory[0];
      text += `\n=== LAST VISIT (${lastVisit.date}) ===\n`;
      text += `Chief Complaint: ${lastVisit.chiefComplaint}\n`;
      text += `Assessment: ${lastVisit.assessment}\n`;
      text += `Plan: ${lastVisit.plan}\n`;
    }
    
    text += `\n=== TODAY'S VISIT ===\n\n`;
    text += `CHIEF COMPLAINT:\n[Start dictating here...]\n\n`;
    text += `HPI:\n\n`;
    text += `ROS:\n\n`;
    text += `PHYSICAL EXAM:\n\n`;
    text += `ASSESSMENT:\n\n`;
    text += `PLAN:\n\n`;
    
    return text;
  };

  const [transcript, setTranscript] = useState(getInitialText());
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [soapNote, setSoapNote] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<Date | null>(null);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef(getInitialText());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const processTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartAttemptsRef = useRef(0);
  const maxRestartAttempts = 5;

  // Initialize speech recognition once
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    
    // Optimal settings for continuous medical dictation
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      logDebug('UnifiedDictation', 'Debug message', {});
      setError("");
      setIsListening(true);
      isListeningRef.current = true;
      restartAttemptsRef.current = 0; // Reset restart counter
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          final += text + ' ';
        } else {
          interim = text;
        }
      }

      // Add final text to transcript
      if (final) {
        const newTranscript = transcriptRef.current + final;
        transcriptRef.current = newTranscript;
        setTranscript(newTranscript);
        logDebug('UnifiedDictation', 'Debug message', {}); + '...');
      }
      
      // Always show interim for immediate feedback
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      logError('UnifiedDictation', 'Error message', {});
      
      // Handle specific errors
      if (event.error === 'no-speech') {
        // Normal during pauses, just continue
        return;
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
        stopListening();
        return;
      } else if (event.error === 'network') {
        // Network issue, attempt restart
        attemptRestart();
        return;
      } else if (event.error === 'aborted') {
        // Session aborted, restart if still listening
        if (isListeningRef.current) {
          attemptRestart();
        }
        return;
      }
      
      // For other errors, try to recover
      if (isListeningRef.current) {
        attemptRestart();
      }
    };

    recognition.onend = () => {
      logDebug('UnifiedDictation', 'Debug message', {});
      setInterimTranscript("");
      
      // If we should still be listening, restart
      if (isListeningRef.current) {
        logDebug('UnifiedDictation', 'Debug message', {});
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              logDebug('UnifiedDictation', 'Debug message', {});
              attemptRestart();
            }
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Attempt to restart recognition with exponential backoff
  const attemptRestart = useCallback(() => {
    if (restartAttemptsRef.current >= maxRestartAttempts) {
      setError('Unable to maintain connection. Please refresh and try again.');
      stopListening();
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, restartAttemptsRef.current), 5000);
    restartAttemptsRef.current++;
    
    logDebug('UnifiedDictation', 'Debug message', {});
    
    setTimeout(() => {
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          logDebug('UnifiedDictation', 'Debug message', {});
          attemptRestart();
        }
      }
    }, delay);
  }, []);

  // Timer for recording duration
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isListening]);

  // Auto-process with AI every 60 seconds while recording
  useEffect(() => {
    if (isListening) {
      processTimerRef.current = setInterval(() => {
        logDebug('UnifiedDictation', 'Debug message', {});
        processWithAI();
      }, 60000); // Every 60 seconds
    } else {
      if (processTimerRef.current) {
        clearInterval(processTimerRef.current);
        processTimerRef.current = null;
      }
    }
    
    return () => {
      if (processTimerRef.current) {
        clearInterval(processTimerRef.current);
      }
    };
  }, [isListening]);

  const startListening = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      
      // Reset state
      setError("");
      setRecordingTime(0);
      isListeningRef.current = true;
      restartAttemptsRef.current = 0;
      
      // Start recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
        logDebug('UnifiedDictation', 'Debug message', {});
      }
    } catch (err) {
      logError('UnifiedDictation', 'Error message', {});
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopListening = () => {
    logDebug('UnifiedDictation', 'Debug message', {});
    isListeningRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (processTimerRef.current) {
      clearInterval(processTimerRef.current);
      processTimerRef.current = null;
    }
    
    setIsListening(false);
    setInterimTranscript("");
    setRecordingTime(0);
    
    // Do final AI processing when stopping
    if (transcript && transcript !== getInitialText()) {
      processWithAI();
    }
  };

  const processWithAI = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          meta: {
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            visitDate,
            conditions: patient.conditions,
            medications: patient.medications,
            labs: patient.labs,
            lastVisit: patient.visitHistory?.[0]
          },
          mergeHistory: true
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setSoapNote(result.soap);
        setLastProcessedAt(new Date());
        logInfo('UnifiedDictation', 'Info message', {});
      }
    } catch (error) {
      logError('UnifiedDictation', 'Error message', {});
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSOAPNote = (soap: any) => {
    if (!soap) return '';
    
    let formatted = `DATE OF SERVICE: ${visitDate}\n`;
    formatted += `PATIENT: ${patient.firstName} ${patient.lastName} (${patient.id})\n\n`;
    
    // Include mental health scores in the note
    const phq9 = patient.screeningScores?.PHQ9;
    const gad7 = patient.screeningScores?.GAD7;
    
    formatted += `SUBJECTIVE:\n${soap.subjective || soap.S || ''}\n`;
    
    if (phq9 || gad7) {
      formatted += `\nMental Health Screening Results:\n`;
      if (phq9) formatted += `• PHQ-9: ${phq9.score} (${phq9.severity})\n`;
      if (gad7) formatted += `• GAD-7: ${gad7.score} (${gad7.severity})\n`;
    }
    
    formatted += `\nOBJECTIVE:\n${soap.objective || soap.O || ''}\n\n`;
    formatted += `ASSESSMENT:\n${soap.assessment || soap.A || ''}\n\n`;
    formatted += `PLAN:\n${soap.plan || soap.P || ''}`;
    
    return formatted;
  };

  const printDocument = (type: 'soap' | 'full' | 'dictation') => {
    let content = '';
    let title = '';
    
    switch (type) {
      case 'soap':
        content = formatSOAPNote(soapNote);
        title = 'SOAP Note';
        break;
      case 'full':
        content = transcript + '\n\n=== AI PROCESSED SOAP ===\n\n' + formatSOAPNote(soapNote);
        title = 'Complete Visit Documentation';
        break;
      case 'dictation':
        content = transcript;
        title = 'Dictation Transcript';
        break;
    }
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${patient.firstName} ${patient.lastName} - ${title}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                line-height: 1.6;
                max-width: 800px;
                margin: 40px auto;
              }
              h1 { 
                color: #333; 
                border-bottom: 2px solid #333; 
                padding-bottom: 10px; 
              }
              pre { 
                white-space: pre-wrap; 
                font-family: 'Courier New', monospace;
                background: #f5f5f5;
                padding: 20px;
                border-radius: 5px;
              }
              .header { 
                margin-bottom: 20px;
                background: #f0f0f0;
                padding: 15px;
                border-radius: 5px;
              }
              .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #ccc; 
                font-size: 12px; 
                color: #666; 
              }
              @media print {
                body { margin: 20px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${title}</h1>
              <p><strong>Patient:</strong> ${patient.firstName} ${patient.lastName} (${patient.id})</p>
              <p><strong>Date of Service:</strong> ${visitDate}</p>
              <p><strong>Provider:</strong> Dr. Musk</p>
            </div>
            <pre>${content}</pre>
            <div class="footer">
              <p>Generated: ${new Date().toLocaleString()}</p>
              <p>This document contains confidential patient information</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Medical Dictation</h3>
            {isListening && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-600 font-medium">Recording</span>
                </div>
                <div className="px-3 py-1 bg-gray-100 rounded-lg font-mono text-sm">
                  {formatTime(recordingTime)}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {!isListening ? (
              <button
                onClick={startListening}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Dictation
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop & Process
              </button>
            )}
            
            <button
              onClick={processWithAI}
              disabled={isProcessing || transcript === getInitialText()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Process with AI
                </>
              )}
            </button>
            
            {/* Print Button - Only show after processing */}
            {soapNote && (
              <div className="relative">
                <button
                  onClick={() => setShowPrintMenu(!showPrintMenu)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                
                {showPrintMenu && (
                  <div className="absolute right-0 top-12 bg-white border rounded-lg shadow-lg p-2 z-10 min-w-[180px]">
                    <button
                      onClick={() => {
                        printDocument('soap');
                        setShowPrintMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded text-sm"
                    >
                      Print SOAP Note
                    </button>
                    <button
                      onClick={() => {
                        printDocument('full');
                        setShowPrintMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded text-sm"
                    >
                      Print Full Documentation
                    </button>
                    <button
                      onClick={() => {
                        printDocument('dictation');
                        setShowPrintMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded text-sm"
                    >
                      Print Dictation Only
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            {isListening && (
              <>
                <span>✓ Auto-saves every minute</span>
                <span>✓ Continuous recording active</span>
                {lastProcessedAt && (
                  <span>Last processed: {lastProcessedAt.toLocaleTimeString()}</span>
                )}
              </>
            )}
          </div>
          <span>{transcript.split(' ').filter(w => w).length} words</span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Real-time Transcript */}
        {interimTranscript && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-semibold text-blue-900">Hearing: </span>
            <span className="text-sm text-blue-700 italic">{interimTranscript}</span>
          </div>
        )}
      </div>

      {/* Main Visit Note */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-700">Visit Note</h4>
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              Processing with AI...
            </div>
          )}
        </div>
        
        <textarea
          value={transcript}
          onChange={(e) => {
            const newText = e.target.value;
            setTranscript(newText);
            transcriptRef.current = newText;
          }}
          className="w-full h-[500px] p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
          placeholder="Patient information will appear here..."
        />
      </div>

      {/* AI Generated SOAP Note */}
      {soapNote && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-green-900">AI Generated SOAP Note</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                Last updated: {lastProcessedAt?.toLocaleTimeString()}
              </span>
              <button
                onClick={() => printDocument('soap')}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                Quick Print
              </button>
            </div>
          </div>
          <div className="bg-white rounded p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{formatSOAPNote(soapNote)}</pre>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => onSave(transcript, soapNote)}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Save Visit Note
        </button>
      </div>
    </div>
  );
}