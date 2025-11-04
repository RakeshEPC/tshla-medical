/**
 * Visit Summary - Beta Feature
 * Patient-friendly summary of doctor visits
 *
 * Features:
 * - Easy-to-read format (15-30 seconds)
 * - Action items with checkboxes
 * - Feedback collection
 * - Beta banner with disclaimer
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logInfo, logError } from '../../services/logger.service';

interface VisitSummaryProps {
  visitId: string;
  patientId?: string;
}

interface Summary {
  id: string;
  visit_id: string;
  summary_text: string;
  key_actions: {
    medications: string[];
    labs: string[];
    appointments: string[];
    lifestyle: string[];
  };
  estimated_read_time_seconds: number;
  word_count: number;
  created_at: string;
  provider_approved: boolean;
}

export default function VisitSummaryBeta({ visitId, patientId }: VisitSummaryProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Checklist state
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSummary();
  }, [visitId]);

  async function loadSummary() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('patient_visit_summaries')
        .select('*')
        .eq('visit_id', visitId)
        .eq('provider_approved', true) // Only show approved summaries
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No summary found
          setError('No summary available for this visit yet.');
        } else {
          throw fetchError;
        }
      } else {
        setSummary(data);
        logInfo('visitSummary', 'Summary loaded successfully', { visitId });
      }
    } catch (err: any) {
      logError('visitSummary', `Failed to load summary: ${err.message}`);
      setError('Failed to load visit summary. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback() {
    if (!summary) return;

    try {
      const { error: updateError } = await supabase
        .from('patient_visit_summaries')
        .update({
          was_helpful: helpful,
          helpfulness_rating: rating,
          patient_feedback: feedbackText,
          feedback_submitted_at: new Date().toISOString()
        })
        .eq('id', summary.id);

      if (updateError) throw updateError;

      setFeedbackSubmitted(true);
      logInfo('visitSummary', 'Feedback submitted', { summaryId: summary.id });

    } catch (err: any) {
      logError('visitSummary', `Failed to submit feedback: ${err.message}`);
      alert('Failed to submit feedback. Please try again.');
    }
  }

  function toggleAction(action: string) {
    const newCompleted = new Set(completedActions);
    if (newCompleted.has(action)) {
      newCompleted.delete(action);
    } else {
      newCompleted.add(action);
    }
    setCompletedActions(newCompleted);
  }

  function renderMarkdown(text: string) {
    // Simple markdown rendering
    return text
      .split('\n')
      .map((line, i) => {
        // Bold text
        if (line.match(/^\*\*.*\*\*$/)) {
          const cleanText = line.replace(/\*\*/g, '');
          return (
            <h3 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">
              {cleanText}
            </h3>
          );
        }
        // Regular paragraph
        return (
          <p key={i} className="text-gray-700 mb-2 leading-relaxed">
            {line}
          </p>
        );
      });
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const allActions = [
    ...summary.key_actions.medications,
    ...summary.key_actions.labs,
    ...summary.key_actions.appointments,
    ...summary.key_actions.lifestyle
  ];

  const hasActions = allActions.length > 0;
  const completionPercent = hasActions
    ? Math.round((completedActions.size / allActions.length) * 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Beta Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
        <div className="flex items-start">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              This Feature is in Beta
            </p>
            <p className="text-sm text-blue-700">
              We're testing this new way to make visit summaries easier to understand.
              Please let us know if anything is unclear or if you spot any errors!
            </p>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📋</span>
            Your Visit Summary
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {summary.estimated_read_time_seconds} second read • {summary.word_count} words
          </p>
        </div>

        {/* Summary Content */}
        <div className="p-6">
          <div className="prose prose-lg max-w-none">
            {renderMarkdown(summary.summary_text)}
          </div>
        </div>

        {/* Action Items Checklist */}
        {hasActions && (
          <div className="bg-yellow-50 border-t border-yellow-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span>✅</span>
                Your To-Do List
              </h3>
              <div className="text-sm text-gray-600">
                {completedActions.size} of {allActions.length} done ({completionPercent}%)
              </div>
            </div>

            <div className="space-y-3">
              {summary.key_actions.medications.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">💊 Medications:</p>
                  {summary.key_actions.medications.map((item, i) => (
                    <label
                      key={`med-${i}`}
                      className="flex items-start gap-3 p-2 hover:bg-yellow-100 rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={completedActions.has(item)}
                        onChange={() => toggleAction(item)}
                        className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-800 flex-1">{item}</span>
                    </label>
                  ))}
                </div>
              )}

              {summary.key_actions.labs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">🔬 Tests/Labs:</p>
                  {summary.key_actions.labs.map((item, i) => (
                    <label
                      key={`lab-${i}`}
                      className="flex items-start gap-3 p-2 hover:bg-yellow-100 rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={completedActions.has(item)}
                        onChange={() => toggleAction(item)}
                        className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-800 flex-1">{item}</span>
                    </label>
                  ))}
                </div>
              )}

              {summary.key_actions.appointments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">📅 Appointments:</p>
                  {summary.key_actions.appointments.map((item, i) => (
                    <label
                      key={`appt-${i}`}
                      className="flex items-start gap-3 p-2 hover:bg-yellow-100 rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={completedActions.has(item)}
                        onChange={() => toggleAction(item)}
                        className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-800 flex-1">{item}</span>
                    </label>
                  ))}
                </div>
              )}

              {summary.key_actions.lifestyle.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">🏃 Lifestyle:</p>
                  {summary.key_actions.lifestyle.map((item, i) => (
                    <label
                      key={`lifestyle-${i}`}
                      className="flex items-start gap-3 p-2 hover:bg-yellow-100 rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={completedActions.has(item)}
                        onChange={() => toggleAction(item)}
                        className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-800 flex-1">{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {completionPercent === 100 && (
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                <p className="text-green-800 font-medium text-center">
                  🎉 Great job! You've completed all your action items!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feedback Section */}
      {!feedbackSubmitted ? (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>💬</span>
            Help Us Improve
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            If there were any errors or confusing parts, please let us know.
            We're still in beta and testing this feature!
          </p>

          {!showFeedback ? (
            <button
              onClick={() => setShowFeedback(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Give Feedback
            </button>
          ) : (
            <div className="space-y-4">
              {/* Helpful Yes/No */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Was this summary helpful?
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setHelpful(true)}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      helpful === true
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    👍 Yes, very helpful
                  </button>
                  <button
                    onClick={() => setHelpful(false)}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      helpful === false
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 hover:border-red-400'
                    }`}
                  >
                    👎 Not very helpful
                  </button>
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate this summary (1-5 stars)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="text-3xl transition-transform hover:scale-110"
                    >
                      {star <= rating ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Found an error or have suggestions?
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Tell us what was wrong, unclear, or how we can improve..."
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={submitFeedback}
                disabled={helpful === null || rating === 0}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Submit Feedback
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <p className="text-green-800 font-medium">
            ✅ Thank you for your feedback! Your input helps us make this feature better.
          </p>
        </div>
      )}
    </div>
  );
}
