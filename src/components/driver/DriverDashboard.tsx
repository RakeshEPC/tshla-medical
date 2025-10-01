'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { testPatients } from '@/lib/testPatients';
import { templateStorage } from '@/lib/templateStorage';

interface QuickPatient {
  id: string;
  name: string;
  time: string;
  status: 'pending' | 'in-progress' | 'completed';
  chiefComplaint?: string;
}

interface QuickStats {
  todayTotal: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export default function DriverDashboard() {
  const router = useRouter();
  const [todayPatients, setTodayPatients] = useState<QuickPatient[]>([]);
  const [stats, setStats] = useState<QuickStats>({
    todayTotal: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
  });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickPatientName, setQuickPatientName] = useState('');
  const [quickPatientTime, setQuickPatientTime] = useState('');
  const [currentPatientId, setCurrentPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<QuickPatient | null>(null);

  useEffect(() => {
    loadTodaySchedule();
  }, []);

  const loadTodaySchedule = () => {
    // Load first 5 test patients as today's schedule
    const quickList: QuickPatient[] = testPatients.slice(0, 5).map((p, idx) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      time: `${9 + Math.floor(idx * 0.5)}:${idx % 2 === 0 ? '00' : '30'} AM`,
      status: idx < 2 ? 'completed' : idx === 2 ? 'in-progress' : 'pending',
      chiefComplaint: p.visitHistory?.[0]?.chiefComplaint || 'General checkup',
    }));

    setTodayPatients(quickList);
    updateStats(quickList);
  };

  const updateStats = (patients: QuickPatient[]) => {
    setStats({
      todayTotal: patients.length,
      completed: patients.filter(p => p.status === 'completed').length,
      inProgress: patients.filter(p => p.status === 'in-progress').length,
      pending: patients.filter(p => p.status === 'pending').length,
    });
  };

  const addQuickPatient = () => {
    if (!quickPatientName) {
      alert('Please enter patient name');
      return;
    }

    // Generate a temporary ID for this quick dictation session
    const tempId = `temp-${Date.now()}`;

    const newPatient: QuickPatient = {
      id: tempId,
      name: quickPatientName,
      time: quickPatientTime || 'Walk-in',
      status: 'pending',
      chiefComplaint: 'Quick dictation',
    };

    const updatedPatients = [...todayPatients, newPatient];
    setTodayPatients(updatedPatients);
    updateStats(updatedPatients);

    setQuickPatientName('');
    setQuickPatientTime('');
    setShowQuickAdd(false);
  };

  const startDictation = (patient: QuickPatient) => {
    setSelectedPatient(patient);
    setCurrentPatientId(patient.id);
    // Parse first and last name from the patient name
    const nameParts = patient.name.split(' ');
    const firstName = nameParts[0] || 'Quick';
    const lastName = nameParts.slice(1).join(' ') || 'Dictation';
    router.push(
      `/driver/patient/${patient.id}?quick=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`
    );
  };

  const navigateToSection = (section: string) => {
    switch (section) {
      case 'patients':
        router.push('/driver/patients');
        break;
      case 'templates':
        router.push('/driver/template-studio-enhanced');
        break;
      case 'priorauth':
        router.push('/driver/priorauth');
        break;
      case 'import':
        router.push('/driver/import-emr');
        break;
      default:
        router.push(`/driver/${section}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Doctor Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Welcome back, Dr. Musk</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Today's Date</p>
                <p className="font-semibold">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Link
                href="/login"
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.todayTotal}</p>
              <p className="text-sm opacity-90">Total Patients</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.completed}</p>
              <p className="text-sm opacity-90">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.inProgress}</p>
              <p className="text-sm opacity-90">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.pending}</p>
              <p className="text-sm opacity-90">Pending</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Today's Schedule */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 animate-slide-up">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Today's Schedule</h2>
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  + Quick Add
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {todayPatients.map(patient => (
                  <div
                    key={patient.id}
                    onClick={() => startDictation(patient)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      patient.status === 'completed'
                        ? 'bg-green-50 border-green-300'
                        : patient.status === 'in-progress'
                          ? 'bg-yellow-50 border-yellow-300 animate-pulse'
                          : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{patient.time}</p>
                        <p className="text-gray-800">{patient.name}</p>
                        {patient.chiefComplaint && (
                          <p className="text-xs text-gray-600 mt-1">{patient.chiefComplaint}</p>
                        )}
                      </div>
                      {patient.status === 'completed' && <span className="text-green-600">✓</span>}
                      {patient.status === 'in-progress' && (
                        <span className="text-yellow-600">●</span>
                      )}
                    </div>
                  </div>
                ))}

                {todayPatients.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No patients scheduled</p>
                )}
              </div>

              <Link
                href="/driver/patients"
                className="mt-4 w-full block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Full Schedule →
              </Link>
            </div>
          </div>

          {/* Center Column - Quick Actions */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4">
              {/* Patient Management */}
              <div
                onClick={() => navigateToSection('patients')}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transform hover:scale-[1.02] transition-all animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-2xl font-bold text-gray-800">{stats.todayTotal}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Patient Management</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Schedule, view history, track progression
                </p>
              </div>

              {/* Start Dictation */}
              <div
                onClick={() => {
                  const nextPatient = todayPatients.find(p => p.status === 'pending');
                  if (nextPatient) {
                    startDictation(nextPatient);
                  } else {
                    // Start anonymous dictation with no patient data
                    router.push(
                      '/driver/patient/new?quick=true&firstName=Anonymous&lastName=Dictation'
                    );
                  }
                }}
                className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transform hover:scale-[1.02] transition-all text-white animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  <span className="text-3xl font-bold">→</span>
                </div>
                <h3 className="text-lg font-semibold">Start Dictation</h3>
                <p className="text-sm opacity-90 mt-1">
                  {todayPatients.find(p => p.status === 'pending')
                    ? `Next: ${todayPatients.find(p => p.status === 'pending')?.name}`
                    : 'Begin anonymous note (no patient data stored)'}
                </p>
              </div>

              {/* Templates */}
              <div
                onClick={() => navigateToSection('templates')}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transform hover:scale-[1.02] transition-all animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    {templateStorage.getTemplates().length} templates
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Templates</h3>
                <p className="text-sm text-gray-600 mt-1">Create & manage note templates</p>
              </div>

              {/* Prior Auth */}
              <div
                onClick={() => navigateToSection('priorauth')}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transform hover:scale-[1.02] transition-all animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-orange-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded animate-pulse">
                    Active
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Prior Authorization</h3>
                <p className="text-sm text-gray-600 mt-1">Manage insurance approvals</p>
              </div>

              {/* EMR Import */}
              <div
                onClick={() => navigateToSection('import')}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transform hover:scale-[1.02] transition-all animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-indigo-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-indigo-600">Import</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">EMR Import</h3>
                <p className="text-sm text-gray-600 mt-1">Import patient records</p>
              </div>

              {/* Mental Health Results */}
              <div
                onClick={() => router.push('/driver/mental-health-results')}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transform hover:scale-[1.02] transition-all animate-slide-up text-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm bg-white bg-opacity-20 px-2 py-1 rounded animate-pulse">
                    PHQ-9 & GAD-7
                  </span>
                </div>
                <h3 className="text-lg font-semibold">Mental Health Screening</h3>
                <p className="text-sm opacity-90 mt-1">View patient PHQ-9 & GAD-7 results</p>
              </div>
            </div>

            {/* Quick Patient ID Section */}
            <div className="mt-6 bg-white rounded-xl shadow-lg p-6 animate-slide-up">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Patient</h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Patient ID</label>
                  <input
                    type="text"
                    value={currentPatientId}
                    onChange={e => setCurrentPatientId(e.target.value)}
                    placeholder="Enter or generate patient ID"
                    className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setCurrentPatientId(`temp-${Date.now()}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate Temp ID
                  </button>
                  <button
                    onClick={() => setCurrentPatientId('')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {currentPatientId && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Ready to start dictation for patient: <strong>{currentPatientId}</strong>
                  </p>
                  <button
                    onClick={() => router.push(`/driver/patient/${currentPatientId}?quick=true`)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Start Dictation →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Patient Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-xl font-bold mb-4">Quick Add Patient</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name *
                </label>
                <input
                  type="text"
                  value={quickPatientName}
                  onChange={e => setQuickPatientName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
                <input
                  type="text"
                  value={quickPatientTime}
                  onChange={e => setQuickPatientTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="2:00 PM or Walk-in"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addQuickPatient}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add to Schedule
              </button>
              <button
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickPatientName('');
                  setQuickPatientTime('');
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
