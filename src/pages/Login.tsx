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
        // For email login, combine password with verification code if needed
        const fullPassword =
          verificationCode.length === 6 ? `${password}:${verificationCode}` : password;
        result = await unifiedAuthService.login(email, fullPassword);
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 no-animations">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">TSHLA Medical</h1>
          <p className="text-gray-600 mt-2">Secure Provider Portal</p>
        </div>

        {/* Login Method Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-2 px-4 rounded-md ${
              loginMethod === 'email'
                ? 'bg-white shadow-sm text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Email Login
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('code')}
            className={`flex-1 py-2 px-4 rounded-md ${
              loginMethod === 'code'
                ? 'bg-white shadow-sm text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Quick Access
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMethod === 'code' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Doctor Code</label>
                <input
                  type="text"
                  value={doctorCode}
                  onChange={e => setDoctorCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your doctor code (e.g., musk, rakesh)"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowDoctorList(!showDoctorList)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  {showDoctorList ? 'Hide' : 'Show'} available doctors
                </button>
              </div>

              {showDoctorList && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-2">Quick access (dev mode):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableDoctors.map(doctor => (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => quickLogin(doctor.code)}
                        className="text-left p-2 text-sm bg-white rounded border hover:bg-blue-50 hover:border-blue-300"
                      >
                        <div className="font-medium">{doctor.name}</div>
                        <div className="text-xs text-gray-500">Code: {doctor.code}</div>
                        <div className="text-xs text-gray-400">{doctor.specialty}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="doctor@tshla.ai"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center text-lg tracking-wider"
                  placeholder="000000"
                  maxLength={6}
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                  required
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Enter your 6-digit verification code
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              (loginMethod === 'email' && (!email || !password || verificationCode.length !== 6)) ||
              (loginMethod === 'code' && !doctorCode)
            }
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>HIPAA Compliant • SOC 2 Type II</p>
          <p className="mt-1">All access is monitored and logged</p>
        </div>
      </div>
    </div>
  );
}
