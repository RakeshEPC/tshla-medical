'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleStorage } from '@/lib/schedule-storage';

interface PatientSlot {
  id: string;
  time: string;
  initials: string;
  name?: string;
  status: 'scheduled' | 'completed' | 'in-progress';
  notes?: string;
}

export default function SimplifiedSchedule() {
  const router = useRouter();
  const [slots, setSlots] = useState<PatientSlot[]>([]);
  const [quickName, setQuickName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Always use today's date
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    loadTodaySchedule();
  }, []);

  const loadTodaySchedule = () => {
    const savedSlots = scheduleStorage.loadSchedule(dateStr);
    setSlots(savedSlots);
  };

  const quickAddPatient = () => {
    if (!quickName.trim()) {
      alert('Please enter a name or initials');
      return;
    }

    // Auto-assign next available time
    const times = [
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
    ];
    const usedTimes = slots.map(s => s.time);
    const availableTime = times.find(t => !usedTimes.includes(t)) || '12:00';

    const newSlot: PatientSlot = {
      id: `patient_${Date.now()}`,
      time: availableTime,
      initials: quickName.substring(0, 3).toUpperCase(),
      name: quickName,
      status: 'scheduled',
      notes: '',
    };

    const updatedSlots = [...slots, newSlot].sort((a, b) => a.time.localeCompare(b.time));

    setSlots(updatedSlots);
    scheduleStorage.saveSchedule(dateStr, updatedSlots);

    setQuickName('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const startDictationForPatient = (slot: PatientSlot) => {
    // Update status
    const updatedSlots = slots.map(s =>
      s.id === slot.id ? { ...s, status: 'in-progress' as const } : s
    );
    setSlots(updatedSlots);
    scheduleStorage.saveSchedule(dateStr, updatedSlots);

    // Save patient info for dictation page
    sessionStorage.setItem(
      'current_patient',
      JSON.stringify({
        id: slot.id,
        initials: slot.initials,
        name: slot.name || slot.initials,
        date: dateStr,
        time: slot.time,
      })
    );

    // Go to simplified dictation
    router.push('/doctor/easy-dictation');
  };

  const removePatient = (slotId: string) => {
    const updatedSlots = slots.filter(s => s.id !== slotId);
    setSlots(updatedSlots);
    scheduleStorage.saveSchedule(dateStr, updatedSlots);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Clear Instructions */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Doctor's Schedule</h1>
              <p className="text-lg text-gray-600 mt-1">
                {today.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={() => router.push('/doctor/login')}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>

          {/* Quick Add Section with Big Number 1 */}
          <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  1
                </div>
              </div>
              <div className="flex-grow">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Quick Add Patient</h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={quickName}
                    onChange={e => setQuickName(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && quickAddPatient()}
                    placeholder="Type patient name or initials (e.g., John Doe or JD)"
                    className="flex-grow px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={quickAddPatient}
                    className="px-10 py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    + Add Patient
                  </button>
                </div>
                <p className="text-base text-gray-700 mt-3 font-medium">
                  💡 <strong>Tip:</strong> Just type a name (like "John D" or "JD") and click Add -
                  we'll automatically assign the next available time slot for you!
                </p>
              </div>
            </div>
          </div>

          {showSuccess && (
            <div className="mt-4 p-4 bg-green-100 border-2 border-green-300 rounded-lg">
              <p className="text-green-800 font-semibold">✓ Patient added successfully!</p>
            </div>
          )}
        </div>

        {/* Today's Patients Section with Number 2 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
              2
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Today's Patients ({slots.length})
              </h2>
              <p className="text-gray-700 text-lg">
                Click the green <strong>"Start Dictation"</strong> button next to any patient
              </p>
            </div>
          </div>

          {slots.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl text-gray-600 mb-2">No patients scheduled yet</p>
              <p className="text-gray-500">Add a patient using the form above (Step 1)</p>
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`p-5 rounded-xl border-2 transition-all ${
                    slot.status === 'completed'
                      ? 'bg-green-50 border-green-300'
                      : slot.status === 'in-progress'
                        ? 'bg-yellow-50 border-yellow-300 shadow-lg'
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold text-gray-400">#{index + 1}</div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-gray-700">{slot.time}</span>
                          <span className="text-xl font-bold text-gray-900">
                            {slot.name || slot.initials}
                          </span>
                          {slot.status === 'completed' && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                              ✓ Completed
                            </span>
                          )}
                          {slot.status === 'in-progress' && (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold animate-pulse">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {slot.status !== 'completed' && (
                        <button
                          onClick={() => startDictationForPatient(slot)}
                          className="px-8 py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 text-xl flex items-center gap-2 shadow-lg animate-pulse"
                          title="Click here to start recording medical notes for this patient"
                        >
                          <span className="text-2xl">🎤</span>
                          Start Dictation
                        </button>
                      )}
                      <button
                        onClick={() => removePatient(slot.id)}
                        className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-yellow-50 rounded-xl p-6 border-2 border-yellow-200">
          <h3 className="font-semibold text-lg mb-3">📌 Quick Guide:</h3>
          <ol className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">Step 1:</span>
              <span>Type patient name above and click "+ Add"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-green-600">Step 2:</span>
              <span>Click "Start Dictation" button next to the patient</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-purple-600">Step 3:</span>
              <span>On dictation page: Record → Stop → Process with AI → Save</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
