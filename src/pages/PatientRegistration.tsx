import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patient.service';
import type { PatientRegistration } from '../types/patient.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [avaId, setAvaId] = useState('');

  const [formData, setFormData] = useState<PatientRegistration>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    program: 'both',
    referralSource: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const patient = await patientService.registerPatient(formData);
      setAvaId(patient.patientAvaId);
      setShowSuccess(true);

      // Clear all sessionStorage to ensure fresh start
      const keysToRemove = [
        'pumpDrivePatientName',
        'pumpDriveSliders',
        'selectedPumpFeatures',
        'pumpDriveFreeText',
        'pumpDriveClarifyingResponses',
        'pumpDriveClarifyingQuestions',
        'pumpdrive_recommendation',
        'pumpDriveRecommendation',
        'pumpDriveConversation',
        'pumpdrive_responses',
        'pumpDriveCompletedCategories',
        'pumpdrive_category_order',
        'pumpdrive_completed_categories',
        'pumpdrive_priority_order',
        'pumpdrive_assessment_id',
        'pumpdrive_unsaved_recommendation'
      ];
      keysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Set fresh patient name from form data
      sessionStorage.setItem('pumpDrivePatientName', `${formData.firstName} ${formData.lastName}`);
      logInfo('PatientRegistration', 'SessionStorage cleared for new patient', {
        name: `${formData.firstName} ${formData.lastName}`
      });

      // Auto-login after registration
      await patientService.loginWithAvaId({ avaId: patient.patientAvaId });

      // Redirect based on program
      setTimeout(() => {
        if (formData.program === 'pumpdrive') {
          navigate('/pumpdrive');
        } else if (formData.program === 'weightloss') {
          navigate('/weightloss/onboarding');
        } else {
          navigate('/patient/dashboard');
        }
      }, 3000);
    } catch (error) {
      logError('PatientRegistration', 'Error message', {});
      setErrors({ submit: 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to TSHLA Medical!</h2>

            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <p className="text-sm text-gray-600 mb-3">Your unique AVA ID is:</p>
              <div className="text-3xl font-bold text-blue-600 font-mono">{avaId}</div>
              <p className="text-xs text-gray-500 mt-3">Save this ID - you'll use it to log in</p>
            </div>

            <p className="text-gray-600 mb-6">
              We've sent a welcome email to <strong>{formData.email}</strong> with your AVA ID and
              login instructions.
            </p>

            <div className="text-sm text-gray-500">Redirecting you to your journey...</div>

            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-4">
            Start Your Health Journey
          </h1>
          <p className="text-xl text-gray-600">
            Register to access personalized healthcare solutions
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Smith"
                />
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="john.smith@email.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth (Optional)
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Program Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Which program are you interested in?
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 border rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                  <input
                    type="radio"
                    name="program"
                    value="pumpdrive"
                    checked={formData.program === 'pumpdrive'}
                    onChange={e => setFormData({ ...formData, program: e.target.value as any })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">PumpDrive</div>
                    <div className="text-sm text-gray-600">
                      AI-powered insulin pump selection and personalized recommendations
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-4 border rounded-xl cursor-pointer hover:bg-green-50 transition-colors">
                  <input
                    type="radio"
                    name="program"
                    value="weightloss"
                    checked={formData.program === 'weightloss'}
                    onChange={e => setFormData({ ...formData, program: e.target.value as any })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Weight Loss Journey</div>
                    <div className="text-sm text-gray-600">
                      Comprehensive weight management with AI coaching and tracking
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-4 border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="program"
                    value="both"
                    checked={formData.program === 'both'}
                    onChange={e => setFormData({ ...formData, program: e.target.value as any })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Both Programs</div>
                    <div className="text-sm text-gray-600">
                      Access to all TSHLA Medical programs and features
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Referral Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How did you hear about us? (Optional)
              </label>
              <select
                value={formData.referralSource}
                onChange={e => setFormData({ ...formData, referralSource: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="doctor">Doctor Referral</option>
                <option value="search">Google/Search</option>
                <option value="social">Social Media</option>
                <option value="friend">Friend/Family</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl">{errors.submit}</div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 transform hover:scale-[1.02]'
              }`}
            >
              {isLoading ? 'Creating Your Account...' : 'Create Account & Get AVA ID'}
            </button>

            {/* Login Link */}
            <div className="text-center text-sm text-gray-600">
              Already have an AVA ID?
              <button
                type="button"
                onClick={() => navigate('/patient-login')}
                className="text-blue-600 hover:text-blue-700 font-semibold ml-1"
              >
                Log In
              </button>
            </div>
          </form>
        </div>

        {/* Benefits */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-lg">
            <div className="text-2xl mb-2">🔒</div>
            <div className="font-semibold text-gray-900">HIPAA Compliant</div>
            <div className="text-sm text-gray-600">Your data is secure and private</div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-lg">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-semibold text-gray-900">AI-Powered</div>
            <div className="text-sm text-gray-600">Personalized recommendations</div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-lg">
            <div className="text-2xl mb-2">📱</div>
            <div className="font-semibold text-gray-900">Easy Access</div>
            <div className="text-sm text-gray-600">Use your AVA ID anywhere</div>
          </div>
        </div>
      </div>
    </div>
  );
}
