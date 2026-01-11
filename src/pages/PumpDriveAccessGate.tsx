import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { stripeService } from '../services/stripe.service';
import { logInfo, logError } from '../services/logger.service';

/**
 * Access Gate - Clinic vs Independent Selection
 *
 * Appears AFTER questionnaire completion, BEFORE results
 * Simple choice:
 * - Clinic patient (EPC) → Free access
 * - Independent user → Pay $9.99 via Stripe
 *
 * Honor system - no verification (track usage for analytics)
 */
export default function PumpDriveAccessGate() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [selectedOption, setSelectedOption] = useState<'clinic' | 'independent' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/patient-login');
      return;
    }

    // Get the most recent assessment for this user
    fetchLatestAssessment();
  }, [user, navigate]);

  const fetchLatestAssessment = async () => {
    try {
      // AuthContext user.id is actually patients.id, not auth_user_id
      const patientId = user?.id;

      if (!patientId) {
        setError('Patient ID not found. Please log in again.');
        return;
      }

      // Query assessments directly using patients.id
      const { data, error } = await supabase
        .from('pump_assessments')
        .select('id, access_type, payment_status, patient_id')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const assessment = data[0];
        setAssessmentId(assessment.id);

        // If already granted access, redirect to results
        if (assessment.access_type === 'clinic' || (assessment.access_type === 'independent' && assessment.payment_status === 'paid')) {
          navigate('/pumpdrive/results');
        }
      } else {
        setError('No assessment found. Please complete the questionnaire first.');
      }
    } catch (err) {
      logError('AccessGate', 'Failed to fetch assessment', { error: err });
      setError('Unable to load assessment. Please try again.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/patient-login');
  };

  const handleContinue = async () => {
    if (!selectedOption || !assessmentId) return;

    setIsProcessing(true);
    setError(null);

    try {
      if (selectedOption === 'clinic') {
        // Grant free access for clinic patients
        await grantClinicAccess();
      } else {
        // Redirect to Stripe checkout for independent users
        await initiatePayment();
      }
    } catch (err) {
      logError('AccessGate', 'Error processing access', { error: err });
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  const grantClinicAccess = async () => {
    try {
      // Update assessment with clinic access
      const { error: updateError } = await supabase
        .from('pump_assessments')
        .update({
          access_type: 'clinic',
          clinic_name: 'Endocrine & Psychiatry Center',
          payment_status: 'free',
          access_granted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', assessmentId);

      if (updateError) throw updateError;

      logInfo('AccessGate', 'Clinic access granted', {
        assessmentId,
        clinic: 'EPC'
      });

      // Redirect to results
      navigate('/pumpdrive/results');
    } catch (err) {
      throw new Error('Failed to grant clinic access');
    }
  };

  const initiatePayment = async () => {
    try {
      // Get assessment data
      const { data: assessment, error: fetchError } = await supabase
        .from('pump_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (fetchError) throw fetchError;

      // Update access type to independent (payment pending)
      const { error: updateError } = await supabase
        .from('pump_assessments')
        .update({
          access_type: 'independent',
          payment_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', assessmentId);

      if (updateError) throw updateError;

      // Create Stripe checkout session
      const session = await stripeService.createCheckoutSession({
        patientName: user?.user_metadata?.firstName || user?.email || 'Patient',
        assessmentId: assessmentId, // Pass existing assessment ID
        assessmentData: {
          sliderValues: assessment.slider_values,
          selectedFeatures: assessment.selected_features,
          lifestyleText: assessment.lifestyle_text,
          challengesText: assessment.challenges_text,
          prioritiesText: assessment.priorities_text,
          clarificationResponses: assessment.clarification_responses
        },
        successUrl: `${window.location.origin}/pumpdrive/results?paid=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/pumpdrive/access?canceled=true`
      });

      logInfo('AccessGate', 'Stripe checkout initiated', {
        assessmentId,
        sessionId: session.id
      });

      // Redirect to Stripe checkout
      window.location.href = session.url;
    } catch (err) {
      throw new Error('Failed to initiate payment. Please try again.');
    }
  };

  const isDevMode = import.meta.env.VITE_ENABLE_DEV_MODE === 'true';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          {/* Logout Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Access</h1>
            <p className="text-gray-600">
              Some clinics provide this tool as part of care. Otherwise it's available for independent use.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-4 mb-8">
            {/* Clinic Option */}
            <button
              onClick={() => setSelectedOption('clinic')}
              disabled={isProcessing}
              className={`w-full text-left p-6 rounded-xl border-2 transition-all ${
                selectedOption === 'clinic'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === 'clinic'
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedOption === 'clinic' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    I'm a patient at Endocrine & Psychiatry Center (EPC)
                  </h3>
                  <p className="text-sm text-gray-600">
                    Free as part of your care
                  </p>
                </div>
              </div>
            </button>

            {/* Independent Option */}
            <button
              onClick={() => setSelectedOption('independent')}
              disabled={isProcessing}
              className={`w-full text-left p-6 rounded-xl border-2 transition-all ${
                selectedOption === 'independent'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === 'independent'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedOption === 'independent' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    I'm using this independently
                  </h3>
                  <p className="text-sm text-gray-600">
                    $4.99 one-time payment
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selectedOption || isProcessing}
            className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all flex items-center justify-center ${
              selectedOption && !isProcessing
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isProcessing
              ? 'Processing...'
              : selectedOption === 'clinic'
              ? 'Continue to Results'
              : selectedOption === 'independent'
              ? 'Continue to Payment'
              : 'Select an Option'}
          </button>

          {/* Dev Mode Indicator */}
          {isDevMode && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                🔧 <strong>Dev Mode:</strong> Stripe test mode enabled. Use test card: 4242 4242 4242 4242
              </p>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Your selection helps us track how the tool is being used. All information remains confidential.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
