/**
 * Audio Summary Modal
 * Allows provider to send patient audio summary via phone call
 * Shows AI-generated script preview and initiates Twilio call
 */

import React, { useState } from 'react';
import { elevenLabsService } from '../../services/elevenLabs.service';

interface AudioSummaryModalProps {
  soapNote: string;
  patientName?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Available ElevenLabs voices (friendly, conversational)
const AVAILABLE_VOICES = [
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'Young female, conversational (recommended)' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Young male, conversational' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Middle-aged female, educational' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', description: 'Neutral gender, conversational' },
];

export const AudioSummaryModal: React.FC<AudioSummaryModalProps> = ({
  soapNote,
  patientName,
  isOpen,
  onClose
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(AVAILABLE_VOICES[0].id); // Default to Jessica
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call backend to generate AI script
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/echo/generate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soapNote })
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const data = await response.json();
      setGeneratedScript(data.script);

      // Generate audio preview locally with selected voice
      const audioResult = await elevenLabsService.generateSpeech(data.script, selectedVoice);
      setAudioPreviewUrl(audioResult.audioUrl);

    } catch (err: any) {
      setError(err.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCall = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/echo/send-audio-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soapNote,
          phoneNumber: formattedPhone,
          patientName,
          voiceId: selectedVoice
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send audio summary');
      }

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setCallSid(data.data.callSid);
        setGeneratedScript(data.data.script);

        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
        }, 3000);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to send audio summary');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/echo/send-sms-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soapNote,
          phoneNumber: formattedPhone,
          patientName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send SMS');
      }

      const data = await response.json();

      if (data.success) {
        setSmsSuccess(true);
        setGeneratedScript(data.data.smsText);

        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
        }, 3000);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPhoneNumber('');
    setSelectedVoice(AVAILABLE_VOICES[0].id);
    setError(null);
    setSuccess(false);
    setSmsSuccess(false);
    setGeneratedScript(null);
    setAudioPreviewUrl(null);
    setCallSid(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            📞 Send Patient Audio Summary
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {success || smsSuccess ? (
          // Success State
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-green-900 mb-2">
              {success ? 'Call Initiated Successfully!' : 'SMS Sent Successfully!'}
            </h3>
            <p className="text-green-700 mb-2">
              {success
                ? 'Patient will receive the audio summary call shortly.'
                : 'Patient will receive the text message summary shortly.'}
            </p>
            {callSid && (
              <p className="text-sm text-green-600">
                Call SID: {callSid}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Phone Number Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter 10-digit US phone number
              </p>
            </div>

            {/* Voice Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice Selection
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                {AVAILABLE_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} - {voice.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the voice for the audio summary
              </p>
            </div>

            {/* Generated Script Preview */}
            {generatedScript && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI-Generated Script Preview
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {generatedScript}
                  </p>
                  <div className="mt-2 text-xs text-gray-500">
                    {generatedScript.split(/\s+/).length} words •
                    ~{Math.ceil((generatedScript.split(/\s+/).length / 150) * 60)} seconds
                  </div>
                </div>
              </div>
            )}

            {/* Audio Preview */}
            {audioPreviewUrl && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audio Preview
                </label>
                <audio controls className="w-full" src={audioPreviewUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">❌ {error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {!generatedScript ? (
                <button
                  onClick={handleGeneratePreview}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? '⏳ Generating Preview...' : '🎙️ Generate Preview'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleSendCall}
                    disabled={loading || !phoneNumber.trim()}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? '📞 Calling...' : '📞 Call Patient'}
                  </button>
                  <button
                    onClick={handleSendSMS}
                    disabled={loading || !phoneNumber.trim()}
                    className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? '📱 Sending...' : '📱 Send SMS'}
                  </button>
                </div>
              )}

              <button
                onClick={handleClose}
                disabled={loading}
                className="w-full px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {/* Info */}
            <div className="mt-4 text-xs text-gray-500">
              ℹ️ <strong>Phone Call:</strong> 15-30 second AI-generated audio summary. Patient can press 1 to replay or press 2 to be transferred to the clinic.<br />
              📱 <strong>SMS:</strong> Text message with brief visit summary (no audio).
            </div>
          </>
        )}
      </div>
    </div>
  );
};
