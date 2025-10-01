'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function HomePageClient() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const login = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const j = await r.json().catch(() => ({}); 
      if (!r.ok) throw new Error(j?.error || `Login failed (${r.status})`);
      window.location.href = '/driver';
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Futuristic background elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-transparent to-cyan-400/20"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl"></div>

      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-7xl px-6">
          <div className="text-center mb-16">
            {/* Enhanced logo with glow effect */}
            <div className="relative inline-block">
              <div
                className="text-7xl md:text-8xl lg:text-9xl font-black tracking-tight"
                style={{
                  fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive",
                  background:
                    'linear-gradient(135deg, #60a5fa 0%, #3b82f6 25%, #1d4ed8 50%, #1e40af 75%, #1e3a8a 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 40px rgba(59, 130, 246, 0.5)',
                }}
              >
                TSHLA
              </div>
              <div
                className="absolute inset-0 text-7xl md:text-8xl lg:text-9xl font-black tracking-tight opacity-20 blur-sm"
                style={{
                  fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive",
                  color: '#3b82f6',
                }}
              >
                TSHLA
              </div>
            </div>
            <p className="text-xl md:text-2xl text-blue-100/80 mt-6 font-light tracking-wide">
              Advanced Healthcare Intelligence Platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Doctor Portal */}
            <div className="group relative">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-slate-800/80 backdrop-blur-xl border border-blue-400/30 rounded-3xl p-8 shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 group-hover:border-blue-400/50">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Doctor Portal</h2>
                </div>
                <p className="text-blue-100/70 mb-6 leading-relaxed">
                  Secure access to advanced medical documentation and AI-powered clinical tools.
                </p>

                <label className="block text-sm font-semibold text-blue-200 mb-2">
                  Access Code
                </label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Enter your secure access code"
                  className="w-full rounded-xl bg-slate-700/50 border border-slate-600 px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                />
                <button
                  onClick={login}
                  disabled={!code.trim() || busy}
                  className="mt-4 w-full rounded-xl px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold disabled:opacity-50 hover:from-blue-500 hover:to-blue-600 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
                >
                  {busy ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Authenticating...
                    </span>
                  ) : (
                    'Access Portal'
                  )}
                </button>
                {err && (
                  <p className="text-sm text-red-400 mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    {err}
                  </p>
                )}
              </div>
            </div>

            {/* Patient Portal */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-slate-800/80 backdrop-blur-xl border border-emerald-400/30 rounded-3xl p-8 shadow-2xl hover:shadow-emerald-500/25 transition-all duration-500 group-hover:border-emerald-400/50 flex flex-col h-full">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-4">
                    <svg
                      className="w-6 h-6 text-white"
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
                  <h2 className="text-2xl font-bold text-white">Patient Portal</h2>
                </div>
                <p className="text-emerald-100/70 mb-6 leading-relaxed flex-grow">
                  Communicate with your AI healthcare assistant using advanced voice technology and
                  personalized care.
                </p>

                <div className="mt-auto">
                  <Link
                    href="/passenger"
                    className="block text-center rounded-xl px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold hover:from-emerald-500 hover:to-emerald-600 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
                  >
                    Enter Patient Portal
                  </Link>
                </div>
              </div>
            </div>

            {/* PumpDrive Portal */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-slate-800/80 backdrop-blur-xl border border-purple-400/30 rounded-3xl p-8 shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 group-hover:border-purple-400/50 flex flex-col h-full">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white">PumpDrive</h2>
                </div>
                <p className="text-purple-100/70 mb-6 leading-relaxed flex-grow">
                  Advanced insulin pump management system with intelligent optimization and
                  real-time monitoring.
                </p>

                <div className="mt-auto">
                  <Link
                    href="/pumpdrive/rank"
                    className="block text-center rounded-xl px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold hover:from-purple-500 hover:to-purple-600 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
                  >
                    Launch Test Drive
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
