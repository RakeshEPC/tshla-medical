import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { auditLogService } from '../services/auditLog.service';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Lock, Mail, Eye, EyeOff, Shield, Clock } from 'lucide-react';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function LoginHIPAA() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const navigate = useNavigate();
  const { login: updateAuthContext } = useAuth();

  useEffect(() => {
    // Check if there's an existing session
    if (unifiedAuthService.isAuthenticated()) {
      const user = unifiedAuthService.getCurrentUser();
      if (user) {
        navigate('/doctor');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Attempt login using unified service
      const result = await unifiedAuthService.login(email, password);

      if (result.success && result.user) {
        // Set user context for audit logging (wrap in try-catch to prevent navigation failure)
        try {
          auditLogService.setCurrentUser(result.user.id, result.user.name);

          // Log successful login
          await auditLogService.logLogin(email, true);
        } catch (auditError) {
          logError('LoginHIPAA', 'Error message', {});
          // Continue with navigation even if audit fails
        }

        // Check if password change is required
        if (result.user.requiresPasswordChange) {
          navigate('/change-password');
        } else {
          // Show session warning
          setSessionWarning(true);
          // Redirect based on user type
          setTimeout(() => {
            if (result.user?.accessType === 'pumpdrive') {
              window.location.href = '/pumpdrive';
            } else if (result.user?.accessType === 'patient') {
              window.location.href = '/patient/dashboard';
            } else {
              window.location.href = '/doctor';
            }
          }, 500);
        }
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);

      // Log failed login
      await auditLogService.logLogin(email, false, errorMessage);

      // Clear password field on error
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">TSHLA Medical</h1>
          <p className="text-gray-600 mt-2">HIPAA-Compliant Provider Portal</p>
        </div>

        {/* Session Warning */}
        {sessionWarning && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <Clock className="w-5 h-5" />
              <p className="text-sm">
                Login successful! Session expires in 15 minutes of inactivity.
              </p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="doctor@tshla.ai"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your secure password"
                required
                autoComplete="current-password"
                disabled={loading}
                minLength={12}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Authenticating...
              </span>
            ) : (
              'Sign In Securely'
            )}
          </button>
        </form>

        {/* Security Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-green-600" />
                HIPAA Compliant
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Lock className="w-4 h-4 text-green-600" />
                256-bit Encryption
              </span>
            </div>
            <p className="text-xs text-gray-500">
              All access is monitored and logged for security compliance
            </p>
            <p className="text-xs text-gray-500">
              Session automatically expires after 15 minutes of inactivity
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
