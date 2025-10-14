/**
 * Note Quality Rating Component
 * Allows users to provide feedback on AI-generated note quality
 */

import React, { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface QualityRating {
  noteId: string;
  rating: number; // 1-5 stars
  thumbsUpDown?: 'up' | 'down';
  issues: string[]; // Array of issue types
  feedback?: string; // Optional text feedback
  timestamp: string;
  templateId?: string;
  promptVersionId?: string;
  modelUsed?: string;
}

interface NoteQualityRatingProps {
  noteId: string;
  templateId?: string;
  promptVersionId?: string;
  modelUsed?: string;
  onSubmitRating: (rating: QualityRating) => void;
  initialRating?: QualityRating;
  compact?: boolean;
}

const issueCategories = [
  { id: 'missing-info', label: 'Missing Information', icon: AlertCircle },
  { id: 'incorrect-terms', label: 'Incorrect Terminology', icon: AlertCircle },
  { id: 'hallucination', label: 'Added Information Not in Transcript', icon: AlertCircle },
  { id: 'poor-formatting', label: 'Poor Formatting', icon: AlertCircle },
  { id: 'template-mismatch', label: 'Doesn\'t Follow Template', icon: AlertCircle },
  { id: 'incomplete-sections', label: 'Incomplete Sections', icon: AlertCircle },
];

export const NoteQualityRating: React.FC<NoteQualityRatingProps> = ({
  noteId,
  templateId,
  promptVersionId,
  modelUsed,
  onSubmitRating,
  initialRating,
  compact = false
}) => {
  const [rating, setRating] = useState<number>(initialRating?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [thumbsUpDown, setThumbsUpDown] = useState<'up' | 'down' | undefined>(
    initialRating?.thumbsUpDown
  );
  const [selectedIssues, setSelectedIssues] = useState<string[]>(initialRating?.issues || []);
  const [feedback, setFeedback] = useState<string>(initialRating?.feedback || '');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [submitted, setSubmitted] = useState(!!initialRating);

  const handleStarClick = (value: number) => {
    setRating(value);
    if (value <= 3 && !compact) {
      setShowFeedbackForm(true);
    }
  };

  const handleThumbsClick = (value: 'up' | 'down') => {
    setThumbsUpDown(value);
    if (value === 'down' && !compact) {
      setShowFeedbackForm(true);
    }
  };

  const toggleIssue = (issueId: string) => {
    setSelectedIssues(prev =>
      prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  const handleSubmit = () => {
    const qualityRating: QualityRating = {
      noteId,
      rating,
      thumbsUpDown,
      issues: selectedIssues,
      feedback: feedback.trim() || undefined,
      timestamp: new Date().toISOString(),
      templateId,
      promptVersionId,
      modelUsed
    };

    onSubmitRating(qualityRating);
    setSubmitted(true);

    // Auto-hide after 3 seconds if rating is good
    if (rating >= 4) {
      setTimeout(() => {
        setShowFeedbackForm(false);
      }, 3000);
    }
  };

  const handleReset = () => {
    setRating(0);
    setThumbsUpDown(undefined);
    setSelectedIssues([]);
    setFeedback('');
    setSubmitted(false);
    setShowFeedbackForm(false);
  };

  if (submitted && compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        <span>Thank you for your feedback!</span>
        <button
          onClick={handleReset}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Rate Note Quality
        </h3>
        {submitted && (
          <button
            onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Change Rating
          </button>
        )}
      </div>

      {/* Star Rating */}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => handleStarClick(value)}
            onMouseEnter={() => setHoveredRating(value)}
            onMouseLeave={() => setHoveredRating(0)}
            disabled={submitted}
            className="transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Star
              className={`w-6 h-6 ${
                value <= (hoveredRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {rating === 5 && 'Excellent!'}
            {rating === 4 && 'Good'}
            {rating === 3 && 'Okay'}
            {rating === 2 && 'Poor'}
            {rating === 1 && 'Very Poor'}
          </span>
        )}
      </div>

      {/* Thumbs Up/Down (Quick Feedback) */}
      {!compact && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Quick feedback:</span>
          <button
            onClick={() => handleThumbsClick('up')}
            disabled={submitted}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              thumbsUpDown === 'up'
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            <ThumbsUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleThumbsClick('down')}
            disabled={submitted}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              thumbsUpDown === 'down'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            <ThumbsDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Detailed Feedback Form */}
      {showFeedbackForm && !submitted && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Issue Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What could be improved?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {issueCategories.map((issue) => {
                const Icon = issue.icon;
                return (
                  <button
                    key={issue.id}
                    onClick={() => toggleIssue(issue.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                      selectedIssues.includes(issue.id)
                        ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                    } border`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-left flex-1">{issue.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Feedback */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Comments (Optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Please describe any issues or suggestions..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!submitted && rating > 0 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          {showFeedbackForm && (
            <button
              onClick={() => setShowFeedbackForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Submit Feedback
          </button>
        </div>
      )}

      {/* Success Message */}
      {submitted && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mt-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              Thank you for your feedback!
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Your rating helps us improve note quality.
            </p>
          </div>
        </div>
      )}

      {/* Metadata Info (for debugging) */}
      {!compact && (promptVersionId || modelUsed) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {promptVersionId && (
              <div>Prompt Version: {promptVersionId.substring(0, 8)}...</div>
            )}
            {modelUsed && <div>Model: {modelUsed}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteQualityRating;
