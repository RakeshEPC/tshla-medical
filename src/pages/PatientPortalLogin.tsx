/**
 * Patient Portal Login Page
 * Phone + 6-digit PIN authentication
 * Created: 2025-01-16
 */

import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, AlertCircle, Loader2, User } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function PatientPortalLogin() {
  const navigate = useNavigate();

  // Form state
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetPIN, setShowResetPIN] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  /**
   * Format phone number as user types
   */
  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 6) {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    } else {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    }
  };

  /**
   * Handle phone number input
   */
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setError(null);
  };

  /**
   * Handle PIN input (digits only, max 6)
   */
  const handlePINChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 6) {
      setPin(value);
      setError(null);
    }
  };

  /**
   * Handle login form submission
   */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const phoneNumbers = phone.replace(/\D/g, '');
    if (phoneNumbers.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-chart/portal/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumbers,
          pin: pin,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Invalid phone number or PIN');
        return;
      }

      // Store patient data in session storage
      sessionStorage.setItem('patient_portal_user', JSON.stringify(data.patient));
      sessionStorage.setItem('patient_portal_chart', JSON.stringify(data.chart));

      // Navigate to patient portal dashboard
      navigate('/patient-portal-dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle PIN reset request
   */
  const handleResetPIN = async () => {
    const phoneNumbers = phone.replace(/\D/g, '');
    if (phoneNumbers.length !== 10) {
      setError('Please enter your phone number first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-chart/portal/reset-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumbers,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetSuccess(true);
        setShowResetPIN(false);
        setTimeout(() => setResetSuccess(false), 5000);
      } else {
        setError(data.error || 'Failed to reset PIN');
      }
    } catch (err) {
      console.error('Reset PIN error:', err);
      setError('Unable to reset PIN. Please try again.');
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            TSHLA Patient Portal
          </h1>
          <p className="text-gray-600">
            Access your medical records securely
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Success Message */}
          {resetSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-800 text-sm">
                ✅ If your phone number is registered, a new PIN has been sent via SMS
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">

            {/* Phone Number Input */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isLoading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter the phone number used for your medical appointments
              </p>
            </div>

            {/* PIN Input */}
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                6-Digit PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="pin"
                  value={pin}
                  onChange={handlePINChange}
                  placeholder="••••••"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                  required
                  disabled={isLoading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Your PIN was sent via SMS when your account was created
              </p>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || phone.replace(/\D/g, '').length !== 10 || pin.length !== 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Access My Chart</span>
              )}
            </button>
          </form>

          {/* Forgot PIN */}
          <div className="mt-6 text-center">
            {!showResetPIN ? (
              <button
                onClick={() => setShowResetPIN(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot your PIN?
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Enter your phone number and click below to receive a new PIN via SMS
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleResetPIN}
                    disabled={isLoading}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Send New PIN'}
                  </button>
                  <button
                    onClick={() => setShowResetPIN(false)}
                    className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Don't have a PIN? Contact your doctor's office to activate your patient portal access.
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            🔒 Your information is protected with HIPAA-compliant encryption
          </p>
        </div>

        {/* Demo Credentials (Remove in production) */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-xs text-yellow-800 font-semibold mb-2">
              🔧 Development Mode - Demo Credentials:
            </p>
            <p className="text-xs text-yellow-700">
              Phone: (555) 123-4567<br />
              PIN: 123456 (check console logs for actual PIN)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
