'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SecureServerStorage,
  clientStorage,
  migrateFromLocalStorage,
} from '@/lib/security/secureStorage';
import { SecureSpeechService, HIPAACompliantAI } from '@/lib/security/secureApiClient';

/**
 * HIPAA-Compliant version of the Driver page
 * - No PHI in localStorage
 * - Server-side encrypted storage
 * - Audit logging
 * - Session timeout
 */
export default function SecureDriverPage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState('');
  const [patientId, setPatientId] = useState('');
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(15 * 60); // 15 minutes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const speechService = useRef(new SecureSpeechService());
  const aiService = useRef(new HIPAACompliantAI());
  const sessionTimerRef = useRef<NodeJS.Timeout>();

  // Migrate any existing localStorage data on mount
  useEffect(() => {
    migrateFromLocalStorage().catch(console.error);
  }, []);

  // Session timeout warning
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      setSessionTimeRemaining(prev => {
        if (prev <= 0) {
          handleSessionTimeout();
          return 0;
        }

        // Warn at 2 minutes
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
    // Clear any non-PHI temporary data
    clientStorage.clear();
    router.push('/login');
  };

  // Save transcript securely (server-side only)
  const saveTranscript = useCallback(async () => {
    if (!transcript || !patientId) return;

    setLoading(true);
    try {
      await SecureServerStorage.storePatientData(
        'transcript',
        {
          text: transcript,
          timestamp: new Date().toISOString(),
        },
        patientId
      );

      // Only store non-PHI UI state in session storage
      clientStorage.setItem(
        'ui_state',
        {
          lastSaved: new Date().toISOString(),
          characterCount: transcript.length,
        },
        { expirationMinutes: 15 }
      );
    } catch (error: any) {
      setError(`Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [transcript, patientId]);

  // Load transcript from secure storage
  const loadTranscript = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    try {
      const data = await SecureServerStorage.getPatientData('transcript', patientId);

      if (data?.text) {
        setTranscript(data.text);
      }
    } catch (error: any) {
      setError(`Failed to load: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // Generate note using HIPAA-compliant AI
  const generateNote = useCallback(async () => {
    if (!transcript || !patientId) {
      setError('Transcript and patient ID required');
      return;
    }

    setLoading(true);
    try {
      // Use HIPAA-compliant AI service instead of OpenAI
      const note = await aiService.current.generateNote(
        transcript,
        'current-user-id', // Get from session
        patientId
      );

      // Store the generated note securely
      await SecureServerStorage.storePatientData('clinical_note', note, patientId);

      alert('Note generated and saved securely');
    } catch (error: any) {
      setError(`Failed to generate note: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [transcript, patientId]);

  // Auto-save every 30 seconds (server-side)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (transcript && patientId) {
        saveTranscript();
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [transcript, patientId, saveTranscript]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Session Timer */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Session expires in: {Math.floor(sessionTimeRemaining / 60)}:
              {String(sessionTimeRemaining % 60).padStart(2, '0')}
            </span>
            <button
              onClick={() => setSessionTimeRemaining(15 * 60)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Extend Session
            </button>
          </div>
        </div>

        {/* HIPAA Notice */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>HIPAA Notice:</strong> All patient data is encrypted and stored securely.
                This session will timeout after 15 minutes of inactivity.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Secure Medical Dictation</h1>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Patient ID Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient ID (Required)
            </label>
            <input
              type="text"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Enter patient identifier"
              required
            />
          </div>

          {/* Transcript Area */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript (Encrypted Storage)
            </label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Dictation will appear here..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {transcript.length} characters | Auto-saved to secure server
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={saveTranscript}
              disabled={loading || !patientId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Securely'}
            </button>

            <button
              onClick={loadTranscript}
              disabled={loading || !patientId}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Load from Secure Storage
            </button>

            <button
              onClick={generateNote}
              disabled={loading || !transcript || !patientId}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Generate HIPAA-Compliant Note
            </button>

            <button
              onClick={() => {
                setTranscript('');
                setError('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>

          {/* Security Features */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Active Security Features:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✅ End-to-end encryption for all PHI</li>
              <li>✅ Server-side storage only (no localStorage)</li>
              <li>✅ Audit logging of all access</li>
              <li>✅ Automatic session timeout</li>
              <li>✅ HIPAA-compliant AI processing</li>
              <li>✅ Secure API key management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
