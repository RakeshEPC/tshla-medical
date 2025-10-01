import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { weightLossProfileService } from '../weightloss/weightLossProfile.service';
import type { WeightLossProfile, DailyCheckin } from '../weightloss/types';

export default function WeightLossDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<WeightLossProfile | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [progress, setProgress] = useState({
    totalWeightLoss: 0,
    percentageLoss: 0,
    averageWeeklyLoss: 0,
    currentStreak: 0,
    daysOnProgram: 0,
  });
  const [stall, setStall] = useState({
    isStalled: false,
    daysStalled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [todayComplete, setTodayComplete] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = () => {
    // For now, use the same patient ID pattern
    const patientId = `patient_${Date.now()}`;
    const existingProfile = weightLossProfileService.loadProfile(patientId);

    if (!existingProfile) {
      navigate('/weightloss/onboarding');
      return;
    }

    setProfile(existingProfile);

    // Load last 30 days of check-ins
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recentCheckins = weightLossProfileService.getDailyCheckins(
      existingProfile.patientId,
      startDate,
      endDate
    );
    setCheckins(recentCheckins);

    // Calculate progress
    const progressData = weightLossProfileService.calculateProgress(existingProfile.patientId);
    setProgress(progressData);

    // Check for stalls
    const stallData = weightLossProfileService.detectStall(existingProfile.patientId);
    setStall(stallData);

    // Check if today's check-in is complete
    setTodayComplete(weightLossProfileService.isTodayCheckinComplete(existingProfile.patientId));

    setIsLoading(false);
  };

  const getWeightTrend = () => {
    if (checkins.length < 2) return 'stable';
    const weights = checkins.filter(c => c.weight).map(c => c.weight!);
    if (weights.length < 2) return 'stable';

    const recent = weights.slice(-7);
    const older = weights.slice(-14, -7);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    if (recentAvg < olderAvg - 0.5) return 'down';
    if (recentAvg > olderAvg + 0.5) return 'up';
    return 'stable';
  };

  const formatWeight = (weight: number) => {
    if (!profile) return weight.toString();
    return profile.demographics.preferredUnits.weight === 'kg'
      ? weight.toFixed(1)
      : Math.round(weight * 2.20462).toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const weightTrend = getWeightTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Your Progress Dashboard</h1>
              <p className="text-gray-600 mt-1">Day {progress.daysOnProgram} of your journey</p>
            </div>
            <div className="flex space-x-3">
              {!todayComplete && (
                <button
                  onClick={() => navigate('/weightloss/checkin')}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 shadow-lg"
                >
                  Today's Check-in
                </button>
              )}
              <button
                onClick={() => navigate('/weightloss/onboarding')}
                className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border-2 border-gray-300 hover:bg-gray-50"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Stall Alert */}
        {stall.isStalled && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🤔</div>
              <div>
                <div className="font-semibold text-yellow-800">Weight Loss Plateau Detected</div>
                <div className="text-sm text-yellow-700">
                  Your weight has been stable for {stall.daysStalled} days. Consider trying a
                  protein reset or increasing activity.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Loss</span>
              <span
                className={`text-2xl ${weightTrend === 'down' ? '📉' : weightTrend === 'up' ? '📈' : '➡️'}`}
              ></span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatWeight(Math.abs(progress.totalWeightLoss))}{' '}
              {profile.demographics.preferredUnits.weight}
            </div>
            <div
              className={`text-sm mt-1 ${progress.totalWeightLoss > 0 ? 'text-green-600' : 'text-gray-600'}`}
            >
              {progress.percentageLoss.toFixed(1)}% of body weight
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Weekly Average</span>
              <span className="text-2xl">📊</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatWeight(Math.abs(progress.averageWeeklyLoss))}{' '}
              {profile.demographics.preferredUnits.weight}
            </div>
            <div className="text-sm text-gray-600 mt-1">per week</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Check-in Streak</span>
              <span className="text-2xl">🔥</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{progress.currentStreak}</div>
            <div className="text-sm text-gray-600 mt-1">days</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Current Weight</span>
              <span className="text-2xl">⚖️</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {checkins.length > 0 && checkins[checkins.length - 1].weight
                ? formatWeight(checkins[checkins.length - 1].weight)
                : formatWeight(profile.demographics.startingWeight)}{' '}
              {profile.demographics.preferredUnits.weight}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Goal: {formatWeight(profile.demographics.targetWeight || 0)}{' '}
              {profile.demographics.preferredUnits.weight}
            </div>
          </div>
        </div>

        {/* Progress Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Weight Trend */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Weight Trend (Last 30 Days)</h2>
            <div className="h-48 flex items-end space-x-1">
              {checkins.slice(-30).map((checkin, index) => {
                const weight = checkin.weight || profile.demographics.startingWeight;
                const maxWeight = Math.max(
                  ...checkins.map(c => c.weight || profile.demographics.startingWeight)
                );
                const minWeight = Math.min(
                  ...checkins.map(c => c.weight || profile.demographics.startingWeight)
                );
                const range = maxWeight - minWeight || 1;
                const height = ((weight - minWeight) / range) * 100;

                return (
                  <div
                    key={index}
                    className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-600 hover:to-blue-500 transition-all"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${checkin.date}: ${formatWeight(weight)} ${profile.demographics.preferredUnits.weight}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Daily Goals Achievement */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Goals (Last 7 Days)</h2>
            <div className="space-y-3">
              {['Protein', 'Steps', 'Sleep', 'Water'].map(goal => {
                const recentCheckins = checkins.slice(-7);
                let achieved = 0;

                recentCheckins.forEach(checkin => {
                  if (
                    goal === 'Protein' &&
                    checkin.protein &&
                    checkin.protein >= profile.targets.protein.target * 0.9
                  )
                    achieved++;
                  if (
                    goal === 'Steps' &&
                    checkin.steps &&
                    checkin.steps >= profile.targets.steps.minimum
                  )
                    achieved++;
                  if (
                    goal === 'Sleep' &&
                    checkin.sleep &&
                    checkin.sleep >= profile.targets.sleep.minimumHours
                  )
                    achieved++;
                  if (
                    goal === 'Water' &&
                    checkin.hydration &&
                    checkin.hydration >= profile.targets.hydration.target * 0.9
                  )
                    achieved++;
                });

                const percentage =
                  recentCheckins.length > 0 ? (achieved / recentCheckins.length) * 100 : 0;

                return (
                  <div key={goal}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{goal}</span>
                      <span className="text-gray-500">{achieved}/7 days</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          percentage >= 80
                            ? 'bg-green-500'
                            : percentage >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Check-ins */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Check-ins</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Weight</th>
                  <th className="pb-2">Steps</th>
                  <th className="pb-2">Protein</th>
                  <th className="pb-2">Mood</th>
                  <th className="pb-2">Symptoms</th>
                </tr>
              </thead>
              <tbody>
                {checkins
                  .slice(-7)
                  .reverse()
                  .map(checkin => (
                    <tr key={checkin.date} className="border-b">
                      <td className="py-3 text-gray-900">
                        {new Date(checkin.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3">
                        {checkin.weight
                          ? `${formatWeight(checkin.weight)} ${profile.demographics.preferredUnits.weight}`
                          : '--'}
                      </td>
                      <td className="py-3">{checkin.steps?.toLocaleString() || '--'}</td>
                      <td className="py-3">{checkin.protein ? `${checkin.protein}g` : '--'}</td>
                      <td className="py-3">
                        {checkin.mood === 'great' && '😄'}
                        {checkin.mood === 'good' && '🙂'}
                        {checkin.mood === 'okay' && '😐'}
                        {checkin.mood === 'low' && '😕'}
                        {checkin.mood === 'terrible' && '😔'}
                      </td>
                      <td className="py-3">
                        {checkin.nausea > 5 && '🤢'}
                        {checkin.constipation > 5 && '🚽'}
                        {checkin.nausea <= 5 && checkin.constipation <= 5 && '✓'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
