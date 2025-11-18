/**
 * PCM Provider Dashboard
 * Focused dashboard for providers to manage PCM patients
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Phone,
  Mail,
  FileText,
  ArrowLeft,
  Activity,
  TrendingUp,
  Calendar
} from 'lucide-react';
import PatientRiskCard, { type PCMPatient } from '../components/pcm/PatientRiskCard';
import { pcmService } from '../services/pcm.service';

type SortOption = 'risk' | 'contact' | 'compliance' | 'time';
type FilterOption = 'all' | 'high' | 'medium' | 'low' | 'overdue';

export default function PCMProviderDashboard() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PCMPatient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<PCMPatient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('risk');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedPatient, setSelectedPatient] = useState<PCMPatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [patients, searchTerm, sortBy, filterBy]);

  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const data = await pcmService.getPCMPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...patients];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm)
      );
    }

    // Apply risk filter
    if (filterBy !== 'all') {
      if (filterBy === 'overdue') {
        filtered = filtered.filter(p => new Date(p.nextContactDue) < new Date());
      } else {
        filtered = filtered.filter(p => p.riskLevel === filterBy);
      }
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          const riskOrder = { high: 0, medium: 1, low: 2 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];

        case 'contact':
          return new Date(a.nextContactDue).getTime() - new Date(b.nextContactDue).getTime();

        case 'compliance':
          return a.medicationAdherence - b.medicationAdherence;

        case 'time':
          return a.monthlyMinutesLogged - b.monthlyMinutesLogged;

        default:
          return 0;
      }
    });

    setFilteredPatients(filtered);
  };

  const handleQuickCall = (patient: PCMPatient) => {
    window.location.href = `tel:${patient.phone}`;
  };

  const handleQuickMessage = (patient: PCMPatient) => {
    alert(`Opening secure messaging for ${patient.name}...`);
  };

  const handlePatientClick = (patient: PCMPatient) => {
    setSelectedPatient(patient);
    // In production, navigate to detailed patient view
    // navigate(`/pcm/patient/${patient.id}`);
  };

  const getOverduePatientsCount = () => {
    return patients.filter(p => new Date(p.nextContactDue) < new Date()).length;
  };

  const getHighRiskCount = () => {
    return patients.filter(p => p.riskLevel === 'high').length;
  };

  const getNeedingTimeCount = () => {
    return patients.filter(p => p.monthlyMinutesLogged < 30).length;
  };

  const getAverageCompliance = () => {
    if (patients.length === 0) return 0;
    const total = patients.reduce((sum, p) => sum + p.medicationAdherence, 0);
    return Math.round(total / patients.length);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading PCM patients...</p>
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
                onClick={() => navigate('/doctor-dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PCM Management</h1>
                <p className="text-sm text-gray-600">Principal Care Management Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-600">Total PCM Patients</div>
                <div className="text-2xl font-bold text-blue-600">{patients.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Overdue Contacts */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Overdue Contacts</div>
                <div className="text-3xl font-bold text-red-600">{getOverduePatientsCount()}</div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* High Risk */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">High Risk</div>
                <div className="text-3xl font-bold text-orange-600">{getHighRiskCount()}</div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Needing Time */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Need Time (&lt;30 min)</div>
                <div className="text-3xl font-bold text-yellow-600">{getNeedingTimeCount()}</div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Avg Compliance */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Avg Compliance</div>
                <div className="text-3xl font-bold text-green-600">{getAverageCompliance()}%</div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="risk">Risk Level</option>
                <option value="contact">Contact Due</option>
                <option value="compliance">Compliance</option>
                <option value="time">PCM Time</option>
              </select>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Patients</option>
                <option value="overdue">Overdue</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>
          </div>

          {/* Active Filter Tags */}
          {(searchTerm || filterBy !== 'all') && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchTerm && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  Search: "{searchTerm}"
                </span>
              )}
              {filterBy !== 'all' && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                  {filterBy.charAt(0).toUpperCase() + filterBy.slice(1)}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterBy('all');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Info */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredPatients.length} of {patients.length} patients
        </div>

        {/* Patient Cards Grid */}
        {filteredPatients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No patients found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPatients.map((patient) => (
              <PatientRiskCard
                key={patient.id}
                patient={patient}
                onClick={handlePatientClick}
                onQuickCall={handleQuickCall}
                onQuickMessage={handleQuickMessage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected Patient Detail Modal (simplified for demo) */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">{selectedPatient.name}</h2>
              <p className="text-blue-100">{selectedPatient.age} years old</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickCall(selectedPatient)}
                  className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  <Phone className="w-5 h-5" />
                  Call Patient
                </button>
                <button
                  onClick={() => handleQuickMessage(selectedPatient)}
                  className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  <Mail className="w-5 h-5" />
                  Send Message
                </button>
              </div>

              {/* Patient Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Current A1C</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedPatient.currentA1C}%</div>
                  <div className="text-xs text-gray-500">Target: {selectedPatient.targetA1C}%</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Med Adherence</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedPatient.medicationAdherence}%</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Blood Pressure</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedPatient.currentBP}</div>
                  <div className="text-xs text-gray-500">Target: {selectedPatient.targetBP}</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">PCM Time</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedPatient.monthlyMinutesLogged} min</div>
                  <div className="text-xs text-gray-500">of 30 required</div>
                </div>
              </div>

              {/* Last Notes */}
              {selectedPatient.lastCallNotes && (
                <div className="border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <div className="font-semibold text-gray-900">Last Contact Notes</div>
                  </div>
                  <p className="text-gray-700">{selectedPatient.lastCallNotes}</p>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={() => setSelectedPatient(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
