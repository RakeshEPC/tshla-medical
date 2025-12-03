import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Tesla-Style Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-tesla-dark-gray tracking-tight">
                TSHLA
              </h1>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="btn-tesla btn-tesla-secondary text-sm"
            >
              Staff Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section - Tesla Style */}
      <section className="bg-tesla-dark-gray text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content - Minimal */}
            <div className="space-y-12">
              <div className="space-y-6">
                <h2 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                  Right Pump.<br />Right Time.
                </h2>

                <p className="text-xl lg:text-2xl font-light text-gray-300 max-w-xl">
                  Conquer Diabetes with AI
                </p>

                <p className="text-lg font-light text-gray-400 max-w-lg">
                  Fast-track to your perfect insulin pump match. AI analyzes your needs in minutes, not months.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => navigate('/patient-register')}
                  className="btn-tesla btn-tesla-primary px-12 py-4 text-base"
                >
                  Get Started
                </button>
                <button
                  onClick={() => navigate('/patient-login')}
                  className="btn-tesla btn-tesla-outline-light px-8 py-4 text-base"
                >
                  Sign In
                </button>
              </div>
            </div>

            {/* Right Image - Clean */}
            <div className="relative">
              <div className="bg-tesla-medium-gray rounded-lg overflow-hidden shadow-tesla-lg">
                <img
                  src="https://images.unsplash.com/photo-1509914398892-963f53e6e2f1?w=800&h=600&fit=crop"
                  alt="Person smiling while canoeing on a peaceful river"
                  className="w-full h-[500px] object-cover opacity-90"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Tesla Minimal */}
      <section className="py-24 bg-tesla-silver">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-tesla-dark-gray mb-4">Why Choose PumpDrive</h3>
            <p className="text-lg font-light text-tesla-light-gray max-w-2xl mx-auto">
              Finding the right insulin pump simplified
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <h4 className="text-xl font-bold text-tesla-dark-gray">Simple Process</h4>
              <p className="text-tesla-light-gray font-light leading-relaxed">
                No complex forms or medical jargon. Just a straightforward conversation about your needs.
              </p>
            </div>

            <div className="text-center space-y-4">
              <h4 className="text-xl font-bold text-tesla-dark-gray">AI-Powered Match</h4>
              <p className="text-tesla-light-gray font-light leading-relaxed">
                Our AI analyzes your lifestyle, preferences, and medical needs to find your ideal pump.
              </p>
            </div>

            <div className="text-center space-y-4">
              <h4 className="text-xl font-bold text-tesla-dark-gray">Complete Information</h4>
              <p className="text-tesla-light-gray font-light leading-relaxed">
                Get detailed comparisons, insurance information, and expert recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section - Tesla Clean */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <blockquote className="text-2xl lg:text-3xl font-light text-tesla-dark-gray leading-relaxed mb-6">
            "Finding the right insulin pump felt overwhelming until I found PumpDrive. I finally feel confident in my choice."
          </blockquote>
          <cite className="text-base font-medium text-tesla-light-gray">Sarah M.</cite>
        </div>
      </section>

      {/* Diabetes Education Section - Tesla Style */}
      <section className="py-24 bg-tesla-dark-gray text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-4xl lg:text-5xl font-bold mb-4">
              Diabetes Education
            </h3>
            <p className="text-xl font-light text-gray-300 max-w-2xl mx-auto">
              24/7 AI Support • Talk to an expert anytime
            </p>
          </div>

          <div className="bg-tesla-medium-gray rounded-lg p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <p className="text-lg font-light text-gray-200 leading-relaxed">
                  Get personalized answers about your diabetes care. Our AI diabetes educator knows your medications,
                  lab results, and medical history to provide tailored guidance.
                </p>

                <ul className="space-y-4">
                  <li className="flex items-start">
                    <span className="text-blue-400 font-bold mr-3">✓</span>
                    <span className="font-light text-gray-200">Ask about your medications and side effects</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 font-bold mr-3">✓</span>
                    <span className="font-light text-gray-200">Understand your lab results and A1C</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 font-bold mr-3">✓</span>
                    <span className="font-light text-gray-200">Learn about diet and lifestyle changes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 font-bold mr-3">✓</span>
                    <span className="font-light text-gray-200">Get answers about diabetes complications</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 font-bold mr-3">✓</span>
                    <span className="font-light text-gray-200">Available in English, Spanish, and French</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-lg p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Call Now - Available 24/7</p>
                  <p className="text-3xl font-bold text-tesla-dark-gray mb-1">
                    +1 (XXX) XXX-XXXX
                  </p>
                  <p className="text-xs text-gray-500">
                    10-minute consultations • Secure & confidential
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">
                    <strong className="text-gray-900">How it works:</strong>
                  </p>
                  <ol className="text-left text-sm text-gray-700 space-y-2">
                    <li className="flex items-start">
                      <span className="font-bold text-blue-600 mr-2">1.</span>
                      Your clinic creates your account and uploads your medical info
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-blue-600 mr-2">2.</span>
                      Call the number above from your registered phone
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-blue-600 mr-2">3.</span>
                      Talk to the AI educator about any diabetes questions
                    </li>
                  </ol>
                </div>

                <p className="text-xs text-gray-500 italic">
                  Available only to registered patients. Contact your clinic to enroll.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Card - Tesla Minimal */}
      <section className="py-24 bg-tesla-silver">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-12 text-center space-y-8">
              <div>
                <h3 className="text-3xl font-bold text-tesla-dark-gray mb-3">Ready to Start?</h3>
                <p className="text-lg font-light text-tesla-light-gray">Free assessment. No commitment required.</p>
              </div>

              <ul className="space-y-4 text-left max-w-md mx-auto">
                <li className="flex items-start">
                  <span className="text-tesla-dark-gray font-bold mr-3">•</span>
                  <span className="text-tesla-dark-gray font-light">Personalized pump recommendations</span>
                </li>
                <li className="flex items-start">
                  <span className="text-tesla-dark-gray font-bold mr-3">•</span>
                  <span className="text-tesla-dark-gray font-light">Insurance coverage analysis</span>
                </li>
                <li className="flex items-start">
                  <span className="text-tesla-dark-gray font-bold mr-3">•</span>
                  <span className="text-tesla-dark-gray font-light">Side-by-side comparisons</span>
                </li>
                <li className="flex items-start">
                  <span className="text-tesla-dark-gray font-bold mr-3">•</span>
                  <span className="text-tesla-dark-gray font-light">Expert AI recommendations</span>
                </li>
              </ul>

              <button
                onClick={() => navigate('/patient-register')}
                className="btn-tesla btn-tesla-primary px-16 py-4 text-base"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Tesla Minimal */}
      <footer className="bg-white border-t border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* About */}
            <div>
              <h4 className="font-bold text-tesla-dark-gray mb-4">TSHLA Medical</h4>
              <p className="text-tesla-light-gray text-sm font-light leading-relaxed">
                Empowering patients and healthcare providers with intelligent medical solutions.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-bold text-tesla-dark-gray mb-4">Services</h4>
              <ul className="space-y-3 text-sm font-light">
                <li>
                  <button
                    onClick={() => navigate('/patient-login')}
                    className="link-tesla"
                  >
                    PumpDrive Assessment
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/login')}
                    className="link-tesla"
                  >
                    Provider Portal
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/patient-login')}
                    className="link-tesla"
                  >
                    Patient Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-tesla-dark-gray mb-4">Security</h4>
              <p className="text-sm font-light text-tesla-light-gray">
                HIPAA Compliant<br />
                SOC 2 Type II Certified<br />
                All access monitored
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200 text-center">
            <p className="text-sm font-light text-tesla-light-gray">© 2025 TSHLA Medical. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
