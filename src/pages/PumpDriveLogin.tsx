import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pumpAuthService, type LoginCredentials } from '../services/pumpAuth.service';

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function PumpDriveLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔍 Login form submitted', { email: formData.email });

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      console.log('❌ Validation errors:', validationErrors);
      setErrors(validationErrors);
      return;
    }

    console.log('✅ Validation passed, submitting login...');
    setIsSubmitting(true);
    setErrors({});

    try {
      const loginCredentials: LoginCredentials = {
        email: formData.email,
        password: formData.password
      };

      console.log('🌐 Calling pumpAuthService.login...');
      const result = await pumpAuthService.login(loginCredentials);
      console.log('📦 Login result:', result);

      if (result.success) {
        console.log('✅ Login successful!');
        // Login successful, check if there's a redirect path
        const redirectPath = sessionStorage.getItem('pumpDriveRedirectAfterLogin');
        if (redirectPath) {
          console.log('↪️ Redirecting to saved path:', redirectPath);
          sessionStorage.removeItem('pumpDriveRedirectAfterLogin');
          navigate(redirectPath);
        } else {
          console.log('↪️ Redirecting to /pumpdrive');
          // Default redirect to PumpDrive assessment
          navigate('/pumpdrive');
        }
      } else {
        console.log('❌ Login failed:', result.message);
        setErrors({ general: result.message });
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Login failed. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
      console.log('🏁 Login process complete');
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Sign in to continue your pump assessment
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="your@email.com"
                autoComplete="email"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm text-purple-600 hover:underline"
                onClick={() => {
                  // TODO: Implement forgot password
                  alert('Forgot password functionality coming soon!');
                }}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Create Account Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/pumpdrive/create-account')}
                className="text-purple-600 hover:underline font-medium"
              >
                Create Account
              </button>
            </p>
          </div>

          {/* Welcome Info */}
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <span className="mr-2 text-green-500">✨</span>
              <div className="text-sm text-green-700">
                <p className="font-medium mb-1">Welcome to PumpDrive</p>
                <p>Get personalized insulin pump recommendations based on your unique needs and lifestyle.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            ← Back to Home
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <div className="flex justify-center items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <span className="mr-2">🔒</span>
              Secure Login
            </div>
            <div className="flex items-center">
              <span className="mr-2">🏥</span>
              HIPAA Compliant
            </div>
            <div className="flex items-center">
              <span className="mr-2">⚡</span>
              Quick Access
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}