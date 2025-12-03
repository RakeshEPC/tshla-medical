import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { dtsqsService } from '../services/dtsqs.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { logInfo, logError } from '../services/logger.service';
import { DTSQS_QUESTIONS, DTSQS_CITATION } from '../data/dtsqsQuestions';
import type { DTSQsResponse } from '../types/dtsqs.types';

export default function PumpDriveDTSQs() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Partial<DTSQsResponse>>({});
  const [showHelp, setShowHelp] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already completed (redirect if so)
  useEffect(() => {
    const checkCompletion = async () => {
      const completion = await dtsqsService.getDTSQsCompletion();
      if (completion.completed) {
        logInfo('DTSQs', 'Already completed - redirecting to assessment', {});
        navigate('/pumpdrive/assessment');
      }
    };
    checkCompletion();
  }, [navigate]);

  const totalQuestions = DTSQS_QUESTIONS.length;
  const question = DTSQS_QUESTIONS[currentQuestion];
  const progressPercent = ((currentQuestion + 1) / totalQuestions) * 100;
  const isLastQuestion = currentQuestion === totalQuestions - 1;

  // Check if current question is answered
  const currentAnswer = responses[question.id as keyof DTSQsResponse];
  const canProceed = currentAnswer !== undefined;

  const handleSelectAnswer = (value: number) => {
    setResponses(prev => ({
      ...prev,
      [question.id]: value
    }));
    setError(null);
  };

  const handleNext = () => {
    if (!canProceed) {
      setError('Please select an answer before continuing');
      return;
    }

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestion(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate all questions answered
      const allAnswered = DTSQS_QUESTIONS.every(
        q => responses[q.id as keyof DTSQsResponse] !== undefined
      );

      if (!allAnswered) {
        setError('Please answer all questions before submitting');
        setLoading(false);
        return;
      }

      const completedResponses: DTSQsResponse = {
        q1_treatment_satisfaction: responses.q1_treatment_satisfaction!,
        q2_high_blood_sugars: responses.q2_high_blood_sugars!,
        q3_low_blood_sugars: responses.q3_low_blood_sugars!,
        q4_convenience: responses.q4_convenience!,
        q5_flexibility: responses.q5_flexibility!,
        q6_understanding: responses.q6_understanding!,
        q7_recommend: responses.q7_recommend!,
        q8_continue: responses.q8_continue!,
        completed_at: new Date().toISOString()
      };

      logInfo('DTSQs', 'Submitting responses', { responses: completedResponses });

      const result = await dtsqsService.saveDTSQsResponses(completedResponses);

      if (!result.success) {
        setError(result.error || 'Failed to save responses');
        setLoading(false);
        return;
      }

      logInfo('DTSQs', 'Responses saved - redirecting to assessment', {});

      // Redirect to main assessment
      navigate('/pumpdrive/assessment');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logError('DTSQs', 'Error submitting responses', { error: errorMessage });
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Generate scale values (0-6)
  const scaleValues = [6, 5, 4, 3, 2, 1, 0];

  // Color gradient for visual feedback
  const getScaleColor = (value: number, isInverted: boolean) => {
    // For inverted questions (Q2, Q3), colors are reversed
    const effectiveValue = isInverted ? 6 - value : value;

    if (effectiveValue >= 5) return 'bg-green-500 border-green-600';
    if (effectiveValue >= 4) return 'bg-green-400 border-green-500';
    if (effectiveValue >= 3) return 'bg-yellow-400 border-yellow-500';
    if (effectiveValue >= 2) return 'bg-orange-400 border-orange-500';
    return 'bg-red-500 border-red-600';
  };

  const getScaleTextColor = (value: number, isInverted: boolean) => {
    const effectiveValue = isInverted ? 6 - value : value;
    return effectiveValue >= 3 ? 'text-white' : 'text-white';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Treatment Satisfaction Assessment</h1>
              <p className="text-sm text-gray-600 mt-1">
                Help us understand your current diabetes management experience
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">
                Question {currentQuestion + 1} of {totalQuestions}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(progressPercent)}% complete
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold text-gray-900 flex-1 pr-4">
                {question.number}. {question.question}
              </h2>

              {/* Help Button */}
              {question.helpText && (
                <button
                  onClick={() => setShowHelp(showHelp === question.number ? null : question.number)}
                  className="flex-shrink-0 text-blue-600 hover:text-blue-700 transition-colors"
                  aria-label="Show help"
                >
                  <HelpCircle className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Help Text */}
            {showHelp === question.number && question.helpText && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">{question.helpText}</p>
              </div>
            )}
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="text-sm font-medium text-gray-700 text-left flex-1">
              {question.leftLabel}
            </div>
            <div className="text-sm font-medium text-gray-700 text-right flex-1">
              {question.rightLabel}
            </div>
          </div>

          {/* Radio Scale */}
          <div className="space-y-3">
            {scaleValues.map(value => {
              const isSelected = currentAnswer === value;
              const colorClass = getScaleColor(value, question.inverted);
              const textColorClass = getScaleTextColor(value, question.inverted);

              return (
                <button
                  key={value}
                  onClick={() => handleSelectAnswer(value)}
                  className={`w-full p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? `${colorClass} ${textColorClass} shadow-lg scale-105`
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-white border-white'
                            : 'border-gray-400'
                        }`}
                      >
                        {isSelected && (
                          <div className={`w-3 h-3 rounded-full ${colorClass.split(' ')[0]}`} />
                        )}
                      </div>
                      <span className={`font-medium ${isSelected ? textColorClass : 'text-gray-900'}`}>
                        {value}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle className={`w-5 h-5 ${textColorClass}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentQuestion === 0}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                currentQuestion === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed || loading}
              className={`px-8 py-3 rounded-xl font-medium transition-all flex items-center space-x-2 ${
                !canProceed || loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg'
              }`}
            >
              <span>{loading ? 'Saving...' : isLastQuestion ? 'Complete' : 'Next'}</span>
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Attribution Footer */}
        <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
          <p>{DTSQS_CITATION.copyright}</p>
          <p>{DTSQS_CITATION.licenseRef}</p>
          <p>{DTSQS_CITATION.version}</p>
          <p>
            <a
              href={`https://${DTSQS_CITATION.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {DTSQS_CITATION.website}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
