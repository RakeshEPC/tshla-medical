import React, { useState } from 'react';
import { pumpContext7Service } from '../services/pumpDriveContext7.service';

interface PumpFeedbackProps {
  sessionId: string;
  userId: string;
  recommendedPump: string;
  onComplete?: () => void;
}

const PUMP_OPTIONS = [
  'Omnipod 5',
  'Tandem t:slim X2',
  'Tandem Mobi',
  'Medtronic 780G',
  'Beta Bionics iLet',
  'Twiist',
  'Other',
];

const REASON_OPTIONS = [
  { value: 'cost', label: 'Cost / Price' },
  { value: 'insurance', label: 'Insurance Coverage' },
  { value: 'tubeless', label: 'Tubeless Preference' },
  { value: 'cgm', label: 'CGM Compatibility' },
  { value: 'features', label: 'Specific Features' },
  { value: 'doctor', label: 'Doctor Recommendation' },
  { value: 'other', label: 'Other Reason' },
];

export function PumpFeedback({ sessionId, userId, recommendedPump, onComplete }: PumpFeedbackProps) {
  const [feedbackType, setFeedbackType] = useState<'same' | 'different' | 'still_deciding' | null>(null);
  const [selectedPump, setSelectedPump] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<'cost' | 'insurance' | 'tubeless' | 'cgm' | 'other'>('other');
  const [submitted, setSubmitted] = useState(false);
  const [showIncentive, setShowIncentive] = useState(false);

  const handleFeedbackTypeSelect = (type: 'same' | 'different' | 'still_deciding') => {
    setFeedbackType(type);
    if (type === 'same') {
      // Auto-submit for "same" choice
      submitFeedback(type, recommendedPump, null, 'same');
    }
  };

  const submitFeedback = (
    type: 'same' | 'different' | 'still_deciding',
    pump: string | null,
    reasonText: string | null,
    category: 'cost' | 'insurance' | 'tubeless' | 'cgm' | 'other' | 'same'
  ) => {
    try {
      pumpContext7Service.saveFeedback(
        sessionId,
        userId,
        recommendedPump,
        pump,
        type,
        reasonText || undefined,
        category === 'same' ? undefined : (category as any)
      );
      setSubmitted(true);
      setShowIncentive(true);

      // Call onComplete callback if provided
      if (onComplete) {
        setTimeout(onComplete, 3000);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleSubmit = () => {
    if (feedbackType === 'different' && selectedPump) {
      submitFeedback(feedbackType, selectedPump, reason, reasonCategory);
    } else if (feedbackType === 'still_deciding') {
      submitFeedback(feedbackType, null, reason, 'other');
    }
  };

  if (submitted) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 shadow-md">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-2xl">✅</span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h3>
            <p className="text-gray-700 mb-4">
              Your feedback helps us improve recommendations for future users. We really appreciate it!
            </p>

            {showIncentive && (
              <div className="p-4 rounded-lg bg-white border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎁</span>
                  <span className="font-semibold text-gray-900">Special Offer</span>
                </div>
                <p className="text-sm text-gray-700">
                  As a thank you, get <strong>10% off pump supplies</strong> with code:{' '}
                  <code className="px-2 py-1 bg-green-100 rounded font-mono text-green-800">FEEDBACK10</code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-md">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Help Us Improve</h3>
        <p className="text-gray-700">
          We recommended <strong>{recommendedPump}</strong> for you. Did you choose this pump?
        </p>
      </div>

      {/* Feedback Type Selection */}
      {!feedbackType && (
        <div className="space-y-3">
          <button
            onClick={() => handleFeedbackTypeSelect('same')}
            className="w-full p-4 rounded-lg bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-semibold text-gray-900">Yes, I chose {recommendedPump}</div>
                <div className="text-sm text-gray-600">Our recommendation matched your choice</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleFeedbackTypeSelect('different')}
            className="w-full p-4 rounded-lg bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="font-semibold text-gray-900">No, I chose a different pump</div>
                <div className="text-sm text-gray-600">Help us understand why</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleFeedbackTypeSelect('still_deciding')}
            className="w-full p-4 rounded-lg bg-white border-2 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤔</span>
              <div>
                <div className="font-semibold text-gray-900">I'm still deciding</div>
                <div className="text-sm text-gray-600">Haven't made a final choice yet</div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Different Pump Selection */}
      {feedbackType === 'different' && (
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Which pump did you choose?
            </label>
            <select
              value={selectedPump}
              onChange={e => setSelectedPump(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a pump...</option>
              {PUMP_OPTIONS.map(pump => (
                <option key={pump} value={pump}>
                  {pump}
                </option>
              ))}
            </select>
          </div>

          {selectedPump && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Why did you choose {selectedPump} instead?
                </label>
                <select
                  value={reasonCategory}
                  onChange={e => setReasonCategory(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                >
                  {REASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Optional: Tell us more about your decision..."
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selectedPump}
                className="w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit Feedback
              </button>
            </>
          )}
        </div>
      )}

      {/* Still Deciding */}
      {feedbackType === 'still_deciding' && (
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              What's holding you back? (Optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g., Waiting for insurance approval, comparing prices, need to talk to doctor..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Submit Feedback
          </button>
        </div>
      )}
    </div>
  );
}
