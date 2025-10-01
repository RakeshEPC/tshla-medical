import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patient.service';
import type { PatientLogin } from '../types/patient.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function PatientLoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'ava' | 'email'>('ava');

  const [loginData, setLoginData] = useState<PatientLogin>({
    avaId: '',
    email: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAvaFormat, setShowAvaFormat] = useState(false);

  const formatAvaIdInput = (value: string) => {
    // Remove all non-alphanumeric characters
    let cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // If it doesn't start with AVA, add it
    if (!cleaned.startsWith('AVA') && cleaned.length > 0) {
      // Check if they're typing numbers (might be just the number part)
      if (/^\d/.test(cleaned)) {
        cleaned = 'AVA' + cleaned;
      }
    }

    // Format as AVA ###-### if we have enough digits
    if (cleaned.startsWith('AVA')) {
      const numbers = cleaned.substring(3);
      if (numbers.length >= 3) {
        const formatted = `AVA ${numbers.substring(0, 3)}`;
        if (numbers.length > 3) {
          return formatted + '-' + numbers.substring(3, 6);
        }
        return formatted;
      }
      return cleaned.replace('AVA', 'AVA ');
    }

    return value;
  };

  const handleAvaIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAvaIdInput(e.target.value);
    setLoginData({ ...loginData, avaId: formatted });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (loginMethod === 'ava') {
      if (!loginData.avaId) {
        newErrors.avaId = 'AVA ID is required';
      } else {
        // Check format: AVA ###-###
        const avaPattern = /^AVA \d{3}-\d{3}$/;
        if (!avaPattern.test(loginData.avaId)) {
          newErrors.avaId = 'Please enter a valid AVA ID (AVA ###-###)';
        }
      }
    } else {
      if (!loginData.email) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const loginPayload =
        loginMethod === 'ava' ? { avaId: loginData.avaId } : { email: loginData.email };

      const { patient, session } = await patientService.loginWithAvaId(loginPayload);

      // Determine where to redirect based on patient's enrolled programs
      if (
        patient.programs.pumpdrive?.enrolled &&
        !patient.programs.pumpdrive?.finalRecommendations
      ) {
        navigate('/pumpdrive');
      } else if (patient.programs.weightloss?.enrolled) {
        navigate('/patient/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (error) {
      logError('PatientLogin', 'Error message', {});
      setErrors({
        submit:
          loginMethod === 'ava'
            ? 'Invalid AVA ID. Please check and try again.'
            : 'Invalid email or account not found.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-600 rounded-full mb-4">
            <span className="text-white text-3xl font-bold">AVA</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Log in to continue your health journey</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {/* Login Method Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('ava');
                setErrors({});
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                loginMethod === 'ava' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'
              }`}
            >
              AVA ID
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('email');
                setErrors({});
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                loginMethod === 'email' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'
              }`}
            >
              Email
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {loginMethod === 'ava' ? (
              <>
                {/* AVA ID Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your AVA ID
                  </label>
                  <input
                    type="text"
                    value={loginData.avaId}
                    onChange={handleAvaIdChange}
                    placeholder="AVA 123-456"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg ${
                      errors.avaId ? 'border-red-500' : 'border-gray-300'
                    }`}
                    maxLength={11}
                  />
                  {errors.avaId && <p className="text-red-500 text-sm mt-1">{errors.avaId}</p>}

                  {/* Format Helper */}
                  <button
                    type="button"
                    onClick={() => setShowAvaFormat(!showAvaFormat)}
                    className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                  >
                    What's my AVA ID?
                  </button>

                  {showAvaFormat && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                      <p className="text-gray-700 mb-2">
                        Your AVA ID was provided when you registered. It looks like:
                      </p>
                      <p className="font-mono font-bold text-blue-600 text-center text-lg">
                        AVA 123-456
                      </p>
                      <p className="text-gray-600 mt-2">
                        Check your welcome email for your unique AVA ID.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={e => {
                      setLoginData({ ...loginData, email: e.target.value });
                      setErrors({});
                    }}
                    placeholder="john.smith@email.com"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
              </>
            )}

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{errors.submit}</div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 transform hover:scale-[1.02]'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-gray-600 mb-3">Don't have an account?</p>
            <button
              type="button"
              onClick={() => navigate('/patient-register')}
              className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              Create New Account
            </button>
          </div>
        </div>

        {/* Help Links */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <button
            type="button"
            onClick={() => navigate('/forgot-ava-id')}
            className="hover:text-gray-700"
          >
            Forgot your AVA ID?
          </button>
          <span className="mx-2">•</span>
          <button
            type="button"
            onClick={() => navigate('/contact')}
            className="hover:text-gray-700"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
