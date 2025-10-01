"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface ContinuousDictationProps {
  initialText: string;
  onTextChange: (text: string) => void;
  maxDuration?: number; // in minutes, default 30
}

export default function ContinuousDictation({ 
  initialText, 
  onTextChange,
  maxDuration = 30 
}: ContinuousDictationProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(initialText);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [supportsSpeech, setSupportsSpeech] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const finalTranscriptRef = useRef(initialText);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setSupportsSpeech(true);
      const recognition = new SpeechRecognition();
      
      // Critical settings for continuous recording
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        logDebug('ContinuousDictation', 'Debug message', {});
        setError("");
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        // Process all results from the current recognition session
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          
          if (result.isFinal) {
            finalText += transcriptText + ' ';
          } else {
            interimText += transcriptText;
          }
        }

        // Update final transcript if we have final results
        if (finalText) {
          const newTranscript = finalTranscriptRef.current + finalText;
          finalTranscriptRef.current = newTranscript;
          setTranscript(newTranscript);
          onTextChange(newTranscript);
          logInfo('ContinuousDictation', 'Info message', {}); + '...');
        }
        
        // Always show interim results for real-time feedback
        setInterimTranscript(interimText);
      };

      recognition.onerror = (event: any) => {
        logError('ContinuousDictation', 'Error message', {});
        
        // Handle different error types
        if (event.error === 'no-speech') {
          // This is normal during pauses in speech, just continue
          logDebug('ContinuousDictation', 'Debug message', {});
          return;
        } else if (event.error === 'audio-capture') {
          setError('No microphone was found. Please ensure a microphone is connected.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access and reload.');
        } else if (event.error === 'network') {
          // Network error, try to restart
          logDebug('ContinuousDictation', 'Debug message', {});
          restartRecognition();
          return;
        }
        
        // For other errors, try to recover
        if (isListeningRef.current && event.error !== 'not-allowed') {
          logDebug('ContinuousDictation', 'Debug message', {});
          restartRecognition();
        }
      };

      recognition.onend = () => {
        logDebug('ContinuousDictation', 'Debug message', {});
        setInterimTranscript("");
        
        // If we're still supposed to be listening, restart immediately
        if (isListeningRef.current) {
          logDebug('ContinuousDictation', 'Debug message', {});
          restartRecognition();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setSupportsSpeech(false);
      setError("Your browser doesn't support speech recognition. Please use Chrome or Edge.");
    }

    return () => {
      stopListening();
    };
  }, [onTextChange]);

  // Restart recognition with a small delay to prevent rapid restarts
  const restartRecognition = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    restartTimeoutRef.current = setTimeout(() => {
      if (recognitionRef.current && isListeningRef.current) {
        try {
          recognitionRef.current.start();
          logInfo('ContinuousDictation', 'Info message', {});
        } catch (e) {
          logDebug('ContinuousDictation', 'Debug message', {});
          // Try again in a second
          setTimeout(() => {
            if (recognitionRef.current && isListeningRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e2) {
                logDebug('ContinuousDictation', 'Debug message', {});
              }
            }
          }, 1000);
        }
      }
    }, 250);
  }, []);

  // Timer for recording duration
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Check max duration (convert minutes to seconds)
          if (newTime >= maxDuration * 60) {
            logDebug('ContinuousDictation', 'Debug message', {});
            stopListening();
            return prev;
          }
          return newTime;
        });
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
  }, [isListening, maxDuration]);

  const startListening = async () => {
    if (!supportsSpeech) {
      setError("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      
      // Reset state
      setError("");
      setRecordingTime(0);
      isListeningRef.current = true;
      
      // Start recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          logDebug('ContinuousDictation', 'Debug message', {});
        } catch (e) {
          logError('ContinuousDictation', 'Error message', {});
          setError('Failed to start recording. Please try again.');
        }
      }
    } catch (err) {
      logError('ContinuousDictation', 'Error message', {});
      setError('Could not access microphone. Please check permissions.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    logDebug('ContinuousDictation', 'Debug message', {});
    isListeningRef.current = false;
    
    // Clear any restart timeouts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        logDebug('ContinuousDictation', 'Debug message', {});
      }
    }
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsListening(false);
    setInterimTranscript("");
  };

  const clearTranscript = () => {
    setTranscript(initialText);
    finalTranscriptRef.current = initialText;
    onTextChange(initialText);
    setInterimTranscript("");
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Continuous Voice Dictation</h3>
            {isListening && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-600 font-medium">Recording</span>
                </div>
                <div className="px-3 py-1 bg-gray-100 rounded-lg">
                  <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Max: {maxDuration} min
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {!isListening ? (
              <button
                onClick={startListening}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop Recording
              </button>
            )}
            
            <button
              onClick={clearTranscript}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Real-time Transcript Display */}
        {interimTranscript && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-sm font-semibold text-blue-900">Hearing:</span>
              <p className="text-sm text-blue-700 italic flex-1">{interimTranscript}</p>
            </div>
          </div>
        )}
        
        {/* Connection Status */}
        {isListening && (
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </div>
            <span>•</span>
            <span>Continuous mode active</span>
            <span>•</span>
            <span>Auto-restart enabled</span>
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
          onChange={(e) => {
            const newText = e.target.value;
            setTranscript(newText);
            finalTranscriptRef.current = newText;
            onTextChange(newText);
          }}
          className="w-full h-96 p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
          placeholder="Click 'Start Recording' to begin continuous dictation..."
        />
        
        {/* Status Bar */}
        <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
          <div>
            {isListening ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="3" />
                </svg>
                Listening for speech...
              </span>
            ) : (
              <span>Ready to record</span>
            )}
          </div>
          <div>
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Features:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Continuous recording up to {maxDuration} minutes</li>
          <li>Auto-restart if connection drops</li>
          <li>Real-time transcription with interim results</li>
          <li>Manual editing supported during recording</li>
          <li>Automatic punctuation and capitalization</li>
          <li>Works best in quiet environments</li>
        </ul>
      </div>
    </div>
  );
}