/**
 * Nutrition Note Review Page
 * AI-powered nutrition note processing with dietician feedback
 *
 * Flow:
 * 1. Nutritionist pastes note -> hits "Process"
 * 2. AI generates summary + 5 recommendations (array)
 * 3. Dietician reviews each recommendation inline, can type notes next to each
 * 4. If disagree -> provides overall feedback
 * 5. Everything saved to Supabase for RAG learning
 *
 * No login required - open access
 * Created: 2026-02-04
 */

import { useState, useCallback } from 'react';
import { env } from '../config/environment';

// Types
interface ProcessResult {
  id: string | null;
  summary: string;
  recommendations: string[];
  tokensUsed: number;
  ragExamplesUsed: number;
}

interface ReviewStats {
  total: number;
  approved: number;
  revised: number;
  rejected: number;
  pendingReview: number;
  agreementRate: number;
}

type Step = 'input' | 'review' | 'feedback' | 'complete';

const API_BASE = env.app.apiUrl;

export default function NutritionReview() {
  // State
  const [step, setStep] = useState<Step>('input');
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProcessResult | null>(null);

  // Feedback state
  const [dieticianName, setDieticianName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [revisedSummary, setRevisedSummary] = useState('');
  // Per-recommendation notes from the dietician
  const [recNotes, setRecNotes] = useState<string[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Stats
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Update a single recommendation note
  const updateRecNote = useCallback((index: number, value: string) => {
    setRecNotes(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  // Process the note
  const handleProcess = useCallback(async () => {
    if (!note.trim() || note.trim().length < 20) {
      setError('Please paste a nutrition note with at least 20 characters.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/nutrition-review/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim(), noteType })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to process note');
        return;
      }

      // Ensure recommendations is an array
      let recs = data.recommendations;
      if (typeof recs === 'string') {
        try {
          recs = JSON.parse(recs);
        } catch {
          recs = recs.split(/\n?\d+\.\s+/).filter((r: string) => r.trim().length > 0);
        }
      }
      if (!Array.isArray(recs)) {
        recs = [String(recs)];
      }

      setResult({ ...data, recommendations: recs });
      setRecNotes(new Array(recs.length).fill(''));
      setStep('review');
    } catch {
      setError('Failed to connect to the server. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  }, [note, noteType]);

  // Build revised recommendations string from inline notes
  const buildRevisedRecommendations = useCallback(() => {
    if (!result) return undefined;
    const hasAnyNotes = recNotes.some(n => n.trim().length > 0);
    if (!hasAnyNotes) return undefined;

    return result.recommendations.map((rec, i) => {
      const note = recNotes[i]?.trim();
      if (note) {
        return `${i + 1}. ${rec}\n   Dietician note: ${note}`;
      }
      return `${i + 1}. ${rec}`;
    }).join('\n\n');
  }, [result, recNotes]);

  // Submit agreement
  const handleAgree = useCallback(async () => {
    if (!result?.id) {
      setFeedbackMessage('Note was not saved to database. Feedback cannot be recorded.');
      setStep('complete');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const revisedRecs = buildRevisedRecommendations();

      const response = await fetch(`${API_BASE}/api/nutrition-review/${result.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agrees: true,
          dieticianName: dieticianName || 'Anonymous',
          revisedRecommendations: revisedRecs
        })
      });

      const data = await response.json();
      setFeedbackMessage(data.message || 'Review approved!');
      setStep('complete');
    } catch {
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  }, [result, dieticianName, buildRevisedRecommendations]);

  // Submit disagreement with feedback
  const handleDisagree = useCallback(() => {
    setStep('feedback');
  }, []);

  // Submit disagreement feedback
  const handleSubmitFeedback = useCallback(async () => {
    if (!feedback.trim()) {
      setError('Please provide feedback explaining why you disagree.');
      return;
    }

    if (!result?.id) {
      setFeedbackMessage('Note was not saved to database. Feedback cannot be recorded.');
      setStep('complete');
      return;
    }

    setSubmittingFeedback(true);
    setError('');

    try {
      const revisedRecs = buildRevisedRecommendations();

      const response = await fetch(`${API_BASE}/api/nutrition-review/${result.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agrees: false,
          dieticianName: dieticianName || 'Anonymous',
          feedback: feedback.trim(),
          revisedSummary: revisedSummary.trim() || undefined,
          revisedRecommendations: revisedRecs
        })
      });

      const data = await response.json();
      setFeedbackMessage(data.message || 'Feedback recorded.');
      setStep('complete');
    } catch {
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  }, [result, feedback, dieticianName, revisedSummary, buildRevisedRecommendations]);

  // Load stats
  const handleLoadStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/nutrition-review/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setShowStats(true);
      }
    } catch {
      // Stats are non-critical, fail silently
    }
  }, []);

  // Reset for new note
  const handleNewNote = useCallback(() => {
    setStep('input');
    setNote('');
    setNoteType('general');
    setResult(null);
    setError('');
    setFeedback('');
    setRevisedSummary('');
    setRecNotes([]);
    setFeedbackMessage('');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nutrition Note Review</h1>
            <p className="text-sm text-gray-500 mt-1">AI-Assisted Analysis with Learning Feedback</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadStats}
              className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Stats
            </button>
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Panel */}
        {showStats && stats && (
          <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">AI Learning Statistics</h3>
              <button onClick={() => setShowStats(false)} className="text-gray-400 hover:text-gray-600">
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-500 mt-1">Total Notes</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-700">{stats.approved}</div>
                <div className="text-xs text-gray-500 mt-1">Approved</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-2xl font-bold text-amber-700">{stats.revised}</div>
                <div className="text-xs text-gray-500 mt-1">Revised</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
                <div className="text-xs text-gray-500 mt-1">Rejected</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{stats.agreementRate}%</div>
                <div className="text-xs text-gray-500 mt-1">Agreement Rate</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              The AI uses {stats.approved + stats.revised} approved/revised examples as context when processing new notes.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-red-500 text-xs mt-1 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Input */}
        {step === 'input' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Paste Nutrition Note</h2>
              <p className="text-sm text-gray-500 mt-1">
                Paste the patient's nutrition note below. The AI will generate a summary and 5 additional recommendations.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="general">General Nutrition</option>
                  <option value="diabetes">Diabetes Nutrition</option>
                  <option value="weight_management">Weight Management</option>
                  <option value="renal">Renal Diet</option>
                  <option value="cardiac">Cardiac Diet</option>
                  <option value="pediatric">Pediatric Nutrition</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nutrition Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Paste the nutrition note here..."
                  rows={14}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-y"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-400">{note.length} characters</span>
                  {note.length > 0 && note.length < 20 && (
                    <span className="text-xs text-amber-600">Minimum 20 characters required</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleProcess}
                  disabled={processing || note.trim().length < 20}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Process Note'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review AI Output */}
        {step === 'review' && result && (
          <div className="space-y-6">
            {/* Original Note (collapsed) */}
            <details className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <summary className="p-4 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
                View Original Note ({note.length} chars)
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {note}
                </pre>
              </div>
            </details>

            {/* AI Summary */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xs font-bold">AI</span>
                </div>
                <h3 className="font-semibold text-gray-900">Summary</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>
            </div>

            {/* AI Recommendations - Individual cards with inline edit */}
            <div className="bg-white border border-emerald-200 rounded-xl shadow-sm">
              <div className="p-4 border-b border-emerald-100 flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-emerald-600 text-xs font-bold">AI</span>
                </div>
                <h3 className="font-semibold text-gray-900">Recommendations</h3>
                <span className="text-xs text-gray-400 ml-auto">Type your notes next to each</span>
              </div>
              <div className="divide-y divide-gray-100">
                {result.recommendations.map((rec, index) => (
                  <div key={index} className="p-4">
                    <div className="flex gap-3 items-start">
                      <div className="w-7 h-7 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-emerald-700 text-xs font-bold">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                        <input
                          type="text"
                          value={recNotes[index] || ''}
                          onChange={(e) => updateRecNote(index, e.target.value)}
                          placeholder="Your note on this recommendation..."
                          className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 placeholder-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Model: GPT-4o</span>
              <span>Tokens: {result.tokensUsed}</span>
              <span>Past examples used: {result.ragExamplesUsed}</span>
            </div>

            {/* Dietician Name */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name (Reviewer)</label>
              <input
                type="text"
                value={dieticianName}
                onChange={(e) => setDieticianName(e.target.value)}
                placeholder="e.g., Sarah Johnson, RD"
                className="w-full md:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Agree / Disagree */}
            <div className="flex gap-4">
              <button
                onClick={handleAgree}
                disabled={submittingFeedback}
                className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
              >
                {submittingFeedback ? 'Submitting...' : 'Agree with Summary & Recommendations'}
              </button>
              <button
                onClick={handleDisagree}
                className="flex-1 py-3 bg-white text-red-600 font-medium rounded-xl border-2 border-red-300 hover:bg-red-50 transition-colors"
              >
                Disagree - Provide Feedback
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Feedback Form (when disagreeing) */}
        {step === 'feedback' && result && (
          <div className="space-y-6">
            {/* Reference: AI output */}
            <details className="bg-gray-50 border border-gray-200 rounded-xl">
              <summary className="p-4 cursor-pointer text-sm font-medium text-gray-600">
                View AI Summary & Recommendations (for reference)
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-sm text-gray-500 whitespace-pre-wrap">{result.summary}</p>
                <ol className="list-decimal list-inside text-sm text-gray-500 space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ol>
              </div>
            </details>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">Dietician Feedback</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Why do you disagree? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Explain what the AI got wrong or what could be improved..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Corrected Summary <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={revisedSummary}
                  onChange={(e) => setRevisedSummary(e.target.value)}
                  placeholder="Your corrected summary..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-y"
                />
              </div>

              {/* Inline recommendation notes carried over */}
              {recNotes.some(n => n.trim()) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-emerald-800 mb-2">Your notes on recommendations (from previous step):</p>
                  {result.recommendations.map((rec, i) => (
                    recNotes[i]?.trim() ? (
                      <div key={i} className="text-sm text-emerald-700 mb-1">
                        <span className="font-medium">#{i + 1}:</span> {recNotes[i]}
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={submittingFeedback || !feedback.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <button
                  onClick={() => setStep('review')}
                  className="px-6 py-3 text-gray-600 font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Complete</h2>
            <p className="text-sm text-gray-600 mb-6">{feedbackMessage}</p>
            <p className="text-xs text-gray-400 mb-6">
              Your feedback has been stored and will be used to improve future AI recommendations.
            </p>
            <button
              onClick={handleNewNote}
              className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Process Another Note
            </button>
          </div>
        )}

        {/* How It Works */}
        <div className="mt-12 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">How AI Learning Works</h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-700">Paste & Process</p>
                <p className="text-gray-400 text-xs mt-0.5">Nutritionist pastes a clinical note</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold text-xs">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-700">AI Analyzes</p>
                <p className="text-gray-400 text-xs mt-0.5">GPT-4o generates summary + 5 recommendations</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 font-bold text-xs">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-700">Dietician Reviews</p>
                <p className="text-gray-400 text-xs mt-0.5">Add notes to each recommendation</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold text-xs">4</span>
              </div>
              <div>
                <p className="font-medium text-gray-700">AI Learns</p>
                <p className="text-gray-400 text-xs mt-0.5">Past approved reviews improve future results</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
