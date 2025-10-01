'use client';
import React, { useState, useEffect, useRef } from 'react';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface SimpleDictationProps {
  initialText: string;
  onTextChange: (text: string) => void;
}

export default function SimpleDictation({ initialText, onTextChange }: SimpleDictationProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(initialText);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [supportsSpeech, setSupportsSpeech] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSupportsSpeech(true);
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        logDebug('SimpleDictation', 'Debug message', {});
        setError('');
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onresult = (event: any) => {
        logDebug('SimpleDictation', 'Debug message', {});
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript + ' ';
          } else {
            interimText += result[0].transcript;
          }
        }

        if (finalText) {
          const newTranscript = transcript + finalText;
          setTranscript(newTranscript);
          onTextChange(newTranscript);
          logInfo('SimpleDictation', 'Info message', {});
        }

        setInterimTranscript(interimText);
      };

      recognition.onerror = (event: any) => {
        logError('SimpleDictation', 'Error message', {});
        setError(`Error: ${event.error}`);

        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access and try again.');
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Please speak clearly into your microphone.');
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        logDebug('SimpleDictation', 'Debug message', {});
        // Auto-restart if we're still supposed to be listening
        if (isListeningRef.current) {
          logDebug('SimpleDictation', 'Debug message', {});
          setTimeout(() => {
            if (recognitionRef.current && isListeningRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                logDebug('SimpleDictation', 'Debug message', {});
              }
            }
          }, 100);
        } else {
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
    } else {
      setSupportsSpeech(false);
      setError("Your browser doesn't support speech recognition. Please use Chrome or Edge.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [transcript, onTextChange]);

  const startListening = async () => {
    if (!supportsSpeech) {
      // Fallback to demo mode
      startDemoMode();
      return;
    }

    try {
      // Request microphone permission explicitly
      await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      if (recognitionRef.current) {
        recognitionRef.current.start();
        logDebug('SimpleDictation', 'Debug message', {});
      }
    } catch (err) {
      logError('SimpleDictation', 'Error message', {});
      setError('Could not access microphone. Starting demo mode...');
      startDemoMode();
    }
  };

  const stopListening = () => {
    isListeningRef.current = false; // Set ref to false FIRST
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript('');

    // Stop demo mode if running
    if ((window as any).demoInterval) {
      clearInterval((window as any).demoInterval);
    }
  };

  const startDemoMode = () => {
    setIsListening(true);
    setError('');

    const demoSentences = [
      'Patient presents today for routine follow-up. ',
      'She reports good compliance with medications. ',
      'Blood sugars have been well controlled. ',
      'Morning readings range from 95 to 120. ',
      'No episodes of hypoglycemia noted. ',
      'She denies any chest pain or shortness of breath. ',
      'Review of systems is otherwise negative. ',
      'Physical exam shows blood pressure 124 over 76. ',
      'Heart rate is 72 and regular. ',
      'Lungs are clear to auscultation bilaterally. ',
      'No lower extremity edema noted. ',
      'Will continue current medication regimen. ',
      'Recommend follow-up in three months. ',
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < demoSentences.length) {
        // Show as interim first
        setInterimTranscript(demoSentences[index]);

        // Then add to final transcript after a delay
        setTimeout(() => {
          const newTranscript = transcript + demoSentences[index];
          setTranscript(newTranscript);
          onTextChange(newTranscript);
          setInterimTranscript('');
          logDebug('SimpleDictation', 'Debug message', {});
        }, 300);

        index++;
      } else {
        clearInterval(interval);
        setIsListening(false);
        logInfo('SimpleDictation', 'Info message', {});
      }
    }, 1500);

    (window as any).demoInterval = interval;
  };

  const clearTranscript = () => {
    setTranscript(initialText);
    onTextChange(initialText);
    setInterimTranscript('');
  };

  return (
    <div className="w-full space-y-4">
      {/* Status Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Voice Dictation</h3>
            {isListening && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-600 font-medium">Recording...</span>
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                Stop Recording
              </button>
            )}

            <button
              onClick={clearTranscript}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear New Text
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Browser Support */}
        {!supportsSpeech && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              Speech recognition not supported. Demo mode will be used instead.
            </p>
          </div>
        )}

        {/* Interim Transcript Display */}
        {interimTranscript && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg animate-pulse">
            <p className="text-sm text-blue-700 italic">
              <span className="font-semibold">Hearing:</span> {interimTranscript}
            </p>
          </div>
        )}
      </div>

      {/* Main Transcript Area */}
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
            onTextChange(e.target.value);
          }}
          className="w-full h-96 p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
          placeholder="Click 'Start Recording' to begin dictation or type here..."
        />

        {/* Live Feedback */}
        {isListening && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-green-500 animate-pulse"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span>Listening for speech... Speak clearly into your microphone</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How to Use:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Click "Start Recording" to begin voice dictation</li>
          <li>Speak clearly into your microphone</li>
          <li>Watch your words appear in real-time (blue box shows what's being heard)</li>
          <li>Click "Stop Recording" when finished</li>
          <li>Edit the text manually if needed</li>
          <li>If microphone doesn't work, demo mode will activate automatically</li>
        </ol>
      </div>
    </div>
  );
}
