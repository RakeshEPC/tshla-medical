import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SimranPumpLLMSimple() {
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const questions = [
    'Do you prefer a tubeless pump or traditional tubing?',
    'How important is smartphone control to you?',
    'Do you want aggressive or conservative glucose management?',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900">
                ← Back
              </button>
              <h1 className="text-xl font-bold text-purple-800">
                Pump Selection Assistant (Simple)
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-4xl">🤖</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">AI Pump Selection Assistant</h2>
            <p className="text-gray-600 mt-2">Let's find your perfect insulin pump!</p>
          </div>

          {/* Current Question */}
          <div className="mb-8">
            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">
                Question {currentQuestionIndex + 1} of {questions.length}
              </h3>
              <p className="text-xl text-gray-800">{questions[currentQuestionIndex]}</p>
            </div>
          </div>

          {/* Answer Buttons */}
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => {
                if (currentQuestionIndex < questions.length - 1) {
                  setCurrentQuestionIndex(prev => prev + 1);
                } else {
                  alert(
                    'Questionnaire complete! In the full version, you would get pump recommendations here.'
                  );
                }
              }}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full shadow-lg hover:scale-105 transition"
            >
              Next Question →
            </button>
          </div>

          {/* Recording Status */}
          <div className="text-center">
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`px-6 py-3 rounded-full font-medium ${
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {isRecording ? '🔴 Recording...' : '🎤 Start Voice'}
            </button>
          </div>

          {/* Debug Info */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p>This is a simplified version for testing.</p>
            <p>Voice features are disabled in this version.</p>
            <p>Full version includes: ElevenLabs TTS, 23 dimensions, 6 pumps</p>
          </div>
        </div>
      </div>
    </div>
  );
}
