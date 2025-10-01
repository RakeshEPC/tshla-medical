import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pumpAuthService, type UserRegistrationData } from '../services/pumpAuth.service';

interface UserFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

interface ResearchFormData extends UserFormData {
  fullName: string;
  dateOfBirth: string;
  pcpName: string;
  pcpPhone: string;
  pcpEmail: string;
  pcpAddress: string;
  endocrinologistName: string;
  endocrinologistPhone: string;
  endocrinologistEmail: string;
  endocrinologistAddress: string;
  mailingAddress: string;
}

interface QuestionnaireData {
  overallSatisfaction: number;
  highBloodSugarFrequency: string;
  lowBloodSugarFrequency: string;
  convenienceSatisfaction: number;
  flexibilitySatisfaction: number;
  understandingSatisfaction: number;
  continuationLikelihood: number;
  recommendationLikelihood: number;
  additionalComments: string;
}

export default function PumpDriveBilling() {
  const navigate = useNavigate();
  const [selectedPath, setSelectedPath] = useState<'standard' | 'research' | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Form state
  const [userForm, setUserForm] = useState<UserFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [researchForm, setResearchForm] = useState<ResearchFormData>({
    ...userForm,
    fullName: '',
    dateOfBirth: '',
    pcpName: '',
    pcpPhone: '',
    pcpEmail: '',
    pcpAddress: '',
    endocrinologistName: '',
    endocrinologistPhone: '',
    endocrinologistEmail: '',
    endocrinologistAddress: '',
    mailingAddress: ''
  });

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData>({
    overallSatisfaction: 5,
    highBloodSugarFrequency: '',
    lowBloodSugarFrequency: '',
    convenienceSatisfaction: 5,
    flexibilitySatisfaction: 5,
    understandingSatisfaction: 5,
    continuationLikelihood: 5,
    recommendationLikelihood: 5,
    additionalComments: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateUserForm = (form: UserFormData): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!form.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email format';

    if (!form.username) newErrors.username = 'Username is required';
    else if (form.username.length < 3) newErrors.username = 'Username must be at least 3 characters';

    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters';

    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    return newErrors;
  };

  const handleStandardSubmit = async () => {
    const validationErrors = validateUserForm(userForm);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const registrationData: UserRegistrationData = {
        email: userForm.email,
        username: userForm.username,
        password: userForm.password,
        isResearchParticipant: false
      };

      // Validate data with service
      const serviceErrors = pumpAuthService.validateRegistrationData(registrationData);
      if (serviceErrors.length > 0) {
        setErrors({ general: serviceErrors.join(', ') });
        return;
      }

      // Register user
      const result = await pumpAuthService.registerUser(registrationData);

      if (result.success) {
        // TODO: Integrate with Stripe payment processing
        // For now, navigate to results after successful registration
        navigate('/pumpdrive/results');
      } else {
        setErrors({ general: result.message });
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Registration failed. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResearchEnrollment = () => {
    setSelectedPath('research');
    setShowQuestionnaire(true);
  };

  const handleQuestionnaireSubmit = async () => {
    setIsSubmitting(true);
    try {
      const registrationData: UserRegistrationData = {
        email: researchForm.email,
        username: researchForm.username,
        password: researchForm.password,
        isResearchParticipant: true,
        researchData: {
          fullName: researchForm.fullName,
          dateOfBirth: researchForm.dateOfBirth,
          pcpName: researchForm.pcpName,
          pcpPhone: researchForm.pcpPhone,
          pcpEmail: researchForm.pcpEmail,
          pcpAddress: researchForm.pcpAddress,
          endocrinologistName: researchForm.endocrinologistName,
          endocrinologistPhone: researchForm.endocrinologistPhone,
          endocrinologistEmail: researchForm.endocrinologistEmail,
          endocrinologistAddress: researchForm.endocrinologistAddress,
          mailingAddress: researchForm.mailingAddress
        },
        questionnaireData: {
          overallSatisfaction: questionnaire.overallSatisfaction,
          highBloodSugarFrequency: questionnaire.highBloodSugarFrequency,
          lowBloodSugarFrequency: questionnaire.lowBloodSugarFrequency,
          convenienceSatisfaction: questionnaire.convenienceSatisfaction,
          flexibilitySatisfaction: questionnaire.flexibilitySatisfaction,
          understandingSatisfaction: questionnaire.understandingSatisfaction,
          continuationLikelihood: questionnaire.continuationLikelihood,
          recommendationLikelihood: questionnaire.recommendationLikelihood,
          additionalComments: questionnaire.additionalComments
        }
      };

      // Validate data with service
      const serviceErrors = pumpAuthService.validateRegistrationData(registrationData);
      if (serviceErrors.length > 0) {
        setErrors({ general: serviceErrors.join(', ') });
        return;
      }

      // Register research participant
      const result = await pumpAuthService.registerUser(registrationData);

      if (result.success) {
        // TODO: Integrate with Stripe payment processing
        // For now, navigate to results after successful registration
        navigate('/pumpdrive/results');
      } else {
        setErrors({ general: result.message });
      }
    } catch (error) {
      console.error('Research registration failed:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Registration failed. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showQuestionnaire) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🔬 Research Enrollment - Pre-Treatment Survey
            </h1>
            <p className="text-xl text-gray-600">
              Help us understand your current diabetes treatment experience
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            {/* Personal Information */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={researchForm.fullName}
                    onChange={(e) => setResearchForm({...researchForm, fullName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={researchForm.dateOfBirth}
                    onChange={(e) => setResearchForm({...researchForm, dateOfBirth: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={researchForm.email}
                    onChange={(e) => setResearchForm({...researchForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={researchForm.username}
                    onChange={(e) => setResearchForm({...researchForm, username: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={researchForm.password}
                    onChange={(e) => setResearchForm({...researchForm, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={researchForm.confirmPassword}
                    onChange={(e) => setResearchForm({...researchForm, confirmPassword: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Medical Provider Information */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Medical Provider Information</h3>

              <h4 className="text-lg font-semibold text-gray-700 mb-4">Primary Care Physician</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <input
                  type="text"
                  placeholder="PCP Name"
                  value={researchForm.pcpName}
                  onChange={(e) => setResearchForm({...researchForm, pcpName: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="tel"
                  placeholder="PCP Phone"
                  value={researchForm.pcpPhone}
                  onChange={(e) => setResearchForm({...researchForm, pcpPhone: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="email"
                  placeholder="PCP Email"
                  value={researchForm.pcpEmail}
                  onChange={(e) => setResearchForm({...researchForm, pcpEmail: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <textarea
                  placeholder="PCP Address"
                  value={researchForm.pcpAddress}
                  onChange={(e) => setResearchForm({...researchForm, pcpAddress: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                />
              </div>

              <h4 className="text-lg font-semibold text-gray-700 mb-4">Endocrinologist</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <input
                  type="text"
                  placeholder="Endocrinologist Name"
                  value={researchForm.endocrinologistName}
                  onChange={(e) => setResearchForm({...researchForm, endocrinologistName: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="tel"
                  placeholder="Endocrinologist Phone"
                  value={researchForm.endocrinologistPhone}
                  onChange={(e) => setResearchForm({...researchForm, endocrinologistPhone: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="email"
                  placeholder="Endocrinologist Email"
                  value={researchForm.endocrinologistEmail}
                  onChange={(e) => setResearchForm({...researchForm, endocrinologistEmail: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <textarea
                  placeholder="Endocrinologist Address"
                  value={researchForm.endocrinologistAddress}
                  onChange={(e) => setResearchForm({...researchForm, endocrinologistAddress: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Mailing Address (for $50 check)</label>
                <textarea
                  value={researchForm.mailingAddress}
                  onChange={(e) => setResearchForm({...researchForm, mailingAddress: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* Pre-Treatment Questionnaire */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Pre-Treatment Satisfaction Survey</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall, how satisfied are you with your current diabetes treatment? (1 = Very Dissatisfied, 10 = Very Satisfied)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionnaire.overallSatisfaction}
                    onChange={(e) => setQuestionnaire({...questionnaire, overallSatisfaction: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-semibold text-green-600">{questionnaire.overallSatisfaction}/10</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How often have your blood sugars been higher than you'd like recently?
                  </label>
                  <select
                    value={questionnaire.highBloodSugarFrequency}
                    onChange={(e) => setQuestionnaire({...questionnaire, highBloodSugarFrequency: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select frequency...</option>
                    <option value="never">Never</option>
                    <option value="rarely">Rarely</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="often">Often</option>
                    <option value="very_often">Very Often</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How often have your blood sugars been lower than you'd like recently?
                  </label>
                  <select
                    value={questionnaire.lowBloodSugarFrequency}
                    onChange={(e) => setQuestionnaire({...questionnaire, lowBloodSugarFrequency: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select frequency...</option>
                    <option value="never">Never</option>
                    <option value="rarely">Rarely</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="often">Often</option>
                    <option value="very_often">Very Often</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How satisfied are you with the convenience/ease of your treatment? (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionnaire.convenienceSatisfaction}
                    onChange={(e) => setQuestionnaire({...questionnaire, convenienceSatisfaction: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-semibold text-green-600">{questionnaire.convenienceSatisfaction}/10</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How satisfied are you with the flexibility of your treatment in day-to-day life? (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionnaire.flexibilitySatisfaction}
                    onChange={(e) => setQuestionnaire({...questionnaire, flexibilitySatisfaction: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-semibold text-green-600">{questionnaire.flexibilitySatisfaction}/10</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How satisfied are you with how well you understand your diabetes and treatment? (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionnaire.understandingSatisfaction}
                    onChange={(e) => setQuestionnaire({...questionnaire, understandingSatisfaction: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-semibold text-green-600">{questionnaire.understandingSatisfaction}/10</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How satisfied are you with the idea of continuing with your present treatment? (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionnaire.continuationLikelihood}
                    onChange={(e) => setQuestionnaire({...questionnaire, continuationLikelihood: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-semibold text-green-600">{questionnaire.continuationLikelihood}/10</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How likely would you be to recommend your present treatment to another person with diabetes? (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionnaire.recommendationLikelihood}
                    onChange={(e) => setQuestionnaire({...questionnaire, recommendationLikelihood: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-semibold text-green-600">{questionnaire.recommendationLikelihood}/10</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Comments (Optional)</label>
                  <textarea
                    value={questionnaire.additionalComments}
                    onChange={(e) => setQuestionnaire({...questionnaire, additionalComments: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={4}
                    placeholder="Any additional thoughts about your current diabetes treatment..."
                  />
                </div>
              </div>
            </div>

            {/* HIPAA Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">🔒 HIPAA Compliance Notice</h4>
              <p className="text-blue-700 text-sm">
                All information provided is protected under HIPAA regulations. Your data will be securely stored and used only for research purposes with your explicit consent. You may withdraw from the study at any time.
              </p>
            </div>

            {/* Error Display */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleQuestionnaireSubmit}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Complete Research Enrollment & Pay $9.99'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎯 Choose Your Path
          </h1>
          <p className="text-xl text-gray-600">
            Get your personalized insulin pump recommendations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Standard Path */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Standard Access
              </h2>
              <p className="text-gray-600">
                Get your AI-powered pump recommendations with 24-hour access
              </p>
            </div>

            {/* Price Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">$9.99</div>
              <div className="text-gray-600">24-hour access • Instant results</div>
            </div>

            {/* What's Included */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-4">What's Included:</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">Personalized pump recommendations</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">AI-powered analysis of your needs</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">Detailed comparison of top options</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">Professional medical insights</span>
                </div>
                <div className="flex items-center">
                  <span className="text-orange-500 mr-3">⏰</span>
                  <span className="text-gray-700">24-hour access period</span>
                </div>
              </div>
            </div>

            {selectedPath === 'standard' ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Create Your Account</h3>

                {errors.general && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 text-sm">{errors.general}</p>
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={userForm.username}
                    onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Password (min 8 characters)"
                    value={userForm.password}
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={userForm.confirmPassword}
                    onChange={(e) => setUserForm({...userForm, confirmPassword: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
                <button
                  onClick={handleStandardSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Create Account & Pay $9.99'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSelectedPath('standard')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
              >
                Choose Standard Access
              </button>
            )}
          </div>

          {/* Research Path */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-green-200">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🔬</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Research Participation
              </h2>
              <p className="text-gray-600">
                Contribute to diabetes research and earn $50 compensation
              </p>
            </div>

            {/* Price Display */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 mb-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">$9.99</div>
              <div className="text-gray-600">+ Potential $50 compensation</div>
            </div>

            {/* What's Required */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-4">Research Requirements:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">Short survey before and after treatment</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">Survey when you start your new pump</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">Follow-up survey 3 months after starting</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">Medical records before and after starting</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">Lab results prior and after starting</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">Additional medical information as requested</span>
                </div>
              </div>
            </div>

            {/* Compensation Notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-green-800 mb-2">💰 $50 Compensation</h4>
              <p className="text-green-700 text-sm">
                If you submit all required information and the data is verified as complete, we will mail you a $50 check after verification.
              </p>
            </div>

            <button
              onClick={handleResearchEnrollment}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-colors"
            >
              Join Research Study
            </button>
          </div>
        </div>

        {/* Security & Trust */}
        <div className="text-center mt-8">
          <div className="flex justify-center items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <span className="mr-2">🔒</span>
              Secure Payment
            </div>
            <div className="flex items-center">
              <span className="mr-2">⚡</span>
              Instant Access
            </div>
            <div className="flex items-center">
              <span className="mr-2">🏥</span>
              HIPAA Compliant
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}