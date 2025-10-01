'use client';
import React, { useState, useEffect, useRef } from 'react';
import { dictationService } from '@/services/dictation.service';
import { aiService, SOAPNote } from '@/services/ai.service';
import { patientService } from '@/services/patient.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface DictationBoxProps {
  patientId: string;
  visitDate: string;
  onSave?: (transcript: string, soap: SOAPNote | null) => void;
}

export default function DictationBox({ patientId, visitDate, onSave }: DictationBoxProps) {
  const [patient, setPatient] = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [error, setError] = useState('');
  const [soapNote, setSoapNote] = useState<SOAPNote | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPrint, setShowPrint] = useState(false);

  const transcriptRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load patient and generate template
  useEffect(() => {
    const patientData = patientService.getPatientById(patientId);
    if (patientData) {
      setPatient(patientData);
      const template = patientService.generateVisitTemplate(patientData, visitDate);
      setTranscript(template);
      transcriptRef.current = template;
    }
  }, [patientId, visitDate]);

  // Timer for recording duration
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  const startDictation = async () => {
    try {
      setError(''); // Clear any previous errors

      // First check if we're on HTTPS (required for microphone access)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setError('Microphone requires HTTPS. Please use https:// URL.');
        return;
      }

      // Check if speech recognition is supported
      if (!dictationService.isSupported()) {
        setError('Speech recognition not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      // Request microphone permission with echo cancellation
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Successfully got microphone access, now stop the stream as we only needed permission
        stream.getTracks().forEach(track => track.stop());
        logDebug('DictationBox', 'Debug message', {});
      } catch (micError: any) {
        logError('DictationBox', 'Error message', {});
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          // Check if permissions were previously denied
          if (navigator.permissions) {
            try {
              const result = await navigator.permissions.query({
                name: 'microphone' as PermissionName,
              });
              if (result.state === 'denied') {
                setError(
                  "Microphone access blocked. Please click the lock icon in your browser's address bar and allow microphone access for this site."
                );
              } else {
                setError('Microphone access denied. Please allow microphone access when prompted.');
              }
            } catch {
              setError(
                'Microphone access denied. Please check your browser settings and allow microphone access.'
              );
            }
          } else {
            setError(
              'Microphone access denied. Please allow microphone access in your browser settings.'
            );
          }
        } else if (micError.name === 'NotFoundError' || micError.name === 'DevicesNotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else if (micError.name === 'NotReadableError' || micError.name === 'TrackStartError') {
          setError(
            'Microphone is being used by another application. Please close other apps using the microphone and try again.'
          );
        } else {
          setError(`Microphone error: ${micError.name || micError.message || 'Unknown error'}`);
        }
        return;
      }

      const started = dictationService.start(
        (text, isFinal) => {
          if (isFinal) {
            transcriptRef.current += text;
            setTranscript(transcriptRef.current);
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        error => setError(error),
        status => setStatus(status)
      );

      if (!started) {
        setError('Failed to start speech recognition. Please try again.');
      }
    } catch (err: any) {
      logError('DictationBox', 'Error message', {});
      setError(`Error: ${err.message || 'Failed to start dictation'}`);
    }
  };

  const stopDictation = () => {
    dictationService.stop();
    setInterimText('');
    setStatus('idle');

    // Auto-process if we have new content
    if (transcript && transcript !== patientService.generateVisitTemplate(patient, visitDate)) {
      processWithAI();
    }
  };

  const processWithAI = async () => {
    if (!patient || status === 'processing') return;

    setStatus('processing');
    setError('');

    const result = await aiService.processToSOAP(transcript, patient, visitDate, {
      includeHistory: true,
      includeMentalHealth: true,
    });

    if (result.success && result.soap) {
      setSoapNote(result.soap);
      setShowPrint(true);
    } else {
      setError(result.error || 'Processing failed');
    }

    setStatus('idle');
  };

  const handleSave = () => {
    if (onSave) {
      onSave(transcript, soapNote);
    } else {
      // Default save behavior
      patientService.saveVisit({
        patientId,
        date: visitDate,
        dictation: transcript,
        soapNote,
      });
      alert('Visit saved successfully!');
    }
  };

  const printDocument = (type: 'soap' | 'full' | 'transcript') => {
    if (!patient) return;

    let content = '';
    let title = '';

    switch (type) {
      case 'soap':
        if (!soapNote) return;
        content = aiService.formatSOAPNote(soapNote, patient, visitDate);
        title = 'SOAP Note';
        break;
      case 'full':
        if (!soapNote) return;
        content =
          transcript +
          '\n\n=== SOAP NOTE ===\n\n' +
          aiService.formatSOAPNote(soapNote, patient, visitDate);
        title = 'Complete Visit';
        break;
      case 'transcript':
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
                max-width: 800px; 
                margin: 40px auto;
                line-height: 1.6;
              }
              pre { 
                white-space: pre-wrap; 
                font-family: 'Courier New', monospace;
                background: #f5f5f5;
                padding: 20px;
                border-radius: 5px;
              }
              .header {
                background: #f0f0f0;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
              }
              h1 { 
                color: #333; 
                border-bottom: 2px solid #333; 
                padding-bottom: 10px;
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
              <p><strong>Date:</strong> ${visitDate}</p>
              <p><strong>Provider:</strong> Dr. Musk</p>
            </div>
            <pre>${content}</pre>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666;">
              Generated: ${new Date().toLocaleString()}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!patient) {
    return <div>Loading patient data...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Medical Dictation</h3>
            {status === 'listening' && (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-600">Recording</span>
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {formatTime(recordingTime)}
                </span>
              </div>
            )}
            {status === 'processing' && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing...</span>
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
              disabled={status === 'processing' || !transcript}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Process with AI
            </button>

            {showPrint && soapNote && (
              <div className="relative group">
                <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  Print
                </button>
                <div className="absolute right-0 top-12 bg-white border rounded-lg shadow-lg p-2 hidden group-hover:block min-w-[160px]">
                  <button
                    onClick={() => printDocument('soap')}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  >
                    SOAP Note
                  </button>
                  <button
                    onClick={() => printDocument('full')}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  >
                    Complete Visit
                  </button>
                  <button
                    onClick={() => printDocument('transcript')}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  >
                    Transcript Only
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-800 mb-2">{error}</p>
            {error.includes('Microphone') && (
              <div className="text-xs text-red-600 space-y-1">
                <p>
                  <strong>Alternative:</strong> You can type your notes directly in the text box
                  below.
                </p>
                <p>
                  <strong>Browser Support:</strong> Voice dictation works best in Chrome or Edge
                  browsers.
                </p>
                {window.location.protocol !== 'https:' &&
                  window.location.hostname !== 'localhost' && (
                    <p>
                      <strong>Security:</strong> Microphone access requires HTTPS connection.
                    </p>
                  )}
              </div>
            )}
          </div>
        )}

        {interimText && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-semibold text-blue-900">Hearing: </span>
            <span className="text-sm text-blue-700 italic">{interimText}</span>
          </div>
        )}
      </div>

      {/* Main Transcript */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-700">Visit Note</h4>
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
          className="w-full h-96 p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
        />
      </div>

      {/* SOAP Note Display */}
      {soapNote && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <h3 className="text-lg font-semibold text-green-900 mb-3">AI Generated SOAP Note</h3>
          <div className="bg-white rounded p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap">
              {aiService.formatSOAPNote(soapNote, patient, visitDate)}
            </pre>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Save Visit Note
        </button>
      </div>
    </div>
  );
}
