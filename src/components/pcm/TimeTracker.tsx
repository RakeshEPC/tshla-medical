/**
 * PCM Time Tracker Component
 * Track time spent on PCM activities for billing compliance
 * Requirement: 30+ minutes per month for billing
 * Created: 2025-01-18
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, Save, X, Check } from 'lucide-react';

interface TimeEntry {
  id: string;
  patientId: string;
  patientName: string;
  activityType: 'phone_call' | 'care_coordination' | 'med_review' | 'lab_review' | 'documentation' | 'other';
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  notes: string;
  staffId: string;
}

interface TimeTrackerProps {
  patientId: string;
  patientName: string;
  staffId: string;
  onSave: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  onCancel?: () => void;
  existingEntries?: TimeEntry[];
}

const ACTIVITY_TYPES = [
  { value: 'phone_call', label: 'Phone Call', icon: '📞' },
  { value: 'care_coordination', label: 'Care Coordination', icon: '🤝' },
  { value: 'med_review', label: 'Medication Review', icon: '💊' },
  { value: 'lab_review', label: 'Lab Review', icon: '🧪' },
  { value: 'documentation', label: 'Documentation', icon: '📝' },
  { value: 'other', label: 'Other PCM Activity', icon: '⚕️' }
];

export default function TimeTracker({
  patientId,
  patientName,
  staffId,
  onSave,
  onCancel,
  existingEntries = []
}: TimeTrackerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activityType, setActivityType] = useState<TimeEntry['activityType']>('phone_call');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total time this month
  const totalMinutesThisMonth = existingEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const remainingMinutes = Math.max(0, 30 - totalMinutesThisMonth);

  useEffect(() => {
    if (isTracking && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTracking, isPaused]);

  const handleStart = () => {
    setIsTracking(true);
    setIsPaused(false);
    setStartTime(new Date());
    setElapsedSeconds(0);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsTracking(false);
    setIsPaused(false);
  };

  const handleSave = async () => {
    if (!startTime || elapsedSeconds === 0) {
      alert('Please start and track time before saving');
      return;
    }

    if (!notes.trim()) {
      alert('Please add notes about this PCM activity');
      return;
    }

    setIsSaving(true);

    try {
      const entry: Omit<TimeEntry, 'id'> = {
        patientId,
        patientName,
        activityType,
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        durationMinutes: Math.ceil(elapsedSeconds / 60),
        notes,
        staffId
      };

      await onSave(entry);

      // Reset form
      setIsTracking(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      setNotes('');
      setStartTime(null);
    } catch (error) {
      console.error('Error saving time entry:', error);
      alert('Failed to save time entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatMinutes = (seconds: number) => {
    return Math.ceil(seconds / 60);
  };

  const getProgressColor = () => {
    const totalWithCurrent = totalMinutesThisMonth + formatMinutes(elapsedSeconds);
    if (totalWithCurrent >= 30) return 'green';
    if (totalWithCurrent >= 20) return 'yellow';
    return 'red';
  };

  const progressColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">PCM Time Tracker</h3>
            <p className="text-purple-100 text-sm">{patientName}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-purple-100">This Month</div>
            <div className="text-2xl font-bold">{totalMinutesThisMonth + formatMinutes(elapsedSeconds)} / 30 min</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="h-2 bg-white bg-opacity-20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${progressColors[getProgressColor()]}`}
              style={{
                width: `${Math.min(100, ((totalMinutesThisMonth + formatMinutes(elapsedSeconds)) / 30) * 100)}%`
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-purple-100">
            <span>
              {remainingMinutes > 0 ? `${remainingMinutes} min needed` : 'Target met!'}
            </span>
            <span>30 min required for PCM billing</span>
          </div>
        </div>
      </div>

      {/* Timer Display */}
      <div className="p-6 bg-gray-50">
        <div className="text-center mb-6">
          <div className={`text-6xl font-bold font-mono mb-2 ${
            isTracking ? 'text-blue-600' : 'text-gray-400'
          }`}>
            {formatTime(elapsedSeconds)}
          </div>
          <div className="text-sm text-gray-600">
            {isTracking ? (
              isPaused ? '⏸️ Paused' : '⏺️ Recording...'
            ) : (
              'Click Start to begin tracking'
            )}
          </div>
        </div>

        {/* Timer Controls */}
        <div className="flex gap-3 justify-center mb-6">
          {!isTracking ? (
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Timer
            </button>
          ) : (
            <>
              <button
                onClick={handlePause}
                className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
                  isPaused
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                }`}
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition flex items-center gap-2"
              >
                <Square className="w-5 h-5" />
                Stop
              </button>
            </>
          )}
        </div>

        {/* Activity Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Activity Type</label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setActivityType(type.value as TimeEntry['activityType'])}
                className={`p-3 rounded-lg border-2 text-left transition ${
                  activityType === type.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{type.icon}</span>
                  <span className="text-sm font-medium text-gray-900">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Activity Notes <span className="text-red-600">*</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            rows={4}
            placeholder="Document what was discussed, actions taken, patient concerns, care plan updates, etc."
          />
          <p className="text-xs text-gray-500 mt-1">
            Required for billing compliance - document all PCM activities performed
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || elapsedSeconds === 0 || !notes.trim()}
            className={`flex-1 py-3 font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              isSaving || elapsedSeconds === 0 || !notes.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              <>
                <Clock className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Entry ({formatMinutes(elapsedSeconds)} min)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Recent Entries */}
      {existingEntries.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent Entries This Month
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {existingEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {ACTIVITY_TYPES.find(t => t.value === entry.activityType)?.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(entry.startTime).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-1">{entry.notes}</p>
                </div>
                <div className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded">
                  {entry.durationMinutes} min
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
