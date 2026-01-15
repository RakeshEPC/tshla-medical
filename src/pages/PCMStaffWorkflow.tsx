/**
 * PCM Staff Workflow Dashboard
 * Task-oriented workflow for PCM staff to manage daily calls
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FileText,
  Save,
  X,
  Users,
  Calendar,
  Activity
} from 'lucide-react';
import TimeTracker from '../components/pcm/TimeTracker';
import { pcmService } from '../services/pcm.service';
import type { PCMPatient } from '../components/pcm/PatientRiskCard';

interface CallNote {
  patientId: string;
  notes: string;
  duration: number;
  outcome: 'completed' | 'no-answer' | 'voicemail' | 'rescheduled';
}

type BoardColumn = 'not-contacted' | 'in-progress' | 'completed';

export default function PCMStaffWorkflow() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PCMPatient[]>([]);
  const [board, setBoard] = useState<Record<BoardColumn, PCMPatient[]>>({
    'not-contacted': [],
    'in-progress': [],
    'completed': []
  });
  const [selectedPatient, setSelectedPatient] = useState<PCMPatient | null>(null);
  const [showTimeTracker, setShowTimeTracker] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callOutcome, setCallOutcome] = useState<CallNote['outcome']>('completed');
  const [isLoading, setIsLoading] = useState(true);

  // Mock staff data
  const staff = {
    id: 'staff-001',
    name: 'Jennifer Martinez, RN'
  };

  useEffect(() => {
    loadWorkflow();
  }, []);

  const loadWorkflow = async () => {
    setIsLoading(true);
    try {
      const allPatients = await pcmService.getPCMPatients();

      // Organize patients into board columns
      // Prioritize: overdue first, then by next contact date
      const today = new Date();
      const notContacted = allPatients
        .filter(p => {
          const nextDue = new Date(p.nextContactDue);
          const lastContact = new Date(p.lastContact);
          const daysSinceContact = (today.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceContact >= 25; // Due for contact soon or overdue
        })
        .sort((a, b) => new Date(a.nextContactDue).getTime() - new Date(b.nextContactDue).getTime());

      setBoard({
        'not-contacted': notContacted,
        'in-progress': [],
        'completed': []
      });

      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading workflow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const movePatient = (patient: PCMPatient, from: BoardColumn, to: BoardColumn) => {
    setBoard(prev => ({
      ...prev,
      [from]: prev[from].filter(p => p.id !== patient.id),
      [to]: [...prev[to], patient]
    }));
  };

  const handleStartCall = (patient: PCMPatient) => {
    setSelectedPatient(patient);
    setCallNotes('');
    setCallOutcome('completed');
    movePatient(patient, 'not-contacted', 'in-progress');
    setShowTimeTracker(true);
  };

  const handleSaveCall = async () => {
    if (!selectedPatient) return;

    if (!callNotes.trim()) {
      alert('Please enter call notes before saving');
      return;
    }

    try {
      // Log the contact
      await pcmService.logPatientContact(selectedPatient.id, callNotes);

      // Move to completed
      movePatient(selectedPatient, 'in-progress', 'completed');

      // Clear form
      setSelectedPatient(null);
      setCallNotes('');
      setShowTimeTracker(false);

      // Reload to get updated data
      await loadWorkflow();
    } catch (error) {
      console.error('Error saving call:', error);
      alert('Failed to save call notes');
    }
  };

  const handleCancelCall = () => {
    if (selectedPatient) {
      movePatient(selectedPatient, 'in-progress', 'not-contacted');
      setSelectedPatient(null);
      setCallNotes('');
      setShowTimeTracker(false);
    }
  };

  const handleSaveTimeEntry = async (entry: any) => {
    await pcmService.logTime(entry);
    console.log('Time entry saved:', entry);
  };

  const getTotalCallsToday = () => {
    return board['completed'].length;
  };

  const getRemainingCalls = () => {
    return board['not-contacted'].length;
  };

  const getTotalTimeToday = () => {
    // In production, calculate from actual time entries
    return board['completed'].length * 15; // Estimate 15 min per call
  };

  const isOverdue = (patient: PCMPatient) => {
    return new Date(patient.nextContactDue) < new Date();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PCM Call Workflow</h1>
                <p className="text-sm text-gray-600">{staff.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-600">Calls Today</div>
                <div className="text-2xl font-bold text-green-600">{getTotalCallsToday()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Time Logged</div>
                <div className="text-2xl font-bold text-blue-600">{getTotalTimeToday()} min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">To Contact</div>
                <div className="text-3xl font-bold text-red-600">{getRemainingCalls()}</div>
              </div>
              <Phone className="w-12 h-12 text-red-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">In Progress</div>
                <div className="text-3xl font-bold text-yellow-600">{board['in-progress'].length}</div>
              </div>
              <Clock className="w-12 h-12 text-yellow-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Completed Today</div>
                <div className="text-3xl font-bold text-green-600">{getTotalCallsToday()}</div>
              </div>
              <CheckCircle2 className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Not Contacted Column */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-red-600 text-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">To Contact</h3>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                  {board['not-contacted'].length}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {board['not-contacted'].length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                board['not-contacted'].map((patient) => (
                  <div
                    key={patient.id}
                    className={`border-2 rounded-lg p-4 ${
                      isOverdue(patient) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900">{patient.name}</h4>
                        <p className="text-sm text-gray-600">{patient.phone}</p>
                      </div>
                      {isOverdue(patient) && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 mb-3">
                      Due: {new Date(patient.nextContactDue).toLocaleDateString()}
                    </div>

                    <button
                      onClick={() => handleStartCall(patient)}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Start Call
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-yellow-600 text-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">In Progress</h3>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                  {board['in-progress'].length}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {board['in-progress'].length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">No active calls</p>
                </div>
              ) : (
                board['in-progress'].map((patient) => (
                  <div key={patient.id} className="border-2 border-yellow-300 bg-yellow-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{patient.name}</h4>
                      <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse" />
                    </div>

                    <p className="text-sm text-gray-600 mb-3">{patient.phone}</p>

                    <div className="text-xs text-gray-600 bg-white p-2 rounded mb-3">
                      Current A1C: {patient.currentA1C}% | Med: {patient.medicationAdherence}%
                    </div>

                    {patient.id === selectedPatient?.id && (
                      <div className="text-xs text-yellow-700 font-semibold">
                        Active - Complete call below
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-green-600 text-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Completed</h3>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                  {board['completed'].length}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {board['completed'].length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">No completed calls yet</p>
                </div>
              ) : (
                board['completed'].map((patient) => (
                  <div key={patient.id} className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{patient.name}</h4>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>

                    <p className="text-xs text-gray-600">Contacted today</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Active Call Panel */}
        {selectedPatient && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-blue-600 shadow-2xl p-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Call Notes */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Active Call: {selectedPatient.name}</h3>
                      <p className="text-sm text-gray-600">{selectedPatient.phone}</p>
                    </div>
                    <button
                      onClick={handleCancelCall}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  {/* Quick Info */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-100 rounded p-2 text-center">
                      <div className="text-xs text-gray-600">A1C</div>
                      <div className="font-bold text-gray-900">{selectedPatient.currentA1C}%</div>
                    </div>
                    <div className="bg-gray-100 rounded p-2 text-center">
                      <div className="text-xs text-gray-600">BP</div>
                      <div className="font-bold text-gray-900">{selectedPatient.currentBP}</div>
                    </div>
                    <div className="bg-gray-100 rounded p-2 text-center">
                      <div className="text-xs text-gray-600">Med</div>
                      <div className="font-bold text-gray-900">{selectedPatient.medicationAdherence}%</div>
                    </div>
                  </div>

                  {/* Call Outcome */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Call Outcome</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'completed', label: 'Completed', icon: CheckCircle2 },
                        { value: 'no-answer', label: 'No Answer', icon: Phone },
                        { value: 'voicemail', label: 'Voicemail', icon: Phone },
                        { value: 'rescheduled', label: 'Rescheduled', icon: Calendar }
                      ].map((outcome) => (
                        <button
                          key={outcome.value}
                          onClick={() => setCallOutcome(outcome.value as CallNote['outcome'])}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition ${
                            callOutcome === outcome.value
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-700 hover:border-blue-300'
                          }`}
                        >
                          <outcome.icon className="w-4 h-4 inline-block mr-1" />
                          {outcome.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Call Notes */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Call Notes <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
                      rows={6}
                      placeholder="Document patient status, concerns discussed, action items, medication changes, etc."
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveCall}
                    disabled={!callNotes.trim()}
                    className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                      !callNotes.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Save className="w-5 h-5" />
                    Complete Call & Save Notes
                  </button>
                </div>

                {/* Time Tracker */}
                <div>
                  {showTimeTracker && (
                    <TimeTracker
                      patientId={selectedPatient.id}
                      patientName={selectedPatient.name}
                      staffId={staff.id}
                      onSave={handleSaveTimeEntry}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
