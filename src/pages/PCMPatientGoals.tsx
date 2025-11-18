/**
 * PCM Patient Goals Page
 * Shows all patient goals with progress tracking and trends
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Weight as WeightIcon,
  Droplet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Plus
} from 'lucide-react';
import { pcmService } from '../services/pcm.service';

interface Goal {
  id: string;
  category: 'a1c' | 'bp' | 'weight' | 'medication' | 'activity';
  name: string;
  current: number | string;
  target: number | string;
  unit: string;
  status: 'achieved' | 'on-track' | 'needs-attention' | 'off-track';
  progress: number; // 0-100
  trend: 'improving' | 'stable' | 'worsening';
  lastUpdated: string;
  color: string;
}

export default function PCMPatientGoals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Mock patient data
  const patient = {
    id: 'demo-patient-001',
    name: 'Jane Smith'
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    setIsLoading(true);
    try {
      const goalsData = await pcmService.getPatientGoals(patient.id);
      setGoals(goalsData);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'achieved':
        return 'bg-green-50 border-green-500 text-green-900';
      case 'on-track':
        return 'bg-blue-50 border-blue-500 text-blue-900';
      case 'needs-attention':
        return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      case 'off-track':
        return 'bg-red-50 border-red-500 text-red-900';
      default:
        return 'bg-gray-50 border-gray-500 text-gray-900';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'achieved':
        return 'Goal Achieved!';
      case 'on-track':
        return 'On Track';
      case 'needs-attention':
        return 'Needs Attention';
      case 'off-track':
        return 'Off Track';
      default:
        return 'Unknown';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingDown className="w-5 h-5 text-green-600" />;
      case 'stable':
        return <div className="w-5 h-5 flex items-center justify-center text-gray-600">→</div>;
      case 'worsening':
        return <TrendingUp className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'achieved':
        return 'bg-green-500';
      case 'on-track':
        return 'bg-blue-500';
      case 'needs-attention':
        return 'bg-yellow-500';
      case 'off-track':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const overallProgress = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0;

  const achievedCount = goals.filter(g => g.status === 'achieved').length;
  const onTrackCount = goals.filter(g => g.status === 'on-track' || g.status === 'achieved').length;

  const getGoalIcon = (category: string) => {
    switch (category) {
      case 'a1c':
        return <Activity className="w-5 h-5" />;
      case 'bp':
        return <Heart className="w-5 h-5" />;
      case 'weight':
        return <WeightIcon className="w-5 h-5" />;
      case 'medication':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'activity':
        return <Activity className="w-5 h-5" />;
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/pcm/patient')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Goals</h1>
                <p className="text-sm text-gray-600">Track your health goals and progress</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pcm/patient')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Log Vitals
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Overall Progress Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Overall Progress</h2>
              <p className="text-sm text-gray-600">
                {achievedCount} of {goals.length} goals achieved • {onTrackCount} on track
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-purple-600">{overallProgress}%</div>
              <div className="text-xs text-gray-600">Complete</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Goals List */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Your Health Goals
          </h3>

          {goals.map((goal) => (
            <div
              key={goal.id}
              className={`bg-white rounded-xl shadow-sm border-l-4 p-5 cursor-pointer hover:shadow-md transition ${
                getStatusColor(goal.status).replace('bg-', 'border-').split(' ')[0]
              }`}
              onClick={() => {
                setSelectedGoal(goal);
                setShowHistory(true);
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${goal.color}`}>
                    {getGoalIcon(goal.category)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{goal.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                        {getStatusText(goal.status)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        {getTrendIcon(goal.trend)}
                        <span className="capitalize">{goal.trend}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <div className="text-xs text-red-900 font-semibold mb-1">CURRENT</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {goal.current} <span className="text-sm text-gray-600">{goal.unit}</span>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-900 font-semibold mb-1">TARGET</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {goal.target} <span className="text-sm text-gray-600">{goal.unit}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span className="font-semibold">{goal.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${getProgressBarColor(goal.status)} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Last updated: {new Date(goal.lastUpdated).toLocaleDateString()}
                </div>
                <span className="text-purple-600 font-semibold">View History →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tips & Encouragement */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Heart className="w-6 h-6" />
            Keep Up the Great Work!
          </h3>
          <p className="text-purple-100 mb-4">
            {achievedCount > 0
              ? `You've achieved ${achievedCount} goal${achievedCount > 1 ? 's' : ''}! That's fantastic progress.`
              : "Every journey starts with a single step. You're on the right path!"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/pcm/patient')}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 transition text-center"
            >
              <div className="font-semibold">Log Vitals</div>
              <div className="text-xs text-purple-100">Update your progress</div>
            </button>
            <button
              onClick={() => navigate('/pcm/messages')}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 transition text-center"
            >
              <div className="font-semibold">Ask Questions</div>
              <div className="text-xs text-purple-100">Contact your care team</div>
            </button>
          </div>
        </div>
      </div>

      {/* Goal History Modal */}
      {showHistory && selectedGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedGoal.name} History</h3>
                <p className="text-sm text-gray-600">Tracking your progress over time</p>
              </div>
              <button
                onClick={() => {
                  setShowHistory(false);
                  setSelectedGoal(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Current vs Target */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                  <div className="text-sm text-red-900 font-semibold mb-2">CURRENT VALUE</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {selectedGoal.current} <span className="text-lg text-gray-600">{selectedGoal.unit}</span>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <div className="text-sm text-green-900 font-semibold mb-2">TARGET GOAL</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {selectedGoal.target} <span className="text-lg text-gray-600">{selectedGoal.unit}</span>
                  </div>
                </div>
              </div>

              {/* Timeline (mock data) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Recent Readings</h4>
                <div className="space-y-3">
                  {[
                    { date: '2025-01-18', value: selectedGoal.current, note: 'Latest reading' },
                    { date: '2025-01-11', value: typeof selectedGoal.current === 'number' ? selectedGoal.current + 0.2 : selectedGoal.current, note: 'Weekly check-in' },
                    { date: '2025-01-04', value: typeof selectedGoal.current === 'number' ? selectedGoal.current + 0.5 : selectedGoal.current, note: 'Monthly review' }
                  ].map((reading, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div>
                        <div className="font-semibold text-gray-900">{reading.value} {selectedGoal.unit}</div>
                        <div className="text-xs text-gray-600">{reading.note}</div>
                      </div>
                      <div className="text-sm text-gray-600">{new Date(reading.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowHistory(false);
                    setSelectedGoal(null);
                    navigate('/pcm/patient');
                  }}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  Update Reading
                </button>
                <button
                  onClick={() => {
                    setShowHistory(false);
                    setSelectedGoal(null);
                    navigate('/pcm/messages');
                  }}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Ask About Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
