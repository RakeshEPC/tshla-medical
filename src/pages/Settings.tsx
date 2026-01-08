/**
 * Settings Page
 * Allows medical staff to manage their account settings including MFA
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import MFAEnrollment from '../components/auth/MFAEnrollment';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mfaStatus, setMfaStatus] = useState<{
    enrolled: boolean;
    factors: any[];
    error?: string;
  }>({ enrolled: false, factors: [] });
  const [loading, setLoading] = useState(true);
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    setLoading(true);
    const status = await supabaseAuthService.getMFAStatus();
    setMfaStatus(status);
    setLoading(false);
  };

  const handleEnableMFA = () => {
    setShowMFAEnrollment(true);
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleMFAEnrolled = () => {
    setShowMFAEnrollment(false);
    setSuccessMessage('Two-factor authentication enabled successfully!');
    loadMFAStatus();
  };

  const handleMFACancelled = () => {
    setShowMFAEnrollment(false);
  };

  const handleDisableMFA = async () => {
    if (!mfaStatus.factors[0]?.id) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to disable two-factor authentication? This will make your account less secure.'
    );

    if (!confirmed) {
      return;
    }

    setDisabling(true);
    setSuccessMessage('');
    setErrorMessage('');

    const result = await supabaseAuthService.unenrollMFA(mfaStatus.factors[0].id);

    if (result.success) {
      setSuccessMessage('Two-factor authentication disabled successfully.');
      loadMFAStatus();
    } else {
      setErrorMessage(result.error || 'Failed to disable MFA. Please try again.');
    }

    setDisabling(false);
  };

  if (!user || user.accessType !== 'medical') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">You must be logged in as medical staff to access settings.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (showMFAEnrollment) {
    return <MFAEnrollment onEnrolled={handleMFAEnrolled} onCancelled={handleMFACancelled} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
              <p className="mt-1 text-sm text-gray-600">Manage your account preferences and security</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Success/Error Messages */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-green-800">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* Account Information Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Name</span>
                <span className="font-medium text-gray-900">{user.name}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Email</span>
                <span className="font-medium text-gray-900">{user.email}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Role</span>
                <span className="font-medium text-gray-900 capitalize">{user.role}</span>
              </div>
              {user.specialty && (
                <div className="flex justify-between py-3">
                  <span className="text-gray-600">Specialty</span>
                  <span className="font-medium text-gray-900">{user.specialty}</span>
                </div>
              )}
            </div>
          </div>

          {/* Security Card - MFA */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900">Security</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">Two-Factor Authentication (2FA)</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Add an extra layer of security to your account by requiring a code from your phone in addition to your password.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          mfaStatus.enrolled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {mfaStatus.enrolled ? (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Enabled
                            </>
                          ) : (
                            'Disabled'
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      {mfaStatus.enrolled ? (
                        <button
                          onClick={handleDisableMFA}
                          disabled={disabling}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                          {disabling ? 'Disabling...' : 'Disable'}
                        </button>
                      ) : (
                        <button
                          onClick={handleEnableMFA}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Enable 2FA
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {mfaStatus.error && (
                  <p className="text-sm text-red-600">Error: {mfaStatus.error}</p>
                )}

                {/* HIPAA Compliance Note */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">HIPAA Compliance Recommendation</p>
                      <p className="text-sm text-blue-800">
                        Enabling two-factor authentication is strongly recommended for medical staff to comply with HIPAA security requirements (§164.312(d) - Person or Entity Authentication).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
