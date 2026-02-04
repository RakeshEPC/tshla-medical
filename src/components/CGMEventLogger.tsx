import React, { useState } from 'react';
import { X, Utensils, Syringe, Dumbbell, StickyNote } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface CGMEventLoggerProps {
  patientPhone: string;
  onClose: () => void;
  onSaved: () => void;
}

type EventType = 'meal' | 'insulin' | 'exercise' | 'note';

const EVENT_TYPES: { type: EventType; label: string; icon: React.ReactNode }[] = [
  { type: 'meal', label: 'Meal', icon: <Utensils className="w-4 h-4" /> },
  { type: 'insulin', label: 'Insulin', icon: <Syringe className="w-4 h-4" /> },
  { type: 'exercise', label: 'Exercise', icon: <Dumbbell className="w-4 h-4" /> },
  { type: 'note', label: 'Note', icon: <StickyNote className="w-4 h-4" /> },
];

const CGMEventLogger: React.FC<CGMEventLoggerProps> = ({ patientPhone, onClose, onSaved }) => {
  const [eventType, setEventType] = useState<EventType>('meal');
  const [saving, setSaving] = useState(false);

  // Meal fields
  const [carbsGrams, setCarbsGrams] = useState('');
  const [mealLabel, setMealLabel] = useState('');

  // Insulin fields
  const [insulinUnits, setInsulinUnits] = useState('');
  const [insulinType, setInsulinType] = useState('rapid');

  // Exercise fields
  const [exerciseMinutes, setExerciseMinutes] = useState('');
  const [exerciseType, setExerciseType] = useState('walk');
  const [exerciseIntensity, setExerciseIntensity] = useState('moderate');

  // General
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState(
    new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm for datetime-local input
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const body: Record<string, any> = {
      patient_phone: patientPhone,
      event_type: eventType,
      event_timestamp: new Date(timestamp).toISOString(),
      notes: notes || undefined,
      recorded_by: 'provider',
    };

    if (eventType === 'meal') {
      body.carbs_grams = carbsGrams ? parseInt(carbsGrams) : undefined;
      body.meal_label = mealLabel || undefined;
    } else if (eventType === 'insulin') {
      body.insulin_units = insulinUnits ? parseFloat(insulinUnits) : undefined;
      body.insulin_type = insulinType;
    } else if (eventType === 'exercise') {
      body.exercise_minutes = exerciseMinutes ? parseInt(exerciseMinutes) : undefined;
      body.exercise_type = exerciseType;
      body.exercise_intensity = exerciseIntensity;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/cgm/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Log Event</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Event Type Selector */}
          <div className="flex gap-2">
            {EVENT_TYPES.map(et => (
              <button
                key={et.type}
                type="button"
                onClick={() => setEventType(et.type)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  eventType === et.type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {et.icon}
                {et.label}
              </button>
            ))}
          </div>

          {/* Timestamp */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">When</label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={e => setTimestamp(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Meal Fields */}
          {eventType === 'meal' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Meal</label>
                <div className="flex gap-2">
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMealLabel(m)}
                      className={`px-3 py-1.5 rounded-md text-sm ${
                        mealLabel === m ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value={carbsGrams}
                  onChange={e => setCarbsGrams(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {/* Insulin Fields */}
          {eventType === 'insulin' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Type</label>
                <div className="flex gap-2">
                  {['rapid', 'long-acting', 'correction'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInsulinType(t)}
                      className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                        insulinType === t ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Units</label>
                <input
                  type="number"
                  step="0.5"
                  value={insulinUnits}
                  onChange={e => setInsulinUnits(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {/* Exercise Fields */}
          {eventType === 'exercise' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Activity</label>
                <div className="flex gap-2">
                  {['walk', 'run', 'gym', 'other'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setExerciseType(t)}
                      className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                        exerciseType === t ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={exerciseMinutes}
                    onChange={e => setExerciseMinutes(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Intensity</label>
                  <select
                    value={exerciseIntensity}
                    onChange={e => setExerciseIntensity(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="vigorous">Vigorous</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Log Event'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CGMEventLogger;
