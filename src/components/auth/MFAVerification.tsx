/**
 * MFA Verification Component
 * Prompts user to enter their 6-digit TOTP code during login
 * Uses Supabase native MFA
 */

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logError, logInfo } from '../../services/logger.service';

interface MFAVerificationProps {
  factorId: string;
  onVerified: () => void;
  onCancel: () => void;
}

export default function MFAVerification({ factorId, onVerified, onCancel }: MFAVerificationProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      logInfo('MFA', 'Starting MFA verification');

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
        code: code.trim()
      });

      if (verifyError) {
        throw verifyError;
      }

      logInfo('MFA', 'MFA verification successful');
      onVerified();
    } catch (err: any) {
      logError('MFA', 'MFA verification failed', { error: err.message });

      let errorMessage = 'Invalid code. Please try again.';
      if (err.message.includes('expired')) {
        errorMessage = 'Code expired. Please generate a new code from your authenticator app.';
      } else if (err.message.includes('invalid')) {
        errorMessage = 'Invalid code. Please check your authenticator app and try again.';
      } else if (err.message.includes('too many')) {
        errorMessage = 'Too many attempts. Please wait a moment and try again.';
      }

      setError(errorMessage);
      setVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (error) setError(''); // Clear error when user starts typing
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 rounded-full p-4">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
          <p className="text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Code Input */}
        <div className="mb-6">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={handleCodeChange}
            onKeyPress={handleKeyPress}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="w-full px-4 py-4 text-center text-3xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
            disabled={verifying}
            autoComplete="off"
          />
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleVerify}
            disabled={code.length !== 6 || verifying}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={verifying}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-800">
            <strong className="block mb-1">Tip:</strong>
            Open your authenticator app (Google Authenticator, Authy, etc.) and enter the current 6-digit code for TSHLA Medical.
          </p>
        </div>

        {/* Lost Access Link */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Lost access to your authenticator app?{' '}
            <a
              href="mailto:support@tshla.ai?subject=MFA Reset Request"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
