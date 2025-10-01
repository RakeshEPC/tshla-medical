import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { medicalAuthService } from '../services/medicalAuth.service';

export default function SimplifiedLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await medicalAuthService.login({ email, password });

      if (result.success && result.user) {
        // Redirect based on user role
        setTimeout(() => {
          if (result.user?.role === 'admin') {
            window.location.href = '/admin';
          } else if (result.user?.role === 'staff' || result.user?.role === 'medical_assistant' || result.user?.role === 'nurse') {
            window.location.href = '/staff';
          } else {
            window.location.href = '/doctor';
          }
        }, 500);
      } else {
        setError(result.error || 'Login failed');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-sky-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Single Panel - Staff Login Only */}
        <div className="p-8 md:p-12">
          <div className="max-w-sm mx-auto">
            <div className="flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-6">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">Staff Login</h2>
            <p className="text-gray-600 mb-8">Sign in with your email and password</p>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@tshla.ai"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-8 pb-6">
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
          </div>
        )}

        {/* Registration Link */}
        <div className="px-8 pb-6">
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              Need an account?{' '}
              <button
                onClick={() => navigate('/medical/register')}
                className="text-indigo-600 hover:underline font-medium"
              >
                Register Here
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <div className="flex items-center justify-center text-xs text-gray-600">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              HIPAA Compliant & Secure
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
