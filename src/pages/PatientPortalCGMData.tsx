/**
 * Patient Portal CGM Data View
 * Wraps GlucoseTab for patient-facing access to their own glucose data.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Activity, RefreshCw, WifiOff } from 'lucide-react';
import GlucoseTab from '../components/GlucoseTab';
import type { CGMCurrentGlucose, CGMStats, CGMComparison } from '../types/cgm.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
  sessionStart: string;
}

const PatientPortalCGMData: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<PatientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [currentGlucose, setCurrentGlucose] = useState<CGMCurrentGlucose | null>(null);
  const [stats14day, setStats14day] = useState<CGMStats | null>(null);
  const [comparison, setComparison] = useState<CGMComparison | null>(null);
  const [phone10, setPhone10] = useState('');

  // Load session
  useEffect(() => {
    const stateSession = location.state?.session;
    if (stateSession) {
      setSession(stateSession);
      return;
    }

    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession) {
      navigate('/patient-portal-unified');
      return;
    }

    try {
      const parsed = JSON.parse(savedSession);
      const age = Date.now() - new Date(parsed.sessionStart).getTime();
      if (age < 2 * 60 * 60 * 1000 && age > 0) {
        setSession(parsed);
      } else {
        sessionStorage.removeItem('patient_portal_session');
        navigate('/patient-portal-unified');
      }
    } catch {
      navigate('/patient-portal-unified');
    }
  }, [navigate, location.state]);

  // Fetch CGM summary
  useEffect(() => {
    if (!session) return;

    const fetchSummary = async () => {
      const p10 = session.patientPhone.replace(/\D/g, '').slice(-10);
      setPhone10(p10);

      try {
        const res = await fetch(`${API_BASE_URL}/api/cgm/summary/${p10}`);
        const data = await res.json();

        if (data.success && data.summary?.configured) {
          setConfigured(true);
          setCurrentGlucose(data.summary.currentGlucose || null);
          setStats14day(data.summary.stats14day || null);
          setComparison(data.summary.comparison || null);
        }
      } catch {
        // Failed to load
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [session]);

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Portal</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Glucose Data</h1>
              <p className="text-sm text-gray-600">{session.patientName}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {!configured ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">CGM Not Connected</h2>
            <p className="text-gray-600 mb-6">
              Connect your CGM device to see your glucose data here.
            </p>
            <button
              onClick={() => navigate('/patient-portal/cgm-connect', { state: { session } })}
              className="bg-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-cyan-700 transition-colors"
            >
              Connect Your CGM
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <GlucoseTab
              patientPhone={phone10}
              currentGlucose={currentGlucose}
              stats14day={stats14day}
              comparison={comparison}
              viewMode="patient"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientPortalCGMData;
