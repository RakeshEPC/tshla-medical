/**
 * Currently Working On Component
 * Patient goals section: Diet, Exercise, Habits, Doctor Visits
 * Patient-editable with categories
 * Created: 2026-01-23
 */

import { useState } from 'react';
import { Target, Plus, Edit2, Save, X, Loader2, CheckCircle, Circle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Goal {
  category: string;
  goal: string;
  status: string;
  added_date: string;
}

interface CurrentlyWorkingOnProps {
  goals: Goal[];
  session: any;
  onUpdate: () => void;
}

// Goal categories
const CATEGORIES = [
  { value: 'Diet', label: 'Diet & Nutrition', icon: '🥗', color: 'green' },
  { value: 'Exercise', label: 'Exercise & Activity', icon: '🏃', color: 'blue' },
  { value: 'Habits', label: 'Healthy Habits', icon: '✨', color: 'purple' },
  { value: 'Monitoring', label: 'Health Monitoring', icon: '📊', color: 'yellow' },
  { value: 'Doctor Visits', label: 'Doctor Visits', icon: '🩺', color: 'red' },
];

const GOAL_STATUS = [
  { value: 'not_started', label: 'Not Started', icon: Circle },
  { value: 'in_progress', label: 'In Progress', icon: Target },
  { value: 'completed', label: 'Completed', icon: CheckCircle },
];

export default function CurrentlyWorkingOn({
  goals,
  session,
  onUpdate,
}: CurrentlyWorkingOnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newGoal, setNewGoal] = useState({
    category: '',
    goal: '',
    status: 'not_started',
  });

  /**
   * Start adding new goal
   */
  const startAdding = (category: string) => {
    setSelectedCategory(category);
    setNewGoal({ category, goal: '', status: 'not_started' });
    setIsAdding(true);
  };

  /**
   * Cancel adding
   */
  const cancelAdding = () => {
    setIsAdding(false);
    setSelectedCategory('');
    setNewGoal({ category: '', goal: '', status: 'not_started' });
  };

  /**
   * Save new goal
   */
  const saveGoal = async () => {
    if (!newGoal.goal.trim() || !session) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/hp/patient/${session.tshlaId}/edit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': session.sessionId,
          },
          body: JSON.stringify({
            section: 'current_goals',
            data: {
              ...newGoal,
              added_date: new Date().toISOString(),
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save goal');
      }

      // Reset form
      cancelAdding();

      // Trigger update
      onUpdate();
    } catch (err: any) {
      console.error('Save goal error:', err);
      alert(err.message || 'Failed to save goal');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Get goals by category
   */
  const getGoalsByCategory = (category: string): Goal[] => {
    return goals.filter((g) => g.category === category);
  };

  /**
   * Get status icon and color
   */
  const getStatusDisplay = (status: string) => {
    const statusObj = GOAL_STATUS.find((s) => s.value === status);
    if (!statusObj) return { Icon: Circle, color: 'gray' };

    const colorMap: { [key: string]: string } = {
      not_started: 'gray',
      in_progress: 'blue',
      completed: 'green',
    };

    return {
      Icon: statusObj.icon,
      color: colorMap[status] || 'gray',
    };
  };

  /**
   * Get category color classes
   */
  const getCategoryColor = (color: string) => {
    const colorMap: { [key: string]: { bg: string; text: string; border: string } } = {
      green: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
      },
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
      },
      purple: {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
      },
      yellow: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
      },
      red: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
      },
    };

    return colorMap[color] || colorMap.gray;
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Target className="w-6 h-6 text-purple-600" />
          <h3 className="text-xl font-bold text-gray-900">
            Tasks & Goals
          </h3>
        </div>
        <span className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full">
          {goals.length} goal{goals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 overflow-y-auto max-h-[600px] flex-1">
        {CATEGORIES.map((category) => {
          const categoryGoals = getGoalsByCategory(category.value);
          const colors = getCategoryColor(category.color);

          return (
            <div key={category.value} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{category.icon}</span>
                  <h4 className="font-semibold text-gray-900">{category.label}</h4>
                  {categoryGoals.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {categoryGoals.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => startAdding(category.value)}
                  disabled={isAdding}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              {/* Category Goals */}
              {categoryGoals.length > 0 && (
                <div className="space-y-2">
                  {categoryGoals.map((goal, idx) => {
                    const { Icon, color } = getStatusDisplay(goal.status);
                    const statusColorMap: { [key: string]: string } = {
                      gray: 'text-gray-600',
                      blue: 'text-blue-600',
                      green: 'text-green-600',
                    };

                    return (
                      <div
                        key={idx}
                        className={`${colors.bg} ${colors.border} border rounded-xl p-4 hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`${colors.text} font-medium`}>
                              {goal.goal}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Added:{' '}
                              {new Date(goal.added_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div
                            className={`flex items-center space-x-1 ml-4 ${
                              statusColorMap[color]
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium capitalize">
                              {goal.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add New Goal Form */}
              {isAdding && selectedCategory === category.value && (
                <div
                  className={`${colors.bg} ${colors.border} border rounded-xl p-4 space-y-3`}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Goal
                    </label>
                    <textarea
                      value={newGoal.goal}
                      onChange={(e) =>
                        setNewGoal({ ...newGoal, goal: e.target.value })
                      }
                      placeholder={`e.g., ${
                        category.value === 'Diet'
                          ? 'Reduce carbs to 150g per day'
                          : category.value === 'Exercise'
                          ? 'Walk 30 minutes daily'
                          : category.value === 'Habits'
                          ? 'Check blood sugar before meals'
                          : category.value === 'Monitoring'
                          ? 'Track daily blood pressure'
                          : 'Schedule cardiology appointment'
                      }`}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={newGoal.status}
                      onChange={(e) =>
                        setNewGoal({ ...newGoal, status: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {GOAL_STATUS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={saveGoal}
                      disabled={isSaving || !newGoal.goal.trim()}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Goal</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={cancelAdding}
                      disabled={isSaving}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {categoryGoals.length === 0 && !isAdding && (
                <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <p className="text-sm text-gray-500">
                    No {category.label.toLowerCase()} goals yet
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border-t border-blue-200 p-4">
        <p className="text-xs text-blue-800">
          💡 <span className="font-semibold">Tip:</span> Set specific, measurable
          goals to track your progress. Your doctor will review these during your
          visits.
        </p>
      </div>
    </div>
  );
}
