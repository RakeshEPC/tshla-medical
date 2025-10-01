import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  AlertCircle,
  Shield,
  User,
  Building,
  Award,
} from 'lucide-react';

export default function AccountVerification() {
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>(
    'pending'
  );
  const [userInfo, setUserInfo] = useState<any>(null);
  const [resendEmail, setResendEmail] = useState(false);

  useEffect(() => {
    // Get pending verification data from localStorage
    const pendingData = localStorage.getItem('pending_verification');
    if (pendingData) {
      setUserInfo(JSON.parse(pendingData));

      // Simulate verification process after 3 seconds
      setTimeout(() => {
        setVerificationStatus('verified');
        // Clear pending data
        localStorage.removeItem('pending_verification');
      }, 3000);
    } else {
      // No pending verification, redirect to create account
      navigate('/create-account');
    }
  }, [navigate]);

  const handleResendEmail = () => {
    setResendEmail(true);
    setTimeout(() => {
      setResendEmail(false);
    }, 2000);
  };

  const handleContinueToLogin = () => {
    navigate('/login');
  };

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Account Verification</h1>
          <p className="text-gray-600">Your account is being verified</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {verificationStatus === 'pending' && (
            <>
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Clock className="w-24 h-24 text-blue-500 mb-6" />
                  <div className="absolute -bottom-2 -right-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                </div>

                <h2 className="text-2xl font-semibold mb-4">Verification In Progress</h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full mb-6">
                  <p className="text-blue-800 text-center">
                    We're verifying your professional credentials. This typically takes 24-48 hours.
                  </p>
                </div>

                <div className="space-y-3 w-full max-w-md">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <User className="w-5 h-5 mr-2 text-gray-600" />
                      Identity Verification
                    </span>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <Award className="w-5 h-5 mr-2 text-gray-600" />
                      License Verification
                    </span>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-gray-600" />
                      Background Check
                    </span>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <Building className="w-5 h-5 mr-2 text-gray-600" />
                      Practice Verification
                    </span>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  </div>
                </div>
              </div>
            </>
          )}

          {verificationStatus === 'verified' && (
            <>
              <div className="flex flex-col items-center">
                <CheckCircle className="w-24 h-24 text-green-500 mb-6" />

                <h2 className="text-2xl font-semibold mb-4 text-green-800">
                  Verification Complete!
                </h2>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-full mb-6">
                  <p className="text-green-800 text-center">
                    Your account has been successfully verified. You can now access all features.
                  </p>
                </div>

                <div className="space-y-3 w-full max-w-md mb-6">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <User className="w-5 h-5 mr-2 text-gray-600" />
                      Identity Verification
                    </span>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <Award className="w-5 h-5 mr-2 text-gray-600" />
                      License Verification
                    </span>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-gray-600" />
                      Background Check
                    </span>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="flex items-center">
                      <Building className="w-5 h-5 mr-2 text-gray-600" />
                      Practice Verification
                    </span>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                </div>

                <button
                  onClick={handleContinueToLogin}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Continue to Login
                </button>
              </div>
            </>
          )}

          {verificationStatus === 'failed' && (
            <>
              <div className="flex flex-col items-center">
                <AlertCircle className="w-24 h-24 text-red-500 mb-6" />

                <h2 className="text-2xl font-semibold mb-4 text-red-800">Verification Issue</h2>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full mb-6">
                  <p className="text-red-800 text-center">
                    We encountered an issue verifying your credentials. Our team will contact you
                    shortly.
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-gray-600 mb-4">Please contact support for assistance</p>
                  <a
                    href="mailto:support@tshla.ai"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    support@tshla.ai
                  </a>
                </div>
              </div>
            </>
          )}

          {/* User Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{userInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{userInfo.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role:</span>
                <span className="font-medium capitalize">{userInfo.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Specialty:</span>
                <span className="font-medium">{userInfo.specialty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Practice:</span>
                <span className="font-medium">{userInfo.practiceName}</span>
              </div>
            </div>
          </div>

          {/* Email Notification */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <Mail className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800">
                  We've sent a confirmation email to <strong>{userInfo.email}</strong>
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please check your inbox and spam folder
                </p>
                {!resendEmail ? (
                  <button
                    onClick={handleResendEmail}
                    className="text-xs text-yellow-600 hover:text-yellow-700 font-medium mt-2"
                  >
                    Resend verification email
                  </button>
                ) : (
                  <p className="text-xs text-green-600 mt-2">Verification email sent!</p>
                )}
              </div>
            </div>
          </div>

          {/* Next Steps */}
          {verificationStatus === 'pending' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Our team will verify your credentials (24-48 hours)</li>
                <li>You'll receive an email once verification is complete</li>
                <li>Login to access your personalized dashboard</li>
                <li>Complete the onboarding tutorial (15 minutes)</li>
                <li>Start using TSHLA Medical's features</li>
              </ol>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Have questions about the verification process?</p>
          <p className="mt-2">
            Contact support at{' '}
            <a href="mailto:support@tshla.ai" className="text-blue-600 hover:text-blue-700">
              support@tshla.ai
            </a>{' '}
            or call{' '}
            <a href="tel:1-800-TSHLA-AI" className="text-blue-600 hover:text-blue-700">
              1-800-TSHLA-AI
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
