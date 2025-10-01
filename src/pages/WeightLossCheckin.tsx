import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { weightLossProfileService } from '../weightloss/weightLossProfile.service';
import type { DailyCheckin, WeightLossProfile } from '../weightloss/types';

const MOOD_OPTIONS = [
  { value: 'terrible', emoji: '😔', color: 'text-red-500' },
  { value: 'low', emoji: '😕', color: 'text-orange-500' },
  { value: 'okay', emoji: '😐', color: 'text-yellow-500' },
  { value: 'good', emoji: '🙂', color: 'text-blue-500' },
  { value: 'great', emoji: '😄', color: 'text-green-500' },
];

export default function WeightLossCheckin() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<WeightLossProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [todayComplete, setTodayComplete] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Check-in form state
  const [checkin, setCheckin] = useState<DailyCheckin>({
    date: today,
    patientId: '',
    weight: undefined,
    steps: undefined,
    protein: undefined,
    sleep: undefined,
    hydration: undefined,
    hungerScore: 5,
    nausea: 0,
    constipation: 0,
    mood: 'okay' as any,
    notes: '',
  });

  const [quickEntry, setQuickEntry] = useState({
    showWeightEntry: false,
    showProteinEntry: false,
    showStepsEntry: false,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    // For now, use the same patient ID pattern
    const patientId = `patient_${Date.now()}`;
    const existingProfile = weightLossProfileService.loadProfile(patientId);

    if (!existingProfile) {
      // Redirect to onboarding if no profile
      navigate('/weightloss/onboarding');
      return;
    }

    setProfile(existingProfile);
    setCheckin({ ...checkin, patientId: existingProfile.patientId });

    // Check if today's check-in is already done
    const isComplete = weightLossProfileService.isTodayCheckinComplete(existingProfile.patientId);
    setTodayComplete(isComplete);

    // Load today's check-in if it exists
    if (isComplete) {
      const todayCheckins = weightLossProfileService.getDailyCheckins(
        existingProfile.patientId,
        today,
        today
      );
      if (todayCheckins.length > 0) {
        setCheckin(todayCheckins[0]);
      }
    }

    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);

    // Save the check-in
    weightLossProfileService.saveDailyCheckin(checkin);

    // Update engagement stats
    weightLossProfileService.updateEngagementStats(profile.patientId, {
      checkinStreak: todayComplete ? undefined : 1, // Will be calculated properly in service
    });

    setTodayComplete(true);
    setIsSaving(false);

    // Show success message
    setTimeout(() => {
      navigate('/weightloss/dashboard');
    }, 1000);
  };

  const handleQuickWeight = () => {
    setQuickEntry({ ...quickEntry, showWeightEntry: !quickEntry.showWeightEntry });
  };

  const getScoreColor = (score: number, type: 'hunger' | 'symptom') => {
    if (type === 'hunger') {
      if (score <= 3) return 'bg-green-500';
      if (score <= 6) return 'bg-yellow-500';
      return 'bg-red-500';
    } else {
      if (score === 0) return 'bg-green-500';
      if (score <= 3) return 'bg-yellow-500';
      if (score <= 6) return 'bg-orange-500';
      return 'bg-red-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading check-in...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Daily Check-in</h1>
              <p className="text-gray-600 mt-1">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            {todayComplete && (
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-medium">
                ✓ Today Complete
              </div>
            )}
          </div>

          {/* Streak indicator */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">Current Streak:</div>
            <div className="flex space-x-1">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full ${
                    i < 3 ? 'bg-green-500' : 'bg-gray-200'
                  } flex items-center justify-center text-white text-xs`}
                >
                  {i < 3 ? '✓' : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Metrics Entry */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Weight */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">⚖️</div>
                <div>
                  <div className="text-sm text-gray-500">Weight</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {checkin.weight || '--'} {profile.demographics.preferredUnits.weight}
                  </div>
                </div>
              </div>
              <button onClick={handleQuickWeight} className="text-blue-600 hover:text-blue-700">
                {checkin.weight ? 'Edit' : 'Add'}
              </button>
            </div>
            {quickEntry.showWeightEntry && (
              <div className="mt-4 flex space-x-2">
                <input
                  type="number"
                  step="0.1"
                  value={checkin.weight || ''}
                  onChange={e => setCheckin({ ...checkin, weight: parseFloat(e.target.value) })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={profile.demographics.preferredUnits.weight === 'kg' ? '75.5' : '166'}
                />
                <button
                  onClick={() => setQuickEntry({ ...quickEntry, showWeightEntry: false })}
                  className="px-3 py-2 bg-green-500 text-white rounded-lg"
                >
                  ✓
                </button>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">👟</div>
                <div>
                  <div className="text-sm text-gray-500">Steps</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {checkin.steps?.toLocaleString() || '--'}
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  setQuickEntry({ ...quickEntry, showStepsEntry: !quickEntry.showStepsEntry })
                }
                className="text-blue-600 hover:text-blue-700"
              >
                {checkin.steps ? 'Edit' : 'Add'}
              </button>
            </div>
            {quickEntry.showStepsEntry && (
              <div className="mt-4 flex space-x-2">
                <input
                  type="number"
                  value={checkin.steps || ''}
                  onChange={e => setCheckin({ ...checkin, steps: parseInt(e.target.value) })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="8000"
                />
                <button
                  onClick={() => setQuickEntry({ ...quickEntry, showStepsEntry: false })}
                  className="px-3 py-2 bg-green-500 text-white rounded-lg"
                >
                  ✓
                </button>
              </div>
            )}
            {/* Progress bar */}
            {profile.targets.steps && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((checkin.steps || 0) / profile.targets.steps.target) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Goal: {profile.targets.steps.target.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Protein */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">🥩</div>
                <div>
                  <div className="text-sm text-gray-500">Protein</div>
                  <div className="text-2xl font-bold text-gray-900">{checkin.protein || '--'}g</div>
                </div>
              </div>
              <button
                onClick={() =>
                  setQuickEntry({ ...quickEntry, showProteinEntry: !quickEntry.showProteinEntry })
                }
                className="text-blue-600 hover:text-blue-700"
              >
                {checkin.protein ? 'Edit' : 'Add'}
              </button>
            </div>
            {quickEntry.showProteinEntry && (
              <div className="mt-4 flex space-x-2">
                <input
                  type="number"
                  value={checkin.protein || ''}
                  onChange={e => setCheckin({ ...checkin, protein: parseInt(e.target.value) })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="80"
                />
                <button
                  onClick={() => setQuickEntry({ ...quickEntry, showProteinEntry: false })}
                  className="px-3 py-2 bg-green-500 text-white rounded-lg"
                >
                  ✓
                </button>
              </div>
            )}
            {/* Progress bar */}
            {profile.targets.protein && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((checkin.protein || 0) / profile.targets.protein.target) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Goal: {profile.targets.protein.target}g
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Wellness Scores */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">How are you feeling?</h2>

          <div className="space-y-6">
            {/* Mood */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Overall Mood</label>
              <div className="flex justify-between">
                {MOOD_OPTIONS.map(mood => (
                  <button
                    key={mood.value}
                    onClick={() => setCheckin({ ...checkin, mood: mood.value as any })}
                    className={`
                      p-3 rounded-lg transition-all
                      ${
                        checkin.mood === mood.value
                          ? 'bg-blue-100 ring-2 ring-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className={`text-3xl ${mood.color}`}>{mood.emoji}</div>
                    <div className="text-xs text-gray-600 mt-1 capitalize">{mood.value}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hunger */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Hunger Level: {checkin.hungerScore}/10
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={checkin.hungerScore}
                onChange={e => setCheckin({ ...checkin, hungerScore: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>No hunger</span>
                <span>Moderate</span>
                <span>Extreme hunger</span>
              </div>
              <div
                className={`h-2 ${getScoreColor(checkin.hungerScore, 'hunger')} rounded-full mt-2`}
              />
            </div>

            {/* Nausea */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Nausea: {checkin.nausea}/10
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={checkin.nausea}
                onChange={e => setCheckin({ ...checkin, nausea: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>None</span>
                <span>Mild</span>
                <span>Severe</span>
              </div>
              <div
                className={`h-2 ${getScoreColor(checkin.nausea, 'symptom')} rounded-full mt-2`}
              />
            </div>

            {/* Constipation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Constipation: {checkin.constipation}/10
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={checkin.constipation}
                onChange={e => setCheckin({ ...checkin, constipation: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>None</span>
                <span>Mild</span>
                <span>Severe</span>
              </div>
              <div
                className={`h-2 ${getScoreColor(checkin.constipation, 'symptom')} rounded-full mt-2`}
              />
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Additional Tracking</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sleep (hours)</label>
              <input
                type="number"
                step="0.5"
                value={checkin.sleep || ''}
                onChange={e => setCheckin({ ...checkin, sleep: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="7.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Water (ml)</label>
              <input
                type="number"
                step="250"
                value={checkin.hydration || ''}
                onChange={e => setCheckin({ ...checkin, hydration: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="2000"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notes & Observations</h2>

          <textarea
            value={checkin.notes}
            onChange={e => setCheckin({ ...checkin, notes: e.target.value })}
            placeholder="Any additional notes about your day, challenges, wins, or symptoms..."
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Red Flags Alert */}
        {(checkin.nausea >= 8 || checkin.constipation >= 8) && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">⚠️</div>
              <div>
                <div className="font-semibold text-red-700">Health Alert</div>
                <div className="text-sm text-red-600">
                  You're experiencing severe symptoms. Consider contacting your healthcare provider
                  if symptoms persist.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => navigate('/weightloss/dashboard')}
            className="px-8 py-3 bg-white text-gray-700 font-semibold rounded-lg border-2 border-gray-300 hover:bg-gray-50"
          >
            Skip Today
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              px-8 py-3 font-semibold rounded-lg shadow-lg transition-all
              ${
                isSaving
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700'
              }
            `}
          >
            {isSaving ? 'Saving...' : todayComplete ? 'Update Check-in' : 'Complete Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
