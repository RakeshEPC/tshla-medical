import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { logError, logInfo } from '../services/logger.service';
import { Mail, Lock, User, Phone, Calendar, Check, AlertCircle } from 'lucide-react';

interface RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
  enablePumpDrive: boolean;
}

export default function PatientRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<RegistrationData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dateOfBirth: '',
    enablePumpDrive: true,
  });

  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof RegistrationData, string>>>({});

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof RegistrationData, string>> = {};

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Name validation
    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    }

    // Optional phone validation
    if (formData.phoneNumber && !/^[\d\s\-\+\(\)]+$/.test(formData.phoneNumber)) {
      errors.phoneNumber = 'Please enter a valid phone number';
    }

    // Optional date of birth validation
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      if (dob > today) {
        errors.dateOfBirth = 'Date of birth cannot be in the future';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      logInfo('PatientRegister', 'Starting registration', { email: formData.email });

      const result = await supabaseAuthService.registerPatient({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        enablePumpDrive: formData.enablePumpDrive,
      });

      if (!result.success || !result.user) {
        setError(result.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      logInfo('PatientRegister', 'Registration successful', { userId: result.user.id });

      // Handle email confirmation requirement
      if (result.error === 'CONFIRMATION_REQUIRED') {
        setError('');
        alert('✅ Account created successfully!\n\nPlease check your email to confirm your account, then you can log in.');
        navigate('/patient-login');
        return;
      }

      // Redirect based on access type (only if session exists)
      if (result.user.accessType === 'pumpdrive') {
        navigate('/pumpdrive/assessment');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err) {
      logError('PatientRegister', 'Registration error', { error: err });
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof RegistrationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-600 rounded-full mb-4">
            <span className="text-white text-3xl font-bold">PD</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">Start your journey to finding the perfect insulin pump</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="John"
                />
                {validationErrors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => updateField('lastName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Doe"
                />
                {validationErrors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => updateField('email', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="john.doe@example.com"
              />
              {validationErrors.email && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => updateField('password', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                {validationErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={e => updateField('confirmPassword', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                {validationErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Optional Fields */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={e => updateField('phoneNumber', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="(555) 123-4567"
                />
                {validationErrors.phoneNumber && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date of Birth (Optional)
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => updateField('dateOfBirth', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {validationErrors.dateOfBirth && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.dateOfBirth}</p>
                )}
              </div>
            </div>

            {/* PumpDrive Access */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enablePumpDrive}
                  onChange={e => updateField('enablePumpDrive', e.target.checked)}
                  className="mt-1 mr-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Enable PumpDrive Assessment
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Get AI-powered insulin pump recommendations personalized for your needs
                  </p>
                </div>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 transform hover:scale-[1.02]'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                <span className="flex items-center justify-center">
                  <Check className="w-5 h-5 mr-2" />
                  Create Account
                </span>
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

          {/* Login Link */}
          <div className="text-center">
            <p className="text-gray-600 mb-3">Already have an account?</p>
            <button
              type="button"
              onClick={() => navigate('/patient-login')}
              className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Privacy & Terms */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            By creating an account, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700">
              Privacy Policy
            </a>
          </p>
          <p className="mt-2">HIPAA Compliant • All data encrypted • SOC 2 Type II Certified</p>
        </div>
      </div>
    </div>
  );
}
