'use client';
import React, { useState } from 'react';

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead or of hurting yourself in some way',
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

interface PHQ9FormProps {
  onComplete: (score: number, responses: number[]) => void;
  initialResponses?: number[];
}

export default function PHQ9Form({ onComplete, initialResponses }: PHQ9FormProps) {
  const [responses, setResponses] = useState<number[]>(initialResponses || new Array(9).fill(-1));

  const handleResponseChange = (questionIndex: number, value: number) => {
    const newResponses = [...responses];
    newResponses[questionIndex] = value;
    setResponses(newResponses);
  };

  const calculateScore = () => {
    return responses.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0);
  };

  const getSeverity = (score: number) => {
    if (score >= 20) return 'Severe Depression';
    if (score >= 15) return 'Moderately Severe Depression';
    if (score >= 10) return 'Moderate Depression';
    if (score >= 5) return 'Mild Depression';
    return 'Minimal Depression';
  };

  const isComplete = () => {
    return responses.every(r => r >= 0);
  };

  const handleSubmit = () => {
    if (isComplete()) {
      const score = calculateScore();
      onComplete(score, responses);
    }
  };

  const currentScore = calculateScore();
  const severity = getSeverity(currentScore);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">PHQ-9 Depression Screening</h2>
        <p className="text-gray-600">
          Over the last 2 weeks, how often have you been bothered by any of the following problems?
        </p>
      </div>

      <div className="space-y-6">
        {PHQ9_QUESTIONS.map((question, index) => (
          <div key={index} className="border-b pb-4">
            <p className="font-medium text-gray-700 mb-3">
              {index + 1}. {question}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {RESPONSE_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className={`
                    flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      responses[index] === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name={`question-${index}`}
                    value={option.value}
                    checked={responses[index] === option.value}
                    onChange={() => handleResponseChange(index, option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-center">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Difficulty Question */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 italic">
          If you checked off any problems, how difficult have these problems made it for you to do
          your work, take care of things at home, or get along with other people?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            'Not difficult at all',
            'Somewhat difficult',
            'Very difficult',
            'Extremely difficult',
          ].map(level => (
            <span key={level} className="px-3 py-1 bg-white rounded border text-sm text-gray-600">
              {level}
            </span>
          ))}
        </div>
      </div>

      {/* Score Display */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Current Score: {currentScore} / 27
            </p>
            <p
              className={`text-sm mt-1 ${
                currentScore >= 10 ? 'text-orange-600 font-medium' : 'text-gray-600'
              }`}
            >
              Severity: {severity}
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!isComplete()}
            className={`
              px-6 py-3 rounded-lg font-medium transition-all
              ${
                isComplete()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isComplete()
              ? 'Submit Assessment'
              : `Complete All Questions (${responses.filter(r => r >= 0).length}/9)`}
          </button>
        </div>
      </div>

      {/* Severity Guidelines */}
      <div className="mt-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold text-gray-700 mb-2">Score Interpretation:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 0-4: Minimal depression</li>
          <li>• 5-9: Mild depression</li>
          <li>• 10-14: Moderate depression</li>
          <li>• 15-19: Moderately severe depression</li>
          <li>• 20-27: Severe depression</li>
        </ul>
      </div>
    </div>
  );
}
