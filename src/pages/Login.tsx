import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { unifiedAuthService } from '../services/unifiedAuth.service';

export default function Login() {
  const [loginMethod, setLoginMethod] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [doctorCode, setDoctorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDoctorList, setShowDoctorList] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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
      // Use unified auth service for all login methods
      let result;

      if (loginMethod === 'code') {
        // For doctor codes, use the code as the password
        result = await unifiedAuthService.login('', doctorCode);
      } else {
        // For email login, just use the password (verification code is optional)
        result = await unifiedAuthService.login(email, password);
      }

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
          } else {
            navigate('/doctor');
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
      const result = await unifiedAuthService.login('', code);
      if (result.success) {
        navigate('/doctor');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

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

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
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
        </form>

        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-sm text-tesla-light-gray font-light">
          <p>HIPAA Compliant • SOC 2 Type II</p>
          <p className="mt-1">All access monitored and logged</p>
        </div>
      </div>
    </div>
  );
}
