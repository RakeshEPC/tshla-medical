'use client';
import React, { useState, useEffect } from 'react';

interface ScreeningResult {
  phq9Score?: number;
  phq9Severity?: string;
  gad7Score?: number;
  gad7Severity?: string;
  completedAt?: string;
}

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself - or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead or of hurting yourself in some way',
];

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all', color: 'bg-green-100 hover:bg-green-200 border-green-300' },
  { value: 1, label: 'Several days', color: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300' },
  {
    value: 2,
    label: 'More than half the days',
    color: 'bg-orange-100 hover:bg-orange-200 border-orange-300',
  },
  { value: 3, label: 'Nearly every day', color: 'bg-red-100 hover:bg-red-200 border-red-300' },
];

export default function MentalHealthScreening({
  patientId,
  avaId,
}: {
  patientId?: string;
  avaId?: string;
}) {
  const [activeForm, setActiveForm] = useState<'phq9' | 'gad7' | null>(null);
  const [phq9Answers, setPhq9Answers] = useState<number[]>(new Array(9).fill(-1));
  const [gad7Answers, setGad7Answers] = useState<number[]>(new Array(7).fill(-1));
  const [results, setResults] = useState<ScreeningResult | null>(null);
  const [previousResults, setPreviousResults] = useState<ScreeningResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Load previous results from localStorage
    const savedResults = localStorage.getItem(`mh_screening_${avaId || patientId}`);
    if (savedResults) {
      setPreviousResults(JSON.parse(savedResults));
    }
  }, [avaId, patientId]);

  const calculatePHQ9Score = () => {
    const score = phq9Answers.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0);
    let severity = '';

    if (score >= 0 && score <= 4) severity = 'Minimal depression';
    else if (score >= 5 && score <= 9) severity = 'Mild depression';
    else if (score >= 10 && score <= 14) severity = 'Moderate depression';
    else if (score >= 15 && score <= 19) severity = 'Moderately severe depression';
    else if (score >= 20) severity = 'Severe depression';

    return { score, severity };
  };

  const calculateGAD7Score = () => {
    const score = gad7Answers.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0);
    let severity = '';

    if (score >= 0 && score <= 4) severity = 'Minimal anxiety';
    else if (score >= 5 && score <= 9) severity = 'Mild anxiety';
    else if (score >= 10 && score <= 14) severity = 'Moderate anxiety';
    else if (score >= 15) severity = 'Severe anxiety';

    return { score, severity };
  };

  const submitPHQ9 = () => {
    if (phq9Answers.some(a => a === -1)) {
      alert('Please answer all questions');
      return;
    }

    const { score, severity } = calculatePHQ9Score();
    const newResult: ScreeningResult = {
      ...results,
      phq9Score: score,
      phq9Severity: severity,
      completedAt: new Date().toISOString(),
    };

    setResults(newResult);
    saveResults(newResult);
    setActiveForm(null);
  };

  const submitGAD7 = () => {
    if (gad7Answers.some(a => a === -1)) {
      alert('Please answer all questions');
      return;
    }

    const { score, severity } = calculateGAD7Score();
    const newResult: ScreeningResult = {
      ...results,
      gad7Score: score,
      gad7Severity: severity,
      completedAt: new Date().toISOString(),
    };

    setResults(newResult);
    saveResults(newResult);
    setActiveForm(null);
  };

  const saveResults = (result: ScreeningResult) => {
    const key = `mh_screening_${avaId || patientId}`;
    const existing = localStorage.getItem(key);
    const history = existing ? JSON.parse(existing) : [];
    history.unshift(result);
    // Keep only last 10 results
    if (history.length > 10) history.pop();
    localStorage.setItem(key, JSON.stringify(history));
    setPreviousResults(history);
  };

  const getSeverityColor = (severity: string) => {
    if (severity.includes('Minimal')) return 'text-green-600';
    if (severity.includes('Mild')) return 'text-yellow-600';
    if (severity.includes('Moderate') && !severity.includes('Moderately severe'))
      return 'text-orange-600';
    if (severity.includes('Moderately severe') || severity.includes('Severe'))
      return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Mental Health Screening</h2>
        <p className="text-gray-600">Complete these questionnaires before your appointment</p>

        {/* Current Results Summary */}
        {results && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Latest Results</h3>
            <div className="grid grid-cols-2 gap-4">
              {results.phq9Score !== undefined && (
                <div>
                  <p className="text-sm text-gray-600">PHQ-9 Score</p>
                  <p
                    className={`text-xl font-bold ${getSeverityColor(results.phq9Severity || '')}`}
                  >
                    {results.phq9Score}/27
                  </p>
                  <p className={`text-sm ${getSeverityColor(results.phq9Severity || '')}`}>
                    {results.phq9Severity}
                  </p>
                </div>
              )}
              {results.gad7Score !== undefined && (
                <div>
                  <p className="text-sm text-gray-600">GAD-7 Score</p>
                  <p
                    className={`text-xl font-bold ${getSeverityColor(results.gad7Severity || '')}`}
                  >
                    {results.gad7Score}/21
                  </p>
                  <p className={`text-sm ${getSeverityColor(results.gad7Severity || '')}`}>
                    {results.gad7Severity}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selection Buttons */}
      {!activeForm && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => {
              setActiveForm('phq9');
              setPhq9Answers(new Array(9).fill(-1));
            }}
            className="bg-blue-600 text-white rounded-xl p-6 hover:bg-blue-700 transition-all shadow-lg"
          >
            <h3 className="text-xl font-bold mb-2">PHQ-9</h3>
            <p className="text-sm opacity-90">Depression Screening</p>
            <p className="text-xs mt-2 opacity-75">9 questions • 3-5 minutes</p>
          </button>

          <button
            onClick={() => {
              setActiveForm('gad7');
              setGad7Answers(new Array(7).fill(-1));
            }}
            className="bg-purple-600 text-white rounded-xl p-6 hover:bg-purple-700 transition-all shadow-lg"
          >
            <h3 className="text-xl font-bold mb-2">GAD-7</h3>
            <p className="text-sm opacity-90">Anxiety Screening</p>
            <p className="text-xs mt-2 opacity-75">7 questions • 2-3 minutes</p>
          </button>
        </div>
      )}

      {/* PHQ-9 Form */}
      {activeForm === 'phq9' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800">PHQ-9 Depression Screening</h3>
              <p className="text-sm text-gray-600 mt-1">
                Over the last 2 weeks, how often have you been bothered by any of the following
                problems?
              </p>
            </div>
            <button
              onClick={() => setActiveForm(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {PHQ9_QUESTIONS.map((question, index) => (
              <div key={index} className="border-b pb-4">
                <p className="font-medium text-gray-800 mb-3">
                  {index + 1}. {question}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {RESPONSE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        const newAnswers = [...phq9Answers];
                        newAnswers[index] = option.value;
                        setPhq9Answers(newAnswers);
                      }}
                      className={`py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                        phq9Answers[index] === option.value
                          ? option.color + ' border-2 font-semibold'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Progress: {phq9Answers.filter(a => a >= 0).length}/9 questions answered
            </div>
            <button
              onClick={submitPHQ9}
              disabled={phq9Answers.some(a => a === -1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit PHQ-9
            </button>
          </div>
        </div>
      )}

      {/* GAD-7 Form */}
      {activeForm === 'gad7' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800">GAD-7 Anxiety Screening</h3>
              <p className="text-sm text-gray-600 mt-1">
                Over the last 2 weeks, how often have you been bothered by any of the following
                problems?
              </p>
            </div>
            <button
              onClick={() => setActiveForm(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {GAD7_QUESTIONS.map((question, index) => (
              <div key={index} className="border-b pb-4">
                <p className="font-medium text-gray-800 mb-3">
                  {index + 1}. {question}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {RESPONSE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        const newAnswers = [...gad7Answers];
                        newAnswers[index] = option.value;
                        setGad7Answers(newAnswers);
                      }}
                      className={`py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                        gad7Answers[index] === option.value
                          ? option.color + ' border-2 font-semibold'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Progress: {gad7Answers.filter(a => a >= 0).length}/7 questions answered
            </div>
            <button
              onClick={submitGAD7}
              disabled={gad7Answers.some(a => a === -1)}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit GAD-7
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {previousResults.length > 0 && !activeForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Screening History</h3>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>

          {showHistory && (
            <div className="space-y-3">
              {previousResults.slice(0, 5).map((result, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">
                    {new Date(result.completedAt || '').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {result.phq9Score !== undefined && (
                      <div>
                        <span className="text-sm font-medium">PHQ-9: </span>
                        <span
                          className={`text-sm font-bold ${getSeverityColor(result.phq9Severity || '')}`}
                        >
                          {result.phq9Score}/27
                        </span>
                      </div>
                    )}
                    {result.gad7Score !== undefined && (
                      <div>
                        <span className="text-sm font-medium">GAD-7: </span>
                        <span
                          className={`text-sm font-bold ${getSeverityColor(result.gad7Severity || '')}`}
                        >
                          {result.gad7Score}/21
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
