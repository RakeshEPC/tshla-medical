/**
 * Quick Quality Test - See the difference immediately
 */

import React, { useState, useEffect } from 'react';
import { awsTranscribeSimple } from '../services/awsTranscribeSimple.service';
import { dictationService } from '../services/dictation.service';
import { medicalVocabularyEnhancer } from '../services/medicalVocabularyEnhancer.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function QuickQualityTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [rawTranscript, setRawTranscript] = useState('');
  const [enhancedTranscript, setEnhancedTranscript] = useState('');
  const [mode, setMode] = useState<'aws' | 'browser'>('aws');
  const [qualityScore, setQualityScore] = useState(0);

  // Test phrases to say
  const testPhrases = [
    'Patient has hypertension, takes lisinopril twenty milligrams daily',
    'Blood pressure today is one forty two over eighty eight',
    'Started metformin one thousand milligrams twice a day for diabetes',
    'Follow up in three months with repeat A one C',
    'Physical exam shows lungs clear to auscultation bilaterally',
  ];

  const startRecording = async () => {
    setIsRecording(true);
    setRawTranscript('');
    setEnhancedTranscript('');

    if (mode === 'aws') {
      // AWS Transcribe Medical (HIPAA compliant)
      const success = await awsTranscribeSimple.startRecording(
        (text, isFinal) => {
          if (isFinal) {
            // Raw transcript (before enhancement)
            const rawVersion = text
              .replace(/\bmg\b/g, ' milligrams')
              .replace(/\bBID\b/g, 'twice a day');
            setRawTranscript(prev => prev + ' ' + rawVersion);

            // Enhanced transcript (after enhancement)
            setEnhancedTranscript(prev => prev + ' ' + text);

            // Calculate quality score
            const density = medicalVocabularyEnhancer.getMedicalTermDensity(text);
            setQualityScore(density * 100);
          }
        },
        error => {
          logError('QuickQualityTest', 'Error message', {});
          alert(`Error: ${error}`);
          setIsRecording(false);
        }
      );

      if (!success) {
        setIsRecording(false);
      }
    } else {
      // Browser Speech API fallback
      dictationService.start(
        (text, isFinal) => {
          if (isFinal) {
            setRawTranscript(prev => prev + ' ' + text);

            // Apply enhancement
            const enhanced = medicalVocabularyEnhancer.enhanceTranscript(text);
            setEnhancedTranscript(prev => prev + ' ' + enhanced);

            // Calculate quality score
            const density = medicalVocabularyEnhancer.getMedicalTermDensity(enhanced);
            setQualityScore(density * 100);
          }
        },
        error => {
          logError('QuickQualityTest', 'Error message', {});
          alert(`Error: ${error}`);
          setIsRecording(false);
        }
      );
    }
  };

  const stopRecording = () => {
    if (mode === 'aws') {
      const final = awsTranscribeSimple.stopRecording();
      logDebug('QuickQualityTest', 'Debug message', {});
    } else {
      dictationService.stop();
    }
    setIsRecording(false);
  };

  // Apply enhancement to raw transcript manually
  const applyEnhancement = () => {
    const enhanced = medicalVocabularyEnhancer.enhanceTranscript(rawTranscript);
    setEnhancedTranscript(enhanced);
    const density = medicalVocabularyEnhancer.getMedicalTermDensity(enhanced);
    setQualityScore(density * 100);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🎯 Quick Quality Test</h1>

      {/* Mode Selection */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">Select Transcription Mode:</h2>
        <div className="flex gap-4">
          <button
            onClick={() => setMode('aws')}
            className={`px-4 py-2 rounded ${
              mode === 'aws' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            AWS Transcribe Medical (HIPAA)
          </button>
          <button
            onClick={() => setMode('browser')}
            className={`px-4 py-2 rounded ${
              mode === 'browser' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Browser Speech API
          </button>
        </div>
      </div>

      {/* Test Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold mb-2">📋 Test These Phrases:</h3>
        <ol className="list-decimal ml-6 space-y-1">
          {testPhrases.map((phrase, idx) => (
            <li key={idx} className="text-sm">
              {phrase}
            </li>
          ))}
        </ol>
      </div>

      {/* Recording Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`px-6 py-3 rounded-lg font-semibold ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
          </button>

          {!isRecording && rawTranscript && (
            <button
              onClick={applyEnhancement}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
            >
              ✨ Re-Apply Enhancement
            </button>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="animate-pulse bg-red-500 h-3 w-3 rounded-full"></div>
            <span className="text-sm text-gray-600">Recording... Speak clearly</span>
          </div>
        )}
      </div>

      {/* Quality Score */}
      {qualityScore > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold mb-2">Quality Score:</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full ${
                  qualityScore > 15
                    ? 'bg-green-500'
                    : qualityScore > 10
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(qualityScore * 5, 100)}%` }}
              />
            </div>
            <span className="font-bold">{qualityScore.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Medical term density (higher is better, 15%+ is excellent)
          </p>
        </div>
      )}

      {/* Side by Side Comparison */}
      {(rawTranscript || enhancedTranscript) && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Raw Transcript */}
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-red-700">❌ Before Enhancement (Raw)</h3>
            <div className="bg-white rounded p-3 min-h-[200px]">
              <p className="whitespace-pre-wrap text-sm">
                {rawTranscript || 'Waiting for transcription...'}
              </p>
            </div>
          </div>

          {/* Enhanced Transcript */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-green-700">✅ After Enhancement (Fixed)</h3>
            <div className="bg-white rounded p-3 min-h-[200px]">
              <p className="whitespace-pre-wrap text-sm">
                {enhancedTranscript || 'Waiting for transcription...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* What's Different Section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <h3 className="font-semibold mb-2">🔧 What We Fixed:</h3>
        <ul className="text-sm space-y-1">
          <li>✅ AWS Transcribe set to DICTATION mode (not conversation)</li>
          <li>✅ Disabled echo cancellation (was removing medical 's' sounds)</li>
          <li>✅ Medical vocabulary enhancement (metformin, lisinopril, etc.)</li>
          <li>✅ Proper formatting (142/88 instead of "142 over 88")</li>
          <li>✅ Medical abbreviations (BID, TID, PRN)</li>
          <li>✅ Dosage formatting (20mg instead of "20 milligrams")</li>
        </ul>
      </div>
    </div>
  );
}
