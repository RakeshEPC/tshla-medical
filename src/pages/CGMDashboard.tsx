import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PanelPatient {
  patientPhone: string;
  patientName: string;
  unifiedPatientId: string;
  dataSource: string;
  connectionStatus: string;
  lastSync: string | null;
  currentGlucose: {
    value: number;
    trend: string;
    minutesAgo: number;
  } | null;
  stats14day: {
    avgGlucose: number;
    timeInRangePercent: number;
    estimatedA1c: number;
    cv: number;
  } | null;
  patternCount: number;
  riskScore: 'high' | 'medium' | 'low';
}

function getGlucoseColor(value: number): string {
  if (value < 54) return '#dc2626';
  if (value < 70) return '#f59e0b';
  if (value <= 180) return '#22c55e';
  if (value <= 250) return '#f59e0b';
  return '#dc2626';
}

function getRiskBadge(risk: string) {
  if (risk === 'high') return { bg: 'bg-red-100 text-red-700', label: 'HIGH' };
  if (risk === 'medium') return { bg: 'bg-amber-100 text-amber-700', label: 'MEDIUM' };
  return { bg: 'bg-green-100 text-green-700', label: 'LOW' };
}

const CGMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PanelPatient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPanel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cgm/panel`);
      const data = await res.json();
      if (data.success) setPatients(data.patients || []);
    } catch (err) {
      console.error('Failed to fetch CGM panel:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanel();
  }, []);

  const phone10 = (phone: string) => phone.replace(/\D/g, '').slice(-10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CGM Patient Panel</h1>
            <p className="text-gray-600 mt-1">Monitor all CGM-connected patients at a glance</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/patient-chart')}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <ArrowLeft className="w-5 h-5" />
              Patient Charts
            </button>
            <button
              onClick={fetchPanel}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Patients</p>
            <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">High Risk</p>
            <p className="text-2xl font-bold text-red-600">
              {patients.filter(p => p.riskScore === 'high').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Medium Risk</p>
            <p className="text-2xl font-bold text-amber-600">
              {patients.filter(p => p.riskScore === 'medium').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Low Risk</p>
            <p className="text-2xl font-bold text-green-600">
              {patients.filter(p => p.riskScore === 'low').length}
            </p>
          </div>
        </div>

        {/* Patient Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading patient data...
            </div>
          ) : patients.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Activity className="w-6 h-6 mr-2" />
              No CGM patients configured
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Current</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">TIR%</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Avg</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">A1C</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">CV%</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Patterns</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Risk</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((patient) => {
                  const risk = getRiskBadge(patient.riskScore);
                  return (
                    <tr
                      key={patient.patientPhone}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patient-chart?patient=${phone10(patient.patientPhone)}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{patient.patientName}</div>
                        <div className="text-xs text-gray-500">{patient.dataSource}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {patient.currentGlucose ? (
                          <div>
                            <span
                              className="text-lg font-bold"
                              style={{ color: getGlucoseColor(patient.currentGlucose.value) }}
                            >
                              {patient.currentGlucose.value}
                            </span>
                            <span className="text-sm ml-1">{patient.currentGlucose.trend}</span>
                            <div className="text-xs text-gray-400">{patient.currentGlucose.minutesAgo}m ago</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {patient.stats14day ? (
                          <span
                            className="font-semibold"
                            style={{
                              color: patient.stats14day.timeInRangePercent >= 70 ? '#22c55e'
                                : patient.stats14day.timeInRangePercent >= 50 ? '#f59e0b'
                                : '#ef4444'
                            }}
                          >
                            {patient.stats14day.timeInRangePercent}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">
                        {patient.stats14day?.avgGlucose || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {patient.stats14day?.estimatedA1c || '-'}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        {patient.stats14day ? (
                          <span style={{ color: patient.stats14day.cv > 36 ? '#ef4444' : '#6b7280' }}>
                            {patient.stats14day.cv}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {patient.patternCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {patient.patternCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${risk.bg}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {patient.lastSync
                          ? new Date(patient.lastSync).toLocaleString([], {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CGMDashboard;
