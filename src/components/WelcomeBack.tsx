import React from 'react';
import { WelcomeBackData } from '../types/context7.types';

interface WelcomeBackProps {
  data: WelcomeBackData;
  onResume: () => void;
  onStartOver: () => void;
}

export function WelcomeBack({ data, onResume, onStartOver }: WelcomeBackProps) {
  if (!data.sessionFound || !data.session) {
    return null;
  }

  return (
    <div className="mb-6 p-6 rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">👋</span>
            <h3 className="text-xl font-bold text-gray-900">Welcome Back!</h3>
          </div>

          <p className="text-gray-700 mb-3">
            You started your pump assessment <strong>{data.lastVisit}</strong>
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="text-gray-700">
                <strong>{data.completionStatus}</strong> ({data.session.percentComplete}% complete)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <span className="text-gray-700">
                Estimated time to finish: <strong>{data.estimatedTimeRemaining}</strong>
              </span>
            </div>

            {data.session.priorities.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-lg">⭐</span>
                <span className="text-gray-700">
                  Your priorities: <strong>{data.session.priorities.join(', ')}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                style={{ width: `${data.session.percentComplete}%` }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onResume}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Continue Assessment →
            </button>
            <button
              onClick={onStartOver}
              className="px-6 py-2.5 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors border border-gray-300"
            >
              Start Over
            </button>
          </div>
        </div>

        <div className="ml-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-3xl">{data.session.percentComplete < 50 ? '🚀' : '🎯'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
