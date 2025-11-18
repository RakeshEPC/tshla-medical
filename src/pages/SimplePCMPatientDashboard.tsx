/**
 * Simplified PCM Patient Dashboard
 * Ultra-simple interface for patients to manage their PCM care
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Plus,
  MessageCircle,
  Calendar,
  TrendingDown,
  TrendingUp,
  Activity,
  Heart,
  Phone,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import QuickVitalEntry from '../components/pcm/QuickVitalEntry';
import { pcmService } from '../services/pcm.service';
import type { PatientTask, VitalReading } from '../services/pcm.service';

export default function SimplePCMPatientDashboard() {
  const navigate = useNavigate();

  // State
  const [tasks, setTasks] = useState<PatientTask[]>([]);
  const [latestVitals, setLatestVitals] = useState<Partial<VitalReading>>({});
  const [showVitalEntry, setShowVitalEntry] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock patient data - in production, get from session/context
  const patient = {
    id: 'demo-patient-001',
    name: 'Jane Smith',
    targetA1C: 7.0,
    targetBP: { systolic: 130, diastolic: 80 },
    targetWeight: 165,
    providerName: 'Dr. Sarah Johnson',
    providerPhone: '(555) 123-4567'
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, vitalsData, statsData] = await Promise.all([
        pcmService.getPatientTasks(patient.id),
        pcmService.getLatestVitals(patient.id),
        pcmService.getPatientStats(patient.id)
      ]);

      setTasks(tasksData);
      setLatestVitals(vitalsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    await pcmService.toggleTaskComplete(taskId, patient.id);
    await loadDashboardData();
  };

  const handleSaveVitals = async (vitals: any) => {
    await pcmService.logVitals(patient.id, vitals);
    setShowVitalEntry(false);
    await loadDashboardData();
  };

  const getTodayTasks = () => {
    return tasks.filter(t => t.frequency === 'daily');
  };

  const getCompletedCount = () => {
    return getTodayTasks().filter(t => t.completed).length;
  };

  const getProgressColor = () => {
    const completed = getCompletedCount();
    const total = getTodayTasks().length;
    const percentage = (completed / total) * 100;

    if (percentage >= 80) return 'green';
    if (percentage >= 50) return 'yellow';
    return 'red';
  };

  const progressColors = {
    green: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' },
    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' },
    red: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const color = getProgressColor();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {patient.name}!</h1>
              <p className="text-sm text-gray-600">Diabetes Care Program (PCM)</p>
            </div>
            <button
              onClick={() => navigate('/patient-portal-login')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Daily Progress Card */}
        <div className={`${progressColors[color].light} border-2 border-${color}-200 rounded-2xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Today's Progress</h2>
              <p className="text-sm text-gray-600">Complete your daily activities</p>
            </div>
            <div className={`text-4xl font-bold ${progressColors[color].text}`}>
              {getCompletedCount()}/{getTodayTasks().length}
            </div>
          </div>

          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColors[color].bg} transition-all duration-500`}
              style={{ width: `${(getCompletedCount() / getTodayTasks().length) * 100}%` }}
            />
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Log Vitals Button */}
          <button
            onClick={() => setShowVitalEntry(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-6 hover:from-blue-700 hover:to-blue-800 transition shadow-lg hover:shadow-xl"
          >
            <Plus className="w-8 h-8 mb-3 mx-auto" />
            <div className="text-lg font-bold">Log Vitals</div>
            <div className="text-sm text-blue-100">Record today's readings</div>
          </button>

          {/* Message Care Team Button */}
          <button
            onClick={() => alert('Opening secure messaging...')}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-2xl p-6 hover:from-green-700 hover:to-green-800 transition shadow-lg hover:shadow-xl"
          >
            <MessageCircle className="w-8 h-8 mb-3 mx-auto" />
            <div className="text-lg font-bold">Message Team</div>
            <div className="text-sm text-green-100">Get help anytime</div>
          </button>
        </div>

        {/* Today's Tasks */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-blue-600" />
            Today's Actions
          </h3>

          <div className="space-y-3">
            {getTodayTasks().map((task) => (
              <label
                key={task.id}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                  task.completed
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id)}
                  className="mt-1 w-6 h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className={`font-semibold ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{task.description}</div>
                </div>
                {task.completed && <Check className="w-6 h-6 text-green-600 mt-1" />}
              </label>
            ))}
          </div>
        </div>

        {/* Your Numbers at a Glance */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-600" />
            Your Numbers
          </h3>

          <div className="grid grid-cols-3 gap-4">
            {/* Blood Sugar */}
            <div className="text-center p-4 bg-red-50 rounded-xl border-2 border-red-200">
              <div className="text-xs font-semibold text-red-900 uppercase tracking-wide mb-2">Blood Sugar</div>
              <div className="text-3xl font-bold text-gray-900">{latestVitals.bloodSugar || '--'}</div>
              <div className="text-xs text-gray-600 mt-1">mg/dL</div>
              {latestVitals.bloodSugar && latestVitals.bloodSugar <= 130 ? (
                <div className="mt-2 text-xs text-green-600 font-semibold flex items-center justify-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  On target!
                </div>
              ) : latestVitals.bloodSugar ? (
                <div className="mt-2 text-xs text-yellow-600 font-semibold flex items-center justify-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Keep monitoring
                </div>
              ) : null}
            </div>

            {/* Weight */}
            <div className="text-center p-4 bg-green-50 rounded-xl border-2 border-green-200">
              <div className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-2">Weight</div>
              <div className="text-3xl font-bold text-gray-900">{latestVitals.weight || '--'}</div>
              <div className="text-xs text-gray-600 mt-1">lbs</div>
              <div className="text-xs text-gray-600 mt-1">Goal: {patient.targetWeight}</div>
            </div>

            {/* Blood Pressure */}
            <div className="text-center p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
              <div className="text-xs font-semibold text-orange-900 uppercase tracking-wide mb-2">Blood Pressure</div>
              <div className="text-2xl font-bold text-gray-900">
                {latestVitals.systolic && latestVitals.diastolic
                  ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                  : '--/--'}
              </div>
              <div className="text-xs text-gray-600 mt-1">mmHg</div>
              <div className="text-xs text-gray-600 mt-1">Goal: &lt;130/80</div>
            </div>
          </div>

          {/* Log Vitals Reminder */}
          {(!latestVitals.bloodSugar && !latestVitals.weight && !latestVitals.systolic) && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <div className="font-semibold text-blue-900">No vitals logged yet</div>
                <div className="text-sm text-blue-700">Tap "Log Vitals" to record your readings</div>
              </div>
            </div>
          )}
        </div>

        {/* Contact Your Care Team */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Heart className="w-6 h-6" />
            Your Care Team is Here
          </h3>
          <p className="text-purple-100 mb-4">Have questions? Need support? We're available 24/7.</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.href = `tel:${patient.providerPhone}`}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 transition flex items-center gap-2 justify-center"
            >
              <Phone className="w-5 h-5" />
              <span className="font-semibold">Call Now</span>
            </button>
            <button
              onClick={() => alert('Opening secure messaging...')}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 transition flex items-center gap-2 justify-center"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold">Send Message</span>
            </button>
          </div>

          <div className="mt-4 text-sm text-purple-100 text-center">
            Provider: {patient.providerName}
          </div>
        </div>

        {/* Next Appointment (if any) */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Upcoming Appointments
          </h3>

          {/* Demo appointment */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 bg-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">Diabetes Follow-up</div>
                <div className="text-sm text-gray-600 mt-1">March 15, 2025 at 10:00 AM</div>
                <div className="text-sm text-gray-600">with {patient.providerName}</div>
              </div>
              <ChevronRight className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Vital Entry Modal */}
      {showVitalEntry && (
        <QuickVitalEntry
          onSave={handleSaveVitals}
          onCancel={() => setShowVitalEntry(false)}
          patientGoals={{
            targetBloodSugar: { min: 80, max: 130 },
            targetWeight: patient.targetWeight,
            targetBP: patient.targetBP
          }}
        />
      )}
    </div>
  );
}
