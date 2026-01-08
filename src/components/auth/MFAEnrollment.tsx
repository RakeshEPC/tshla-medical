/**
 * MFA Enrollment Component
 * Allows medical staff to set up two-factor authentication using TOTP (Google Authenticator/Authy)
 * Uses Supabase native MFA
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logError, logInfo } from '../../services/logger.service';

interface MFAEnrollmentProps {
  onEnrolled: () => void;
  onCancelled: () => void;
}

export default function MFAEnrollment({ onEnrolled, onCancelled }: MFAEnrollmentProps) {
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQRCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Generate MFA enrollment on component mount
  useEffect(() => {
    const enrollFactor = async () => {
      try {
        logInfo('MFA', 'Starting MFA enrollment');

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'TSHLA Medical Authenticator'
        });

        if (enrollError) {
          throw enrollError;
        }

        if (!data) {
          throw new Error('No enrollment data returned');
        }

        setFactorId(data.id);
        setQRCode(data.totp.qr_code); // SVG format QR code
        setSecret(data.totp.secret); // Text secret for manual entry
        setLoading(false);

        logInfo('MFA', 'MFA enrollment generated successfully');
      } catch (err: any) {
        logError('MFA', 'Failed to generate MFA enrollment', { error: err.message });
        setError(err.message || 'Failed to set up MFA. Please try again.');
        setLoading(false);
      }
    };

    enrollFactor();
  }, []);

  // Step 2: Verify and enable MFA
  const handleEnableClick = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) {
        throw challengeError;
      }

      if (!challengeData) {
        throw new Error('Failed to create MFA challenge');
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode.trim()
      });

      if (verifyError) {
        throw verifyError;
      }

      logInfo('MFA', 'MFA enabled successfully');
      onEnrolled();
    } catch (err: any) {
      logError('MFA', 'Failed to verify MFA code', { error: err.message });

      let errorMessage = 'Invalid code. Please try again.';
      if (err.message.includes('expired')) {
        errorMessage = 'Code expired. Please generate a new code from your authenticator app.';
      } else if (err.message.includes('invalid')) {
        errorMessage = 'Invalid code. Please check your authenticator app and try again.';
      }

      setError(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerifyCode(value);
    if (error) setError(''); // Clear error when user starts typing
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !qrCode) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Setup Failed</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={onCancelled}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Two-Factor Authentication</h2>
        <p className="text-gray-600">
          Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-6 bg-white p-4 rounded border-2 border-gray-200">
        <img
          src={qrCode}
          alt="MFA QR Code"
          className="w-64 h-64"
        />
      </div>

      {/* Manual Entry Secret */}
      <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-2">Can't scan? Enter this code manually:</p>
        <code className="block text-center text-sm font-mono bg-white px-3 py-2 rounded border border-gray-300 select-all">
          {secret}
        </code>
      </div>

      {/* Verification Code Input */}
      <div className="mb-6">
        <label htmlFor="verify-code" className="block text-sm font-medium text-gray-700 mb-2">
          Enter 6-digit code from your authenticator app:
        </label>
        <input
          id="verify-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={verifyCode}
          onChange={handleCodeChange}
          placeholder="000000"
          maxLength={6}
          className="w-full px-4 py-3 text-center text-2xl font-mono border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          disabled={verifying}
          autoComplete="off"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancelled}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          disabled={verifying}
        >
          Cancel
        </button>
        <button
          onClick={handleEnableClick}
          disabled={verifyCode.length !== 6 || verifying}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          {verifying ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Verifying...
            </>
          ) : (
            'Enable MFA'
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> After enabling MFA, you'll need to enter a code from your authenticator app every time you log in.
        </p>
      </div>
    </div>
  );
}
