/**
 * Staff Workflow Dashboard - Main interface for staff members
 * Provides patient management, chart creation, calendar, and action items
 */

import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { chartService } from '../services/chart.service';
import { actionExtractionService } from '../services/actionExtraction.service';
import { auditService } from '../services/audit.service';
import { patientService } from '../services/patient.service';
import { noteActionsService } from '../services/noteActions.service';
import { simpleAppointmentService } from '../services/simpleAppointment.service';
import { ScheduleImporter } from '../components/ScheduleImporter';
import ScheduleImportModal from '../components/ScheduleImportModal';
import type { 
  Chart, 
  ActionItem, 
  AuditLog,
  Appointment
} from '../types/clinic.types';
import type { Patient } from '../types/patient.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function StaffWorkflowDashboard() {
  const navigate = useNavigate();
  
  // Auth state
  const [currentUser] = useState(unifiedAuthService.getCurrentUser());
  const [permissions] = useState(unifiedAuthService.getPermissions());
  
  // UI state
  const [activeTab, setActiveTab] = useState<'patients' | 'charts' | 'calendar' | 'actions' | 'import'>('patients');
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [showCreateChart, setShowCreateChart] = useState(false);
  const [showOldNotes, setShowOldNotes] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<'week' | 'day' | 'list'>('list'); // Default to list view for many appointments
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAllAppointments, setShowAllAppointments] = useState(true); // Show all by default
  
  // Data state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [actionTab, setActionTab] = useState<'medications' | 'labs'>('medications');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>(new Map());
  
  // Doctor list for dropdown - must match IDs used in scheduleImport.service
  const doctors = [
    { id: 'all', name: 'All Doctors', email: 'all' },
    { id: 'doc_adeleke', name: 'Dr. Adenike Adeleke', email: 'adeleke@tshla.ai' },
    { id: 'doc_radha', name: 'Dr. Radha Bernander', email: 'radha@tshla.ai' },
    { id: 'doc_tess', name: 'Dr. Tess Chamakkala', email: 'tess@tshla.ai' },
    { id: 'doc_shannon', name: 'Dr. Shannon Gregorek', email: 'shannon@tshla.ai' },
    { id: 'doc_vanessa', name: 'Dr. Cindy Laverde', email: 'vanessa@tshla.ai' },
    { id: 'doc_elizabeth', name: 'Dr. Elizabeth Leal', email: 'elizabeth@tshla.ai' },
    { id: 'doc_ogechi', name: 'Dr. Ogechi Nebeolisa', email: 'ogechi@tshla.ai' },
    { id: 'doc_neha', name: 'Dr. Neha Patel', email: 'neha@tshla.ai' },
    { id: 'doc_rakesh_patel', name: 'Dr. Rakesh Patel', email: 'rakesh.patel@tshla.ai' },
    { id: 'doc_kruti', name: 'Dr. Kruti Patel-Konasagar', email: 'kruti@tshla.ai' },
    { id: 'doc_preeya', name: 'Dr. Preeya Raghu', email: 'preeya@tshla.ai' },
    { id: 'doc_elina', name: 'Dr. Elina Shakya', email: 'elina@tshla.ai' },
    { id: 'doc_dilnavaz', name: 'Dr. Dilnavaz Subawalla', email: 'dilnavaz@tshla.ai' },
    { id: 'doc_ghislaine', name: 'Dr. Ghislaine Tonye', email: 'ghislaine@tshla.ai' },
    { id: 'doc_kamili', name: 'Dr. Kamili Wade-Reescano', email: 'kamili@tshla.ai' },
    { id: 'doc_veena', name: 'Dr. Veena Watwe', email: 'veena@tshla.ai' },
    { id: 'doc_nadia', name: 'Dr. Nadia Younus', email: 'nadia@tshla.ai' }
  ];
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    patients: Patient[];
    charts: Chart[];
  }>({ patients: [], charts: [] });
  
  // Form state
  const [patientForm, setPatientForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phone: '',
    email: ''
  });
  
  const [oldNotesForm, setOldNotesForm] = useState({
    chartId: '',
    notes: ''
  });
  
  // Check permissions on mount
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    loadData();
    
    // Log dashboard access
    auditService.log('view', 'patient', undefined, { dashboard: 'staff-workflow' });
  }, [currentUser, navigate]);
  
  // Listen for appointment updates
  useEffect(() => {
    const handleAppointmentUpdate = () => {
      // Refresh calendar data
      const weekData = simpleAppointmentService.getCalendarData(currentWeek, selectedDoctor === 'all' ? undefined : selectedDoctor);
      setCalendarData(weekData);
    };
    
    window.addEventListener('appointmentsUpdated', handleAppointmentUpdate);
    return () => window.removeEventListener('appointmentsUpdated', handleAppointmentUpdate);
  }, [currentWeek, selectedDoctor]);
  
  // Load initial data
  const loadData = async () => {
    try {
      // Load recent audit logs
      const logs = await auditService.getAuditLogs({ limit: 10 });
      setRecentActivity(logs);
      
      // Load pending actions
      const actions = noteActionsService.getPendingActions();
      setActionItems(actions);
      
      // Load appointments
      const appts = simpleAppointmentService.getAppointments({ weekOf: new Date() });
      setAppointments(appts);
    } catch (error) {
      logError('StaffWorkflowDashboard', 'Error message', {});
    }
  };
  
  // Handle patient creation
  const handleCreatePatient = async () => {
    try {
      // Validate required fields (at least one)
      if (!patientForm.firstName && !patientForm.lastName && !patientForm.email) {
        alert('Please provide at least one field (name or email)');
        return;
      }
      
      // Register patient
      const patient = await patientService.registerPatient({
        firstName: patientForm.firstName,
        lastName: patientForm.lastName,
        dateOfBirth: patientForm.dateOfBirth,
        phone: patientForm.phone,
        email: patientForm.email || `patient${Date.now()}@tshla.ai`,
        program: 'pumpdrive'
      });
      
      // Log creation
      await auditService.logCreate('patient', patient.internalId, {
        name: `${patient.firstName} ${patient.lastName}`,
        avaId: patient.patientAvaId
      });
      
      // Update UI
      setPatients([...patients, patient]);
      setSelectedPatient(patient);
      setShowCreatePatient(false);
      
      // Reset form
      setPatientForm({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        phone: '',
        email: ''
      });
      
      alert(`Patient created!\nAVA ID: ${patient.patientAvaId}\n\nYou can now create a chart for this patient.`);
      
    } catch (error) {
      logError('StaffWorkflowDashboard', 'Error message', {});
      alert('Failed to create patient');
    }
  };
  
  // Handle chart creation
  const handleCreateChart = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }
    
    try {
      const result = await chartService.createChart({
        patientId: selectedPatient.internalId,
        clinicId: 'default'
      });
      
      // Log creation
      await auditService.logCreate('chart', result.chart.id, {
        patientId: selectedPatient.internalId,
        avaId: result.avaId,
        tshId: result.tshId
      });
      
      // Update UI
      setCharts([...charts, result.chart]);
      setShowCreateChart(false);
      
      alert(`Chart created successfully!\n\nAVA ID (Patient Portal): ${result.avaId}\nTSH ID (EMR/Doctor): ${result.tshId}\n\nThese IDs have been saved.`);
      
    } catch (error) {
      logError('StaffWorkflowDashboard', 'Error message', {});
      alert('Failed to create chart');
    }
  };
  
  // Handle adding old notes
  const handleAddOldNotes = async () => {
    if (!oldNotesForm.chartId || !oldNotesForm.notes) {
      alert('Please select a chart and enter notes');
      return;
    }
    
    try {
      await chartService.addOldNotes(oldNotesForm.chartId, oldNotesForm.notes);
      
      // Log the action
      await auditService.log('update', 'chart', oldNotesForm.chartId, {
        action: 'added_old_notes',
        notesLength: oldNotesForm.notes.length
      });
      
      // Reset form
      setOldNotesForm({ chartId: '', notes: '' });
      setShowOldNotes(false);
      
      alert('Old notes added successfully');
      
    } catch (error) {
      logError('StaffWorkflowDashboard', 'Error message', {});
      alert('Failed to add old notes');
    }
  };
  
  // Handle search
  const handleSearch = async () => {
    if (!searchQuery) {
      setSearchResults({ patients: [], charts: [] });
      return;
    }
    
    // Search patients
    const patientResults = patients.filter(p => 
      p.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientAvaId?.includes(searchQuery)
    );
    
    // Search charts
    const chartResults = await chartService.searchCharts(searchQuery);
    
    setSearchResults({
      patients: patientResults,
      charts: chartResults
    });
  };
  
  // Handle logout
  const handleLogout = () => {
    auditService.logLogout();
    unifiedAuthService.logout();
    navigate('/login');
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Staff Workflow Dashboard
              </h1>
              <span className="ml-4 text-sm text-gray-500">
                {currentUser?.name} ({currentUser?.role})
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('patients')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'patients'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Patients
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'charts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Charts
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'actions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Action Items
              {noteActionsService.getPendingCount() > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                  {noteActionsService.getPendingCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Import Schedule
            </button>
          </nav>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search patients by name, email, AVA ID, or TSH ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </div>
          
          {/* Search Results */}
          {(searchResults.patients.length > 0 || searchResults.charts.length > 0) && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Search Results</h3>
              {searchResults.patients.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Patients:</h4>
                  {searchResults.patients.map(p => (
                    <div key={p.internalId} className="text-sm text-gray-600">
                      {p.firstName} {p.lastName} - AVA: {p.patientAvaId}
                    </div>
                  ))}
                </div>
              )}
              {searchResults.charts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Charts:</h4>
                  {searchResults.charts.map(c => (
                    <div key={c.id} className="text-sm text-gray-600">
                      AVA: {c.avaId} | TSH: {c.tshId}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Patients Tab */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Patients</h2>
              <button
                onClick={() => setShowCreatePatient(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                + New Patient
              </button>
            </div>
            
            {/* Instructions Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to Get Started</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Click "New Patient" to create a patient (not all fields required)</li>
                <li>After creating a patient, you'll receive their AVA ID</li>
                <li>Click "Create Chart" to generate both AVA and TSH IDs</li>
                <li>Use TSH ID for EMR/doctor access, AVA ID for patient portal</li>
              </ol>
            </div>
            
            {/* Patient List */}
            {patients.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {patients.map((patient) => (
                    <li key={patient.internalId}>
                      <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                           onClick={() => setSelectedPatient(patient)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              AVA: {patient.patientAvaId} | Email: {patient.email}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPatient(patient);
                              setShowCreateChart(true);
                            }}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Create Chart
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 mb-4">No patients yet</p>
                <button
                  onClick={() => setShowCreatePatient(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create Your First Patient
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Charts</h2>
              <button
                onClick={() => setShowOldNotes(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={charts.length === 0}
              >
                + Add Old Notes
              </button>
            </div>
            
            {/* ID Explanation */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2">Understanding Chart IDs</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li><strong>AVA ID:</strong> For patient portal access (cross-clinic)</li>
                <li><strong>TSH ID:</strong> For EMR/doctor use (clinic-specific)</li>
              </ul>
            </div>
            
            {/* Charts List */}
            {charts.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {charts.map((chart) => (
                    <li key={chart.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Chart ID: {chart.id}
                            </p>
                            <p className="text-sm text-blue-600 font-medium">
                              AVA: {chart.avaId}
                            </p>
                            <p className="text-sm text-green-600 font-medium">
                              TSH: {chart.tshId}
                            </p>
                            <p className="text-xs text-gray-400">
                              Created: {new Date(chart.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">No charts created yet</p>
                <p className="text-sm text-gray-400 mt-2">Create a patient first, then create their chart</p>
              </div>
            )}
          </div>
        )}
        
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {/* Doctor Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Calendar</h2>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">View calendar for:</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Calendar View */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Calendar Header */}
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-sm font-medium text-gray-900">
                      {selectedDoctor === 'all' 
                        ? 'All Doctors - Combined Schedule'
                        : `${doctors.find(d => d.id === selectedDoctor)?.name}'s Schedule`
                      }
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const newWeek = new Date(currentWeek);
                          newWeek.setDate(newWeek.getDate() - 7);
                          setCurrentWeek(newWeek);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-sm text-gray-600">
                        Week of {new Date(currentWeek).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          const newWeek = new Date(currentWeek);
                          newWeek.setDate(newWeek.getDate() + 7);
                          setCurrentWeek(newWeek);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {simpleAppointmentService.getAppointmentCount(selectedDoctor === 'all' ? undefined : selectedDoctor)} total appointments
                    </span>
                    
                    {/* View selector */}
                    <select
                      value={calendarView}
                      onChange={(e) => setCalendarView(e.target.value as 'week' | 'day' | 'list')}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      <option value="week">Week View</option>
                      <option value="day">Day View</option>
                      <option value="list">List View</option>
                    </select>
                    
                    {/* Show All toggle */}
                    <label className="flex items-center space-x-1 text-sm">
                      <input
                        type="checkbox"
                        checked={showAllAppointments}
                        onChange={(e) => setShowAllAppointments(e.target.checked)}
                        className="rounded"
                      />
                      <span>Show All</span>
                    </label>
                    
                    {/* Date picker */}
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setSelectedDate(newDate);
                        setCurrentWeek(newDate);
                        setShowAllAppointments(false); // Turn off show all when selecting a date
                      }}
                      className="px-2 py-1 text-sm border rounded"
                      disabled={showAllAppointments}
                    />
                    
                    <button 
                      onClick={() => setShowImportModal(true)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      📥 Import Schedule
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to clear ALL appointments? This cannot be undone.')) {
                          simpleAppointmentService.clearAllAppointments();
                          window.location.reload(); // Refresh to show empty calendar
                        }
                      }}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      🗑️ Clear All
                    </button>
                    <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                      Add Appointment
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Calendar Views */}
              {calendarView === 'list' ? (
                // List View for handling many appointments
                <div className="p-6">
                  <div className="space-y-2">
                    {(() => {
                      // Get all appointments for selected date or week
                      const startDate = showAllAppointments ? new Date('2000-01-01') : (() => {
                        const week = new Date(currentWeek);
                        const day = week.getDay();
                        week.setDate(week.getDate() - day + (day === 0 ? -6 : 1));
                        return week;
                      })();
                      
                      const endDate = showAllAppointments ? new Date('2100-01-01') : (() => {
                        const week = new Date(startDate);
                        week.setDate(week.getDate() + 6);
                        return week;
                      })();
                      
                      // Get ALL appointments first to debug
                      const allAppointments = simpleAppointmentService.getAppointments();
                      logDebug('StaffWorkflowDashboard', 'Debug message', {});
                      logDebug('StaffWorkflowDashboard', 'Debug message', {});
                      if (allAppointments.length > 0) {
                        const appointmentSummary = allAppointments.map(a => ({
                          date: a.date,
                          patient: a.patientName,
                          doctorId: a.doctorId,
                          doctorName: a.doctorName
                        }));
                        
                        // Count appointments per doctor
                        const doctorCounts = allAppointments.reduce((acc, appt) => {
                          acc[appt.doctorId] = (acc[appt.doctorId] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        logDebug('StaffWorkflowDashboard', 'Debug message', {});
                      }
                      
                      // Debug date range
                      logDebug('StaffWorkflowDashboard', 'Debug message', {}, { endDate: endDate.toISOString(),
                        selectedDate: selectedDate.toISOString(),
                        calendarView
                      });
                      
                      // Get appointments within date range
                      const appointments = allAppointments
                        .filter(appt => {
                          if (selectedDoctor !== 'all' && appt.doctorId !== selectedDoctor) return false;
                          
                          // Parse appointment date more carefully
                          let apptDate;
                          if (appt.date.includes('/')) {
                            // Handle MM/DD/YYYY format
                            const [month, day, year] = appt.date.split('/');
                            apptDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                          } else {
                            apptDate = new Date(appt.date);
                          }
                          
                          // Check if date is valid
                          if (isNaN(apptDate.getTime())) {
                            logDebug('StaffWorkflowDashboard', 'Debug message', {});
                            return false;
                          }
                          
                          // Show all appointments if checkbox is checked
                          if (showAllAppointments) {
                            return true;
                          }
                          
                          // Otherwise filter by date range
                          return apptDate >= startDate && apptDate <= endDate;
                        })
                        .sort((a, b) => {
                          const dateA = a.date.includes('/') ? 
                            (() => {
                              const [m, d, y] = a.date.split('/');
                              return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
                            })() : new Date(a.date);
                          const dateB = b.date.includes('/') ? 
                            (() => {
                              const [m, d, y] = b.date.split('/');
                              return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
                            })() : new Date(b.date);
                          
                          const dateCompare = dateA.getTime() - dateB.getTime();
                          if (dateCompare !== 0) return dateCompare;
                          
                          // Sort by time within same date
                          const timeA = new Date(`2000-01-01 ${a.time}`).getTime();
                          const timeB = new Date(`2000-01-01 ${b.time}`).getTime();
                          return timeA - timeB;
                        });
                      
                      logDebug('StaffWorkflowDashboard', 'Debug message', {});
                      logDebug('StaffWorkflowDashboard', 'Debug message', {});
                      logDebug('StaffWorkflowDashboard', 'Debug message', {});
                      
                      if (appointments.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <p>No appointments found for the selected period</p>
                            <p className="text-sm mt-2">Total appointments in system: {allAppointments.length}</p>
                            {!showAllAppointments && allAppointments.length > 0 && (
                              <p className="text-sm mt-1">Try checking "Show All" to see all appointments</p>
                            )}
                          </div>
                        );
                      }
                      
                      // Group by date
                      const groupedByDate = appointments.reduce((acc, appt) => {
                        const dateKey = appt.date;
                        if (!acc[dateKey]) acc[dateKey] = [];
                        acc[dateKey].push(appt);
                        return acc;
                      }, {} as Record<string, typeof appointments>);
                      
                      return Object.entries(groupedByDate).map(([date, dayAppts]) => (
                        <div key={date} className="border rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-3">
                            {new Date(date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                            <span className="ml-2 text-sm text-gray-500">
                              ({dayAppts.length} appointments)
                            </span>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {dayAppts.map(appt => (
                              <div 
                                key={appt.id}
                                className={`p-2 rounded border ${simpleAppointmentService.getDoctorColor(appt.doctorId)}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-medium">{appt.time}</div>
                                    <div className="text-sm">{appt.patientName}</div>
                                    <div className="text-xs text-gray-600">{appt.doctorName}</div>
                                    <div className="text-xs text-gray-500">{appt.visitType}</div>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    ID: {appt.patientId}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ) : calendarView === 'day' ? (
                // Day View
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-0 border-t border-l">
                    {/* Time Column */}
                    <div className="border-r border-b bg-gray-50">
                      <div className="h-12 flex items-center justify-center text-xs font-medium text-gray-500">
                        Time
                      </div>
                    </div>
                    
                    {/* Day Header */}
                    <div className="border-r border-b bg-gray-50">
                      <div className="h-12 flex items-center justify-center text-xs font-medium text-gray-900">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                    
                    {/* Time Slots */}
                    {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'].map(time => {
                      // Get appointments for this time slot
                      const calendarData = simpleAppointmentService.getCalendarData(selectedDate, selectedDoctor === 'all' ? undefined : selectedDoctor);
                      const timeSlotData = calendarData.get(time);
                      const dateStr = selectedDate.toISOString().split('T')[0];
                      const dayAppointments = timeSlotData?.get(dateStr) || [];
                      
                      return (
                        <React.Fragment key={time}>
                          <div className="border-r border-b bg-gray-50">
                            <div className="h-20 px-2 py-1 text-xs text-gray-500">
                              {time}
                            </div>
                          </div>
                          <div className="border-r border-b hover:bg-blue-50 cursor-pointer relative">
                            <div className="h-20 p-1 overflow-y-auto">
                              {dayAppointments.map((appt, idx) => (
                                <div 
                                  key={appt.id} 
                                  className={`${simpleAppointmentService.getDoctorColor(appt.doctorId)} text-xs p-1 rounded border mb-1`}
                                  title={`${appt.patientName}\n${appt.visitReason}\n${appt.notes || ''}`}
                                >
                                  {selectedDoctor === 'all' && (
                                    <div className="font-semibold truncate">{appt.doctorName}</div>
                                  )}
                                  <div className="truncate">{appt.patientName}</div>
                                  <div className="text-xs opacity-75 truncate">{appt.visitType}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : (
              // Week View (original)
              <div className="p-6">
                <div className="grid grid-cols-8 gap-0 border-t border-l">
                  {/* Time Column */}
                  <div className="border-r border-b bg-gray-50">
                    <div className="h-12 flex items-center justify-center text-xs font-medium text-gray-500">
                      Time
                    </div>
                  </div>
                  
                  {/* Day Headers */}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="border-r border-b bg-gray-50">
                      <div className="h-12 flex items-center justify-center text-xs font-medium text-gray-900">
                        {day}
                      </div>
                    </div>
                  ))}
                  
                  {/* Time Slots */}
                  {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'].map(time => {
                    // Get appointments for this time slot
                    const calendarData = simpleAppointmentService.getCalendarData(currentWeek, selectedDoctor === 'all' ? undefined : selectedDoctor);
                    const timeSlotData = calendarData.get(time);
                    const weekDates = Array.from({ length: 7 }, (_, i) => {
                      const date = new Date(currentWeek);
                      const day = date.getDay();
                      const diff = date.getDate() - day + (day === 0 ? -6 : 1) + i;
                      date.setDate(diff);
                      return date.toISOString().split('T')[0];
                    });
                    
                    return (
                      <React.Fragment key={time}>
                        <div className="border-r border-b bg-gray-50">
                          <div className="h-20 px-2 py-1 text-xs text-gray-500">
                            {time}
                          </div>
                        </div>
                        {weekDates.map((dateStr, dayIndex) => {
                          const dayAppointments = timeSlotData?.get(dateStr) || [];
                          
                          return (
                            <div key={`${time}-${dayIndex}`} className="border-r border-b hover:bg-blue-50 cursor-pointer relative">
                              <div className="h-20 p-1 overflow-hidden">
                                {dayAppointments.map((appt, idx) => (
                                  <div 
                                    key={appt.id} 
                                    className={`${simpleAppointmentService.getDoctorColor(appt.doctorId)} text-xs p-1 rounded border mb-1`}
                                    title={`${appt.patientName}\n${appt.visitReason}\n${appt.notes || ''}`}
                                  >
                                    {selectedDoctor === 'all' && (
                                      <div className="font-semibold truncate">{appt.doctorName}</div>
                                    )}
                                    <div className="truncate">{appt.patientName}</div>
                                    <div className="text-xs opacity-75 truncate">{appt.visitType}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              )}
              
              {/* Legend */}
              <div className="px-6 py-3 bg-gray-50 border-t">
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-100 rounded mr-1"></div>
                    <span>Dr. Patel</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-purple-100 rounded mr-1"></div>
                    <span>Dr. Watwe</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-100 rounded mr-1"></div>
                    <span>Dr. Chamakkala</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-100 rounded mr-1"></div>
                    <span>Dr. Bernander</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-100 rounded mr-1"></div>
                    <span>Dr. Gregroek</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-orange-100 rounded mr-1"></div>
                    <span>Dr. Shakya</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Action Items Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Header with Doctor Filter */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Action Items from Dictation</h2>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Filter by doctor:</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => {
                    setSelectedDoctor(e.target.value);
                    const filtered = noteActionsService.getPendingActions(
                      e.target.value === 'all' ? undefined : { doctorId: e.target.value }
                    );
                    setActionItems(filtered);
                  }}
                  className="px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Medication/Lab Tabs */}
            <div className="bg-white rounded-lg shadow">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                  <button
                    onClick={() => setActionTab('medications')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${
                      actionTab === 'medications'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Medications
                    {noteActionsService.getPendingCount('medication') > 0 && (
                      <span className="ml-2 bg-indigo-100 text-indigo-600 text-xs rounded-full px-2 py-0.5">
                        {noteActionsService.getPendingCount('medication')}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActionTab('labs')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${
                      actionTab === 'labs'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Lab Orders
                    {noteActionsService.getPendingCount('lab') > 0 && (
                      <span className="ml-2 bg-indigo-100 text-indigo-600 text-xs rounded-full px-2 py-0.5">
                        {noteActionsService.getPendingCount('lab')}
                      </span>
                    )}
                  </button>
                </nav>
              </div>
              
              {/* Action Items List */}
              <div className="p-6">
                {actionTab === 'medications' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                      Medication Orders to Process
                    </h3>
                    {actionItems.filter(a => a.itemType === 'medication').length === 0 ? (
                      <p className="text-gray-500 text-sm">No pending medication orders</p>
                    ) : (
                      <div className="space-y-3">
                        {actionItems.filter(a => a.itemType === 'medication').map((item) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {item.details?.action || 'Action'}
                                  </span>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {item.action}
                                  </p>
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  <p>Patient: <span className="font-medium">{item.patientName}</span></p>
                                  <p>Doctor: <span className="font-medium">{item.doctorName}</span></p>
                                  <p>Extracted: {new Date(item.dateExtracted).toLocaleString()}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (noteActionsService.processAction(item.id, currentUser?.name || 'Staff')) {
                                    // Reload actions
                                    const updated = noteActionsService.getPendingActions(
                                      selectedDoctor === 'all' ? undefined : { doctorId: selectedDoctor }
                                    );
                                    setActionItems(updated);
                                  }
                                }}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Process
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {actionTab === 'labs' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                      Lab Orders to Process
                    </h3>
                    {actionItems.filter(a => a.itemType === 'lab').length === 0 ? (
                      <p className="text-gray-500 text-sm">No pending lab orders</p>
                    ) : (
                      <div className="space-y-3">
                        {actionItems.filter(a => a.itemType === 'lab').map((item) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Lab Order
                                  </span>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {item.action}
                                  </p>
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  <p>Patient: <span className="font-medium">{item.patientName}</span></p>
                                  <p>Doctor: <span className="font-medium">{item.doctorName}</span></p>
                                  <p>Extracted: {new Date(item.dateExtracted).toLocaleString()}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (noteActionsService.processAction(item.id, currentUser?.name || 'Staff')) {
                                    // Reload actions
                                    const updated = noteActionsService.getPendingActions(
                                      selectedDoctor === 'all' ? undefined : { doctorId: selectedDoctor }
                                    );
                                    setActionItems(updated);
                                  }
                                }}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Process
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Test Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Action Management</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Actions are automatically extracted from doctor's dictation notes during appointments.
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={async () => {
                          // Clear and regenerate with real patient data
                          await noteActionsService.regenerateWithRealData();
                          
                          // Reload actions
                          const updated = noteActionsService.getPendingActions(
                            selectedDoctor === 'all' ? undefined : { doctorId: selectedDoctor }
                          );
                          setActionItems(updated);
                          
                          alert('Actions regenerated with real patient appointment data!');
                        }}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Load Real Patient Actions
                      </button>
                      <button
                        onClick={async () => {
                          const testText = "Start metformin 500mg BID. Increase lisinopril to 20mg daily. Stop atorvastatin. Order A1C, CMP, and lipid panel.";
                          
                          // Get a real appointment to link to
                          const appointments = simpleAppointmentService.getAppointments({ weekOf: new Date() });
                          const randomAppt = appointments[Math.floor(Math.random() * appointments.length)];
                          
                          if (randomAppt) {
                            const extracted = await noteActionsService.extractAndSaveActions(
                              testText,
                              randomAppt.patientId,
                              randomAppt.patientName,
                              randomAppt.doctorId,
                              randomAppt.doctorName
                            );
                            
                            // Reload actions
                            const updated = noteActionsService.getPendingActions(
                              selectedDoctor === 'all' ? undefined : { doctorId: selectedDoctor }
                            );
                            setActionItems(updated);
                            
                            alert(`Extracted ${extracted.length} action items for ${randomAppt.patientName}!`);
                          }
                        }}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Add Test Dictation
                      </button>
                      <button
                        onClick={() => {
                          noteActionsService.clearAllActions();
                          setActionItems([]);
                          alert('All actions cleared!');
                        }}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Import Schedule Tab */}
        {activeTab === 'import' && (
          <div className="max-w-4xl mx-auto">
            <ScheduleImporter />
          </div>
        )}
      </div>
      
      {/* Create Patient Modal */}
      {showCreatePatient && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Patient</h3>
            <p className="text-sm text-gray-600 mb-4">Not all fields are required - provide what you have</p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="First Name (optional)"
                value={patientForm.firstName}
                onChange={(e) => setPatientForm({...patientForm, firstName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                placeholder="Last Name (optional)"
                value={patientForm.lastName}
                onChange={(e) => setPatientForm({...patientForm, lastName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="date"
                placeholder="Date of Birth"
                value={patientForm.dateOfBirth}
                onChange={(e) => setPatientForm({...patientForm, dateOfBirth: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={patientForm.phone}
                onChange={(e) => setPatientForm({...patientForm, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={patientForm.email}
                onChange={(e) => setPatientForm({...patientForm, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreatePatient(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePatient}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Create Patient
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Chart Modal */}
      {showCreateChart && selectedPatient && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Chart</h3>
            <p className="text-sm text-gray-600 mb-2">
              Creating chart for: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Current AVA ID: <strong>{selectedPatient.patientAvaId}</strong>
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6">
              <p className="text-sm text-blue-700">
                This will generate a new TSH ID for EMR use while keeping the existing AVA ID for patient portal access.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateChart(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChart}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Create Chart
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Old Notes Modal */}
      {showOldNotes && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Old Notes to Chart</h3>
            <div className="space-y-4">
              <select
                value={oldNotesForm.chartId}
                onChange={(e) => setOldNotesForm({...oldNotesForm, chartId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a chart...</option>
                {charts.map(chart => (
                  <option key={chart.id} value={chart.id}>
                    AVA: {chart.avaId} | TSH: {chart.tshId}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Paste old notes here..."
                value={oldNotesForm.notes}
                onChange={(e) => setOldNotesForm({...oldNotesForm, notes: e.target.value})}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowOldNotes(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOldNotes}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add Notes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Schedule Import Modal */}
      <ScheduleImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          // Refresh calendar data
          const weekData = simpleAppointmentService.getCalendarData(currentWeek, selectedDoctor === 'all' ? undefined : selectedDoctor);
          setCalendarData(weekData);
          // Refresh appointments
          loadData();
        }}
      />
      
      {/* Recent Activity Sidebar */}
      <div className="fixed right-0 top-16 w-64 h-screen bg-white border-l p-4 overflow-y-auto">
        <h3 className="font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((log) => (
              <div key={log.id} className="text-xs text-gray-600 pb-2 border-b">
                <p className="font-medium text-gray-800">
                  {log.action} - {log.entityType}
                </p>
                <p className="text-gray-600">{log.actorName || log.actorId}</p>
                <p className="text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}