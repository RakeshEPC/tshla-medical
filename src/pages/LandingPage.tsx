import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100">
      {/* Futuristic Header */}
      <header className="bg-white/90 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <span className="text-4xl">🏎️</span>
              <h1
                className="text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent"
                style={{
                  fontFamily: 'cursive',
                  letterSpacing: '2px',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                TSHLA
              </h1>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="bg-gradient-to-r from-blue-600 to-teal-600 text-white px-6 py-2 rounded-full font-semibold hover:shadow-lg transition-all transform hover:scale-105"
            >
              Staff Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Canoeing Image */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content - Simplified */}
            <div className="space-y-8">
              <div>
                <h2 className="text-6xl font-black mb-6 leading-none">
                  <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                    Right Pump.
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Right Time.
                  </span>
                </h2>

                <div className="text-3xl font-bold text-gray-800 mb-6">
                  Conquer
                  <span className="inline-block mx-2 px-4 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-lg shadow-lg transform -rotate-1">
                    DIABETES
                  </span>
                  with AI
                </div>

                <p className="text-xl text-gray-700 font-medium">
                  Fast-track to your perfect insulin pump match.
                </p>
              </div>

              {/* Simple Feature Box */}
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 shadow-xl border-2 border-purple-300">
                <div className="flex items-center space-x-3">
                  <span className="text-4xl">⚡</span>
                  <div className="text-lg font-bold text-gray-800">
                    AI analyzes. You decide. Minutes not months.
                  </div>
                </div>
              </div>

              {/* CTA Buttons - Patient Portal moved down */}
              <div className="space-y-4">
                <button
                  onClick={() => navigate('/pumpdrive/create-account')}
                  className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-10 py-5 rounded-full text-xl font-black hover:shadow-2xl transform hover:scale-105 transition-all shadow-lg"
                >
                  START NOW →
                </button>
              </div>
            </div>

            {/* Right Image - Person Canoeing */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-teal-400/20 rounded-3xl transform rotate-3"></div>
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1509914398892-963f53e6e2f1?w=800&h=600&fit=crop"
                  alt="Person smiling while canoeing on a peaceful river"
                  className="w-full h-[500px] object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6">
                  <p className="text-white text-lg font-semibold">
                    "Navigate your health journey with confidence and joy"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Warm Features Section */}
      <section className="py-20 bg-white/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Why Patients Love PumpDrive</h3>
            <p className="text-xl text-gray-600">
              We make finding the right insulin pump as easy as 1-2-3
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">💬</span>
              </div>
              <h4 className="font-bold text-xl mb-3">Friendly Conversations</h4>
              <p className="text-gray-600">
                No complex forms or medical jargon. Just a warm, understanding conversation about
                your needs.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🎯</span>
              </div>
              <h4 className="font-bold text-xl mb-3">Perfect Match</h4>
              <p className="text-gray-600">
                Our AI analyzes your lifestyle, preferences, and medical needs to find your ideal
                pump.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🌈</span>
              </div>
              <h4 className="font-bold text-xl mb-3">Peace of Mind</h4>
              <p className="text-gray-600">
                Get detailed comparisons, insurance information, and expert recommendations all in
                one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white/10 backdrop-blur rounded-3xl p-8">
            <span className="text-5xl mb-4 block">⭐⭐⭐⭐⭐</span>
            <blockquote className="text-2xl font-light italic mb-4">
              "Finding the right insulin pump felt overwhelming until I found PumpDrive. It was like
              having a knowledgeable friend guide me through every option. I finally feel confident
              in my choice!"
            </blockquote>
            <cite className="text-lg opacity-90">- Sarah M., Happy Patient</cite>
          </div>
        </div>
      </section>

      {/* Get Started Card - Free Access */}
      <section className="py-20">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden transform hover:scale-105 transition-transform">
            <div className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-8 text-center">
              <h3 className="text-2xl font-bold mb-2">Ready to Start?</h3>
              <div className="text-5xl font-bold">FREE</div>
              <p className="text-blue-100 mt-2">Get Started Today</p>
            </div>

            <div className="p-8">
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <span className="text-green-500 text-xl mr-3">✓</span>
                  <span className="text-gray-700">Personalized pump recommendations</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-xl mr-3">✓</span>
                  <span className="text-gray-700">Insurance coverage analysis</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-xl mr-3">✓</span>
                  <span className="text-gray-700">Side-by-side comparisons</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-xl mr-3">✓</span>
                  <span className="text-gray-700">Expert AI recommendations</span>
                </li>
              </ul>

              <button
                onClick={() => navigate('/pumpdrive/create-account')}
                className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-full py-4 text-xl font-bold hover:shadow-xl transition-all"
              >
                Begin Your Journey
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Warm Footer */}
      <footer className="bg-white/80 backdrop-blur border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
            {/* About */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4 flex items-center justify-center md:justify-start">
                <span className="text-2xl mr-2">🏥</span>
                About TSHLA
              </h4>
              <p className="text-gray-600 text-sm">
                Empowering patients and healthcare providers with intelligent, compassionate medical
                solutions.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Our Services</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => navigate('/pumpdrive/create-account')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    PumpDrive - Insulin Pump Selection
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Medical Scribe for Providers
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/patient-portal')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Patient Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Get Started</h4>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/facebook')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors w-full md:w-auto"
                >
                  Join Early Access
                </button>
                <p className="text-sm text-gray-500">Be the first to know about new features</p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 text-center space-y-4">
            <button
              onClick={() => navigate('/patient-portal')}
              className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-8 py-3 rounded-full text-lg font-semibold hover:shadow-lg transition-all"
            >
              Patient Portal Access
            </button>
            <p className="text-sm text-gray-500">© 2025 TSHLA. Fast-Track Diabetes Solutions 🏎️</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
