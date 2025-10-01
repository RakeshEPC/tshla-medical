'use client';
import React, { useState } from 'react';

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen',
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

interface GAD7FormProps {
  onComplete: (score: number, responses: number[]) => void;
  initialResponses?: number[];
}

export default function GAD7Form({ onComplete, initialResponses }: GAD7FormProps) {
  const [responses, setResponses] = useState<number[]>(initialResponses || new Array(7).fill(-1));

  const handleResponseChange = (questionIndex: number, value: number) => {
    const newResponses = [...responses];
    newResponses[questionIndex] = value;
    setResponses(newResponses);
  };

  const calculateScore = () => {
    return responses.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0);
  };

  const getSeverity = (score: number) => {
    if (score >= 15) return 'Severe Anxiety';
    if (score >= 10) return 'Moderate Anxiety';
    if (score >= 5) return 'Mild Anxiety';
    return 'Minimal Anxiety';
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
        <h2 className="text-2xl font-bold text-gray-800 mb-2">GAD-7 Anxiety Screening</h2>
        <p className="text-gray-600">
          Over the last 2 weeks, how often have you been bothered by any of the following problems?
        </p>
      </div>

      <div className="space-y-6">
        {GAD7_QUESTIONS.map((question, index) => (
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
                        ? 'border-green-500 bg-green-50 text-green-700'
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
      <div className="mt-6 p-4 bg-green-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Current Score: {currentScore} / 21
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
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isComplete()
              ? 'Submit Assessment'
              : `Complete All Questions (${responses.filter(r => r >= 0).length}/7)`}
          </button>
        </div>
      </div>

      {/* Severity Guidelines */}
      <div className="mt-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold text-gray-700 mb-2">Score Interpretation:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 0-4: Minimal anxiety</li>
          <li>• 5-9: Mild anxiety</li>
          <li>• 10-14: Moderate anxiety</li>
          <li>• 15-21: Severe anxiety</li>
        </ul>
        <p className="text-sm text-gray-500 mt-2">
          Scores of 10 or greater warrant further evaluation.
        </p>
      </div>
    </div>
  );
}
