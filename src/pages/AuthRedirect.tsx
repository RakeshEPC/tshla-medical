import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Stethoscope, Clock } from 'lucide-react';

export default function AuthRedirect() {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [dots, setDots] = useState('');

  // Animated dots for loading
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Wait for auth context to finish loading
    if (!loading) {
      if (isAuthenticated && user) {
        // Ensure auth state is fully propagated before redirecting
        setTimeout(() => {
          // Double-check authentication state before redirect
          const token = localStorage.getItem('auth_token');
          const userData = localStorage.getItem('user_data');

          if (token && userData) {
            if (user.role === 'staff' || user.role === 'medical_assistant' || user.role === 'nurse') {
              navigate('/staff', { replace: true });
            } else if (user.role === 'doctor' || user.role === 'admin') {
              navigate('/dashboard', { replace: true });
            } else if (user.accessType === 'pumpdrive') {
              navigate('/pumpdrive', { replace: true });
            } else if (user.accessType === 'patient') {
              navigate('/patient/dashboard', { replace: true });
            } else {
              // Default to doctor dashboard
              navigate('/dashboard', { replace: true });
            }
          } else {
            // Auth state is inconsistent, redirect to login
            navigate('/login', { replace: true });
          }
        }, 1500); // Increased timeout to ensure proper state propagation
      } else {
        // Not authenticated, redirect to login
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 500);
      }
    }
  }, [loading, isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md">
        <div className="p-8 md:p-10 text-center">
          {/* Logo and Animation */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-6 transform animate-pulse">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">TSHLA Medical</h1>
          </div>

          {/* Loading Animation */}
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-3">
              <Clock className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-lg font-medium text-gray-700">
                Authenticating{dots}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse w-3/4"></div>
            </div>

            <p className="text-gray-600 text-sm">
              Verifying your credentials and setting up your dashboard...
            </p>

            {/* User Info if Available */}
            {user && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  Welcome back, <span className="font-semibold">{user.name}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Role: {user.role} • Type: {user.accessType}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}