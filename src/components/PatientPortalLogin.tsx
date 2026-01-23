/**
 * Patient Portal Login Component
 * TSH ID + Last 4 Digits of Phone Verification
 *
 * Single-step authentication for patient portal access
 * Creates 2-hour session after successful verification
 *
 * Created: 2026-01-23
 */

import { useState } from 'react';
import { AlertCircle, Lock, Phone, User } from 'lucide-react';

interface PatientPortalLoginProps {
  onSuccess: (sessionData: {
    patientPhone: string;
    tshlaId: string;
    patientName: string;
    sessionId: string;
  }) => void;
}

export default function PatientPortalLogin({ onSuccess }: PatientPortalLoginProps) {
  const [formData, setFormData] = useState({
    tshlaId: '',
    phoneLast4: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  /**
   * Format TSH ID as user types (auto-add TSH prefix and dashes)
   */
  const handleTshIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Auto-add TSH prefix if not present
    if (value.length > 0 && !value.startsWith('TSH')) {
      if (/^\d/.test(value)) {
        value = 'TSH' + value;
      }
    }

    // Format as TSH XXX-XXX
    if (value.startsWith('TSH') && value.length > 6) {
      const numbers = value.substring(3);
      value = `TSH ${numbers.substring(0, 3)}`;
      if (numbers.length > 3) {
        value += `-${numbers.substring(3, 6)}`;
      }
    } else if (value.startsWith('TSH') && value.length > 3) {
      value = `TSH ${value.substring(3)}`;
    }

    setFormData({ ...formData, tshlaId: value });
    setError(null);
  };

  /**
   * Format phone last 4 digits (numbers only)
   */
  const handlePhoneLast4Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 4);
    setFormData({ ...formData, phoneLast4: value });
    setError(null);
  };

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    if (!formData.tshlaId) {
      setError('Please enter your TSH ID');
      return false;
    }

    // Check TSH ID format: TSH XXX-XXX
    const normalizedTshId = formData.tshlaId.replace(/[\s-]/g, '');
    if (!normalizedTshId.match(/^TSH[A-Z0-9]{6}$/)) {
      setError('TSH ID should be in format: TSH XXX-XXX (e.g., TSH 456-789)');
      return false;
    }

    if (formData.phoneLast4.length !== 4) {
      setError('Please enter the last 4 digits of your phone number');
      return false;
    }

    return true;
  };

  /**
   * Handle login submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if locked out (5 failed attempts)
    if (failedAttempts >= 5) {
      setError('Too many failed attempts. Please wait 1 hour or contact our office at (832) 593-8100.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tshlaId: formData.tshlaId,
          phoneLast4: formData.phoneLast4
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Failed login
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        if (newFailedAttempts >= 5) {
          setError('Account locked due to multiple failed attempts. Please contact our office at (832) 593-8100.');
        } else if (response.status === 404) {
          setError('TSH ID not found. Please check your ID or contact our office.');
        } else if (response.status === 403) {
          setError(`Phone verification failed. ${5 - newFailedAttempts} attempts remaining.`);
        } else {
          setError(data.error || 'Login failed. Please check your information and try again.');
        }
        return;
      }

      // Success!
      onSuccess({
        patientPhone: data.patientPhone,
        tshlaId: data.tshlaId,
        patientName: data.patientName,
        sessionId: data.sessionId
      });

    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-600 rounded-full mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TSHLA Patient Portal</h1>
          <p className="text-gray-600">Access your medical records, payments, and care team</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Secure Login</h2>
            <p className="text-sm text-gray-600 mt-1">Enter your TSH ID and phone verification</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* TSH ID Input */}
            <div>
              <label htmlFor="tshlaId" className="block text-sm font-medium text-gray-700 mb-2">
                Your TSH ID
              </label>
              <input
                type="text"
                id="tshlaId"
                value={formData.tshlaId}
                onChange={handleTshIdChange}
                placeholder="TSH 456-789"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                autoComplete="off"
                maxLength={11}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Format: TSH followed by 6 characters (e.g., TSH 123-456)
              </p>
            </div>

            {/* Phone Last 4 Digits */}
            <div>
              <label htmlFor="phoneLast4" className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Last 4 digits of your phone number
              </label>
              <input
                type="text"
                id="phoneLast4"
                value={formData.phoneLast4}
                onChange={handlePhoneLast4Change}
                placeholder="1234"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                For security verification
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || failedAttempts >= 5}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Verifying...</span>
                </div>
              ) : (
                'Access Portal'
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600 mb-3">
              <strong>Need help accessing your portal?</strong>
            </p>
            <p className="text-sm text-gray-600">
              Contact our office at{' '}
              <a href="tel:+18325938100" className="text-blue-600 hover:underline font-medium">
                (832) 593-8100
              </a>
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Your TSH ID was provided during your registration or first visit.
              Check your welcome email or text message.
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-900 text-center">
              🔒 Your session is secure and will expire after 2 hours of inactivity
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Protected by HIPAA. Your privacy is our priority.</p>
        </div>
      </div>
    </div>
  );
}
