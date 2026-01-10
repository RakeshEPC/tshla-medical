import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * PumpDrive Marketing Homepage
 *
 * Clean, credibility-focused landing page for insulin pump decision tool
 * Features:
 * - Hero section with clear value proposition
 * - Clinician-designed framework credibility
 * - Primary CTA: Start Pump Decision
 * - Staff login moved to footer
 */
export default function PumpDriveHomepage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      // Returning user - go to results
      navigate('/pumpdrive/results');
    } else {
      // New user - go to registration
      navigate('/patient-register');
    }
  };

  const handleLogin = () => {
    navigate('/patient-login');
  };

  const handleStaffLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Top Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">TSHLA</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <button
                  onClick={() => navigate('/pumpdrive/results')}
                  className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  My Results
                </button>
              ) : (
                <>
                  <button
                    onClick={handleLogin}
                    className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Start Pump Decision
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Make a pump decision<br />you can stand behind.
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-600 mb-10 leading-relaxed">
            AI assists with processing. The decision framework is clinician-designed
            and refined through real-world pump use patterns.
          </p>

          {/* Primary CTA */}
          <button
            onClick={handleGetStarted}
            className="bg-blue-600 text-white px-12 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {user ? 'View My Results' : 'Start Pump Decision'}
          </button>

          {/* Secondary info */}
          {!user && (
            <p className="mt-4 text-sm text-gray-500">
              Results in minutes, clarity for years
            </p>
          )}
        </div>
      </section>

      {/* Credibility Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Built on clinical judgment, powered by AI
            </h2>

            <div className="grid md:grid-cols-2 gap-6 mb-10">
              {/* Credibility Points */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Clinician-designed decision framework</h3>
                  <p className="text-gray-600 text-sm">Not generic AI prompting</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Real-world friction points</h3>
                  <p className="text-gray-600 text-sm">Water exposure, device fatigue, tubing tolerance, control preferences</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Doctor-ready summary</h3>
                  <p className="text-gray-600 text-sm">Outputs you can share with your healthcare team</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Privacy-first, HIPAA-conscious</h3>
                  <p className="text-gray-600 text-sm">Your data is encrypted and protected</p>
                </div>
              </div>
            </div>

            {/* Key Differentiators */}
            <div className="border-t border-gray-200 pt-8 space-y-4">
              <p className="text-gray-700 italic text-center">
                "AI processes the information; the framework reflects clinical judgment."
              </p>
              <p className="text-gray-700 italic text-center">
                "This tool resolves decisions — not just answers questions."
              </p>
              <p className="text-gray-700 italic text-center">
                "General AI lists pumps. This tool structures the choice."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Three simple steps to clarity
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Account</h3>
              <p className="text-gray-600">Quick registration with secure HIPAA-compliant storage</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Answer Questions</h3>
              <p className="text-gray-600">Structured assessment about your lifestyle and preferences</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Recommendations</h3>
              <p className="text-gray-600">Personalized pump matches with detailed comparisons</p>
            </div>
          </div>

          <div className="mt-12">
            <button
              onClick={handleGetStarted}
              className="bg-blue-600 text-white px-10 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
            >
              {user ? 'View My Results' : 'Get Started Now'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-gray-600 text-sm">
                © 2026 TSHLA Medical. All rights reserved.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                AI-assisted processing within a clinician-designed decision framework. Not medical advice.
              </p>
            </div>

            <div className="flex items-center space-x-6">
              <a href="/privacy-policy" className="text-gray-600 hover:text-gray-900 text-sm">
                Privacy Policy
              </a>
              <a href="/terms" className="text-gray-600 hover:text-gray-900 text-sm">
                Terms of Service
              </a>
              <button
                onClick={handleStaffLogin}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Staff Login
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
