import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { supabase } from '../lib/supabase';
import { checkBrowserCompatibility, getStorageEnableInstructions } from '../utils/browserCompatibility';
import MFAVerification from '../components/auth/MFAVerification';

export default function Login() {
  const [loginMethod, setLoginMethod] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [doctorCode, setDoctorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDoctorList, setShowDoctorList] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Check browser compatibility on mount and handle success messages
  useEffect(() => {
    const compat = checkBrowserCompatibility();
    if (compat.needsStorageWarning) {
      const instructions = getStorageEnableInstructions(compat.browser);
      setStorageWarning(`${compat.browser} is blocking cookies/storage. ${instructions}`);
    }

    // Check for success message from password reset
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message from location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const availableDoctors = [
    { id: 'dr1', name: 'Dr. Smith', code: 'DOCTOR-2025' },
    { id: 'dr2', name: 'Dr. Johnson', code: 'DIET-2025' },
    { id: 'dr3', name: 'Dr. Brown', code: 'PSYCH-2025' },
  ]; // Moved to unifiedAuth service

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, try authentication through the service directly to check for MFA
      const authResult = await unifiedAuthService.loginMedicalStaff(email, password);

      // Check if MFA is required
      if (authResult.mfaRequired && authResult.factorId) {
        setMfaFactorId(authResult.factorId);
        setShowMFAVerification(true);
        setLoading(false);
        return;
      }

      // If no MFA required, proceed with normal login
      await login(loginMethod === 'code' ? '' : email, loginMethod === 'code' ? doctorCode : password);

      // Get the user from unified auth service to check role
      const result = await unifiedAuthService.getCurrentUser();

      if (result.success && result.user) {
        // Check if password change is required
        if (result.user.requiresPasswordChange) {
          navigate('/change-password');
        } else {
          // Redirect based on user type
          if (result.user.accessType === 'pumpdrive') {
            navigate('/pumpdrive');
          } else if (result.user.accessType === 'patient') {
            navigate('/patient/dashboard');
          } else if (result.user.role === 'admin' || result.user.role === 'super_admin') {
            // Admins go directly to account manager
            navigate('/admin/account-manager');
          } else {
            // Medical staff go to dashboard
            navigate('/dashboard');
          }
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (code: string) => {
    try {
      // Call AuthContext's login to update state
      await login('', code);

      // Get the user to check role
      const result = await unifiedAuthService.getCurrentUser();
      if (result.success && result.user) {
        if (result.user.role === 'admin' || result.user.role === 'super_admin') {
          navigate('/admin/account-manager');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const clearSessionAndRetry = () => {
    // Clear ALL storage
    console.log('🧹 Clearing all browser storage...');
    localStorage.clear();
    sessionStorage.clear();

    // Log current Supabase session state
    console.log('📊 Supabase session state:', {
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    });

    setError('');
    setEmail('');
    setPassword('');
    window.location.reload(); // Force fresh start
  };

  const handleMFAVerified = async () => {
    // MFA verification successful, Supabase session is now at AAL2
    try {
      // Force page reload to let AuthContext pick up the new session
      // Supabase has already upgraded the session to AAL2 after MFA verification
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Login failed after MFA verification');
      setShowMFAVerification(false);
    }
  };

  const handleMFACancel = () => {
    // User cancelled MFA, return to login screen
    setShowMFAVerification(false);
    setMfaFactorId('');
    setError('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (resetError) {
        throw resetError;
      }

      setResetEmailSent(true);
      setForgotPasswordEmail('');

      // Auto-close after 5 seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmailSent(false);
      }, 5000);

    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show MFA verification screen if required
  if (showMFAVerification && mfaFactorId) {
    return (
      <MFAVerification
        factorId={mfaFactorId}
        onVerified={handleMFAVerified}
        onCancel={handleMFACancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-tesla-silver flex items-center justify-center p-4 no-animations">
      <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-tesla-dark-gray tracking-tight">TSHLA Medical</h1>
          <p className="text-tesla-light-gray font-light mt-2">Provider Portal</p>
        </div>

        {/* Login Method Toggle - Tesla Style */}
        <div className="flex bg-tesla-silver rounded-lg p-1 mb-8">
          <button
            type="button"
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              loginMethod === 'email'
                ? 'bg-tesla-dark-gray text-white'
                : 'text-tesla-light-gray hover:text-tesla-dark-gray'
            }`}
          >
            Email Login
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('code')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              loginMethod === 'code'
                ? 'bg-tesla-dark-gray text-white'
                : 'text-tesla-light-gray hover:text-tesla-dark-gray'
            }`}
          >
            Quick Access
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMethod === 'code' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Access Code</label>
                <input
                  type="text"
                  value={doctorCode}
                  onChange={e => setDoctorCode(e.target.value)}
                  className="input-tesla-minimal"
                  placeholder="Enter your access code"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowDoctorList(!showDoctorList)}
                  className="mt-2 text-sm link-tesla"
                >
                  {showDoctorList ? 'Hide' : 'Show'} available codes
                </button>
              </div>

              {showDoctorList && (
                <div className="bg-tesla-silver rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs text-tesla-light-gray mb-3">Development Access:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableDoctors.map(doctor => (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => quickLogin(doctor.code)}
                        className="text-left p-3 text-sm bg-white rounded border border-gray-200 hover:border-tesla-dark-gray transition-colors"
                      >
                        <div className="font-medium text-tesla-dark-gray">{doctor.name}</div>
                        <div className="text-xs text-tesla-light-gray">{doctor.code}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-tesla-minimal"
                  placeholder="doctor@tshla.ai"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-tesla-minimal"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tesla-dark-gray mb-2">
                  Verification Code <span className="text-tesla-light-gray font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-tesla-minimal font-mono text-center text-lg tracking-wider"
                  placeholder="000000"
                  maxLength={6}
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-tesla-light-gray mt-2 text-center">
                  6-digit verification code (leave blank if not required)
                </p>
              </div>
            </>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
              {successMessage}
            </div>
          )}

          {storageWarning && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
              <strong>Browser Storage Warning:</strong>
              <div className="mt-2 text-xs whitespace-pre-line">{storageWarning}</div>
            </div>
          )}

          {error && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
              <button
                type="button"
                onClick={clearSessionAndRetry}
                className="w-full text-sm text-tesla-light-gray hover:text-tesla-dark-gray underline"
              >
                Clear session data and try again
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              (loginMethod === 'email' && (!email || !password)) ||
              (loginMethod === 'code' && !doctorCode)
            }
            className="btn-tesla btn-tesla-secondary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

          {/* Forgot Password Link - Only show for email login */}
          {loginMethod === 'email' && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                Forgot your password?
              </button>
            </div>
          )}
        </form>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Reset Password</h2>

              {resetEmailSent ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">Check your email!</p>
                  <p className="text-gray-600">
                    We've sent you a password reset link. Please check your inbox and follow the instructions.
                  </p>
                  <p className="text-sm text-gray-500 mt-4">
                    This window will close automatically...
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 mb-6">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="your.email@example.com"
                        required
                        autoFocus
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotPasswordEmail('');
                          setError('');
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading || !forgotPasswordEmail}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-sm text-tesla-light-gray font-light">
          <p>HIPAA Compliant • SOC 2 Type II</p>
          <p className="mt-1">All access monitored and logged</p>
        </div>
      </div>
    </div>
  );
}
