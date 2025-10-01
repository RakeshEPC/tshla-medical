'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleStorage } from '@/lib/schedule-storage';
import ScheduleSetup from './ScheduleSetup';
import { runAppointmentMigration } from '../../utils/appointmentMigration';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface PatientSlot {
  id: string;
  time: string;
  initials: string;
  name?: string;
  status: 'scheduled' | 'completed' | 'in-progress';
  notes?: string;
}

export default function DoctorSchedule() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => {
    // Always start with today's date in local timezone
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [slots, setSlots] = useState<PatientSlot[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatientInitials, setNewPatientInitials] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<PatientSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Time slots from 8 AM to 5 PM
  const timeSlots = [
    '08:00',
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
    '17:00',
  ];

  // Run migration first, then load slots
  useEffect(() => {
    // Run migration to consolidate appointments from different storage systems
    runAppointmentMigration();

    // Check if this is first time use
    const allSchedules = scheduleStorage.getAllSchedules();
    if (Object.keys(allSchedules).length === 0 && !localStorage.getItem('schedule_initialized')) {
      setShowSetup(true);
    }
    loadSlotsForDate(selectedDate);
  }, [selectedDate]);

  // Auto-save to prevent data loss
  useEffect(() => {
    const interval = setInterval(() => {
      saveSlotsToStorage();
    }, 5000); // Auto-save every 5 seconds
    return () => clearInterval(interval);
  }, [slots, selectedDate]);

  const loadSlotsForDate = (date: string) => {
    try {
      // Use the persistent storage service
      const savedSlots = scheduleStorage.loadSchedule(date);
      setSlots(savedSlots);
    } catch (error) {
      logError('DoctorSchedule', 'Error message', {});
      setSlots([]);
    }
  };

  const saveSlotsToStorage = () => {
    try {
      // Use the persistent storage service
      scheduleStorage.saveSchedule(selectedDate, slots);
    } catch (error) {
      logError('DoctorSchedule', 'Error message', {});
    }
  };

  const addPatientSlot = () => {
    if (!newPatientInitials.trim() || !selectedTime) {
      alert('Please enter patient initials and select a time');
      return;
    }

    const newSlot: PatientSlot = {
      id: `slot_${Date.now()}`,
      time: selectedTime,
      initials: newPatientInitials.toUpperCase(),
      name: newPatientInitials,
      status: 'scheduled',
      notes: '',
    };

    const updatedSlots = [...slots, newSlot].sort((a, b) => a.time.localeCompare(b.time));

    setSlots(updatedSlots);
    saveSlotsToStorage();

    // Reset form
    setNewPatientInitials('');
    setSelectedTime('');
    setShowAddModal(false);
  };

  const removeSlot = (slotId: string) => {
    const updatedSlots = slots.filter(s => s.id !== slotId);
    setSlots(updatedSlots);
    saveSlotsToStorage();
  };

  const startDictation = (slot: PatientSlot) => {
    // Update slot status
    const updatedSlots = slots.map(s =>
      s.id === slot.id ? { ...s, status: 'in-progress' as const } : s
    );
    setSlots(updatedSlots);
    saveSlotsToStorage();

    // Navigate to dictation with patient info
    sessionStorage.setItem(
      'current_patient',
      JSON.stringify({
        id: slot.id,
        initials: slot.initials,
        name: slot.name || slot.initials,
        date: selectedDate,
        time: slot.time,
      })
    );

    router.push('/doctor/dictation');
  };

  const markComplete = (slotId: string) => {
    const updatedSlots = slots.map(s =>
      s.id === slotId ? { ...s, status: 'completed' as const } : s
    );
    setSlots(updatedSlots);
    saveSlotsToStorage();
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    } else {
      const current = new Date(selectedDate + 'T12:00:00'); // Use noon to avoid timezone issues
      if (direction === 'prev') {
        current.setDate(current.getDate() - 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
    const today = new Date();

    // Compare just the date parts
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isToday,
    };
  };

  const dateDisplay = formatDateDisplay(selectedDate);
  const availableTimes = timeSlots.filter(time => !slots.some(slot => slot.time === time));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {showSetup && (
        <ScheduleSetup
          onComplete={() => {
            setShowSetup(false);
            localStorage.setItem('schedule_initialized', 'true');
            loadSlotsForDate(selectedDate);
          }}
        />
      )}
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Doctor Schedule</h1>
              <p className="text-gray-600 mt-1">Manage your patient appointments</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const data = scheduleStorage.exportSchedules();
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `schedule_backup_${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                }}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                Export
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e: any) => {
                        if (scheduleStorage.importSchedules(e.target.result)) {
                          alert('Schedule imported successfully!');
                          loadSlotsForDate(selectedDate);
                        } else {
                          alert('Failed to import schedule');
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Import
              </button>
              <button
                onClick={() => router.push('/doctor/login')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ← Previous
            </button>

            <div className="text-center">
              <div className="text-lg font-semibold">
                {dateDisplay.day}
                {dateDisplay.isToday && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    TODAY
                  </span>
                )}
              </div>
              <div className="text-gray-600">{dateDisplay.date}</div>
            </div>

            <div className="flex gap-2">
              {!dateDisplay.isToday && (
                <button
                  onClick={() => navigateDate('today')}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  Today
                </button>
              )}
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Appointments ({slots.length})</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Patient
            </button>
          </div>

          {slots.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No appointments scheduled for this day</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Add your first patient →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map(slot => (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    slot.status === 'completed'
                      ? 'bg-green-50 border-green-200'
                      : slot.status === 'in-progress'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-medium text-gray-700">{slot.time}</span>
                    <div>
                      <span className="text-lg font-semibold">{slot.initials}</span>
                      {slot.name && slot.name !== slot.initials && (
                        <span className="ml-2 text-gray-600">({slot.name})</span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        slot.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : slot.status === 'in-progress'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {slot.status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {slot.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => startDictation(slot)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Start Dictation
                        </button>
                        <button
                          onClick={() => markComplete(slot.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Mark Complete
                        </button>
                      </>
                    )}
                    {slot.status === 'in-progress' && (
                      <button
                        onClick={() => startDictation(slot)}
                        className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                      >
                        Continue Dictation
                      </button>
                    )}
                    <button
                      onClick={() => removeSlot(slot.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add Patient to Schedule</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Initials or Name
                </label>
                <input
                  type="text"
                  value={newPatientInitials}
                  onChange={e => setNewPatientInitials(e.target.value)}
                  placeholder="e.g., JD or John Doe"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter initials or partial name for quick reference
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Time
                </label>
                <select
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select time</option>
                  {availableTimes.map(time => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addPatientSlot}
                disabled={!newPatientInitials.trim() || !selectedTime}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Add to Schedule
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewPatientInitials('');
                  setSelectedTime('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
