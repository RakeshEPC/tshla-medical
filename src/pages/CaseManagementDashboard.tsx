import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface CommunicationLog {
  id: string;
  call_sid?: string;
  message_sid?: string;
  communication_type: 'voice' | 'sms' | 'conversation';
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  raw_transcript?: string;
  processed_transcript?: string;
  ai_summary?: string;
  extracted_entities?: any;
  confidence_score?: number;
  status: 'received' | 'processing' | 'processed' | 'reviewed';
  processing_stage?: string;
  needs_review: boolean;
  duration_seconds?: number;
  created_at: string;
  updated_at: string;
}

interface ExtractedAppointment {
  id: string;
  communication_log_id: string;
  patient_name?: string;
  patient_phone?: string;
  patient_dob?: string;
  patient_mrn?: string;
  requested_date?: string;
  requested_time?: string;
  flexible_scheduling: boolean;
  appointment_type?: string;
  reason_for_visit?: string;
  urgency_level: 'emergency' | 'urgent' | 'routine';
  preferred_doctor?: string;
  symptoms?: any;
  medications?: any;
  allergies?: any;
  status: 'extracted' | 'validated' | 'scheduled' | 'rejected';
  validation_status?: string;
  confidence_score?: number;
  scheduled_date?: string;
  created_at: string;
}

interface StaffCase {
  id: string;
  case_number: string;
  case_type:
    | 'appointment_request'
    | 'medical_question'
    | 'prescription_refill'
    | 'insurance_issue'
    | 'emergency'
    | 'technical_issue';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  category?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_mrn?: string;
  assigned_to?: string;
  assigned_department?: 'front_desk' | 'clinical' | 'billing' | 'management';
  status:
    | 'new'
    | 'assigned'
    | 'in_progress'
    | 'waiting_patient'
    | 'waiting_provider'
    | 'resolved'
    | 'closed';
  action_required?: string;
  due_date?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

interface ActionItem {
  id: string;
  communication_log_id?: string;
  staff_case_id?: string;
  action_type:
    | 'call_patient'
    | 'schedule_appointment'
    | 'send_prescription'
    | 'update_records'
    | 'follow_up';
  action_title: string;
  action_description?: string;
  assigned_to?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  context?: any;
  created_at: string;
}

export default function CaseManagementDashboard() {
  const navigate = useNavigate();
  const [currentUser] = useState(unifiedAuthService.getCurrentUser());

  // UI State
  const [activeTab, setActiveTab] = useState<
    'communications' | 'appointments' | 'cases' | 'actions'
  >('cases');
  const [selectedCase, setSelectedCase] = useState<StaffCase | null>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);

  // Data State
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [appointments, setAppointments] = useState<ExtractedAppointment[]>([]);
  const [staffCases, setStaffCases] = useState<StaffCase[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadData();
  }, [currentUser, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Real API calls to our dashboard backend
      const API_BASE = 'http://localhost:9006/api/dashboard';

      // Load real communication logs from database
      const communicationsResponse = await fetch(`${API_BASE}/communications`);
      const communicationsData = await communicationsResponse.json();
      const realCommunications = communicationsData.success ? communicationsData.data : [];

      // Load sample communication logs (fallback if no real data yet)
      const sampleCommunications: CommunicationLog[] =
        realCommunications.length > 0
          ? realCommunications
          : [
              {
                id: '1',
                call_sid: 'CA_sample_001',
                communication_type: 'voice',
                direction: 'inbound',
                from_number: '+15551234567',
                to_number: '+18324027671',
                raw_transcript:
                  'Hi, I need to schedule an appointment with Dr. Smith for next Tuesday around 2 PM. This is John Doe.',
                ai_summary:
                  'Patient John Doe requesting appointment with Dr. Smith for Tuesday 2 PM',
                status: 'processed',
                confidence_score: 0.92,
                needs_review: false,
                duration_seconds: 120,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];

      // Load sample extracted appointments
      const sampleAppointments: ExtractedAppointment[] = [
        {
          id: '1',
          communication_log_id: '1',
          patient_name: 'John Doe',
          patient_phone: '+15551234567',
          requested_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          requested_time: '14:00',
          flexible_scheduling: false,
          appointment_type: 'Follow-up',
          reason_for_visit: 'Routine check-up',
          urgency_level: 'routine',
          preferred_doctor: 'Dr. Smith',
          status: 'extracted',
          confidence_score: 0.89,
          created_at: new Date().toISOString(),
        },
      ];

      // Load sample staff cases
      const sampleCases: StaffCase[] = [
        {
          id: '1',
          case_number: `CASE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`,
          case_type: 'appointment_request',
          title: 'Appointment Request - John Doe',
          description:
            'Patient John Doe called requesting appointment with Dr. Smith for Tuesday 2 PM',
          priority: 'medium',
          patient_name: 'John Doe',
          patient_phone: '+15551234567',
          status: 'new',
          action_required: 'Schedule appointment and confirm with patient',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          case_number: `CASE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0002`,
          case_type: 'prescription_refill',
          title: 'Prescription Refill - Sarah Johnson',
          description: 'Patient needs refill for metformin, running low',
          priority: 'high',
          patient_name: 'Sarah Johnson',
          patient_phone: '+15559876543',
          status: 'assigned',
          assigned_to: 'Clinical Team',
          assigned_department: 'clinical',
          action_required: 'Verify prescription history and process refill',
          due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Load sample action items
      const sampleActions: ActionItem[] = [
        {
          id: '1',
          staff_case_id: '1',
          action_type: 'schedule_appointment',
          action_title: 'Schedule appointment for John Doe',
          action_description: 'Book Tuesday 2 PM slot with Dr. Smith',
          status: 'pending',
          priority: 'medium',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          staff_case_id: '2',
          action_type: 'send_prescription',
          action_title: 'Process metformin refill',
          action_description: 'Send prescription to pharmacy for Sarah Johnson',
          status: 'pending',
          priority: 'high',
          due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      // Load real appointments from API
      const appointmentsResponse = await fetch(`${API_BASE}/appointments`);
      const appointmentsData = await appointmentsResponse.json();
      const realAppointments = appointmentsData.success ? appointmentsData.data : [];

      // Load real staff cases from API
      const casesResponse = await fetch(`${API_BASE}/cases`);
      const casesData = await casesResponse.json();
      const realCases = casesData.success ? casesData.data : [];

      // Load real action items from API
      const actionsResponse = await fetch(`${API_BASE}/actions`);
      const actionsData = await actionsResponse.json();
      const realActions = actionsData.success ? actionsData.data : [];

      logDebug('CaseManagementDashboard', 'Debug message', {});

      setCommunications([...realCommunications, ...sampleCommunications]);
      setAppointments([...realAppointments, ...sampleAppointments]);
      setStaffCases([...realCases, ...sampleCases]);
      setActionItems([...realActions, ...sampleActions]);
    } catch (error) {
      logError('CaseManagementDashboard', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    unifiedAuthService.logout();
    navigate('/login');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'high':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-green-100 text-green-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'waiting_patient':
        return 'bg-purple-100 text-purple-800';
      case 'waiting_provider':
        return 'bg-indigo-100 text-indigo-800';
      case 'resolved':
        return 'bg-gray-100 text-gray-800';
      case 'closed':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredCases = staffCases.filter(case_ => {
    if (priorityFilter !== 'all' && case_.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && case_.status !== statusFilter) return false;
    if (typeFilter !== 'all' && case_.case_type !== typeFilter) return false;
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned' && case_.assigned_to) return false;
      if (assigneeFilter !== 'unassigned' && case_.assigned_to !== assigneeFilter) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading case management data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Case Management Dashboard</h1>
              <span className="ml-4 text-sm text-gray-500">
                AI-Powered Communication Intelligence
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {currentUser?.name}</span>
              <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{communications.length}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Communications</p>
                <p className="text-lg font-semibold text-gray-900">Today</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{appointments.length}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Appointments</p>
                <p className="text-lg font-semibold text-gray-900">Extracted</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {
                      staffCases.filter(c => ['new', 'assigned', 'in_progress'].includes(c.status))
                        .length
                    }
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Cases</p>
                <p className="text-lg font-semibold text-gray-900">Need Attention</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {actionItems.filter(a => a.status === 'pending').length}
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending Actions</p>
                <p className="text-lg font-semibold text-gray-900">To Complete</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'cases', name: 'Staff Cases', count: filteredCases.length },
                { id: 'communications', name: 'Communications', count: communications.length },
                { id: 'appointments', name: 'Appointments', count: appointments.length },
                {
                  id: 'actions',
                  name: 'Action Items',
                  count: actionItems.filter(a => a.status === 'pending').length,
                },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                  {tab.count > 0 && (
                    <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Cases Tab */}
            {activeTab === 'cases' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-4">
                  <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="emergency">Emergency</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_patient">Waiting Patient</option>
                    <option value="waiting_provider">Waiting Provider</option>
                    <option value="resolved">Resolved</option>
                  </select>

                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="appointment_request">Appointment Request</option>
                    <option value="prescription_refill">Prescription Refill</option>
                    <option value="medical_question">Medical Question</option>
                    <option value="insurance_issue">Insurance Issue</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                {/* Cases List */}
                <div className="space-y-3">
                  {filteredCases.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No cases match the current filters</p>
                    </div>
                  ) : (
                    filteredCases.map(case_ => (
                      <div
                        key={case_.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedCase(case_);
                          setShowCaseDetail(true);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm font-mono text-gray-500">
                                {case_.case_number}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(case_.priority)}`}
                              >
                                {case_.priority.toUpperCase()}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(case_.status)}`}
                              >
                                {case_.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {case_.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">{case_.description}</p>
                            <div className="flex items-center text-xs text-gray-500 space-x-4">
                              {case_.patient_name && <span>Patient: {case_.patient_name}</span>}
                              {case_.assigned_to && <span>Assigned: {case_.assigned_to}</span>}
                              <span>Created: {new Date(case_.created_at).toLocaleString()}</span>
                              {case_.due_date && (
                                <span>Due: {new Date(case_.due_date).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          <button
                            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            onClick={e => {
                              e.stopPropagation();
                              // Handle case action
                            }}
                          >
                            Action
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Communications Tab */}
            {activeTab === 'communications' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Recent Communications</h3>
                {communications.map(comm => (
                  <div key={comm.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            comm.communication_type === 'voice'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {comm.communication_type.toUpperCase()}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {comm.direction === 'inbound' ? '→' : '←'} {comm.from_number}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(comm.status)}`}
                      >
                        {comm.status.toUpperCase()}
                      </span>
                    </div>
                    {comm.ai_summary && (
                      <p className="text-sm text-gray-800 mb-2 font-medium">{comm.ai_summary}</p>
                    )}
                    {comm.raw_transcript && (
                      <p className="text-sm text-gray-600 mb-2">"{comm.raw_transcript}"</p>
                    )}
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      {comm.confidence_score && (
                        <span>Confidence: {(comm.confidence_score * 100).toFixed(0)}%</span>
                      )}
                      {comm.duration_seconds && <span>Duration: {comm.duration_seconds}s</span>}
                      <span>Received: {new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other tabs would be implemented similarly */}
            {activeTab === 'appointments' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Extracted Appointments</h3>
                <p className="text-gray-600">Appointment extraction interface coming soon...</p>
              </div>
            )}

            {activeTab === 'actions' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Pending Action Items</h3>
                <p className="text-gray-600">Action items management interface coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case Detail Modal */}
      {showCaseDetail && selectedCase && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedCase.title}</h2>
                <p className="text-sm font-mono text-gray-500">{selectedCase.case_number}</p>
              </div>
              <button
                onClick={() => setShowCaseDetail(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium border ${getPriorityColor(selectedCase.priority)}`}
                  >
                    {selectedCase.priority.toUpperCase()}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${getStatusColor(selectedCase.status)}`}
                  >
                    {selectedCase.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                  {selectedCase.description}
                </p>
              </div>

              {selectedCase.patient_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Information
                  </label>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-900">{selectedCase.patient_name}</p>
                    {selectedCase.patient_phone && (
                      <p className="text-sm text-gray-600">{selectedCase.patient_phone}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedCase.action_required && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action Required
                  </label>
                  <p className="text-sm text-gray-900 bg-yellow-50 p-3 rounded border border-yellow-200">
                    {selectedCase.action_required}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(selectedCase.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Updated:</span>{' '}
                  {new Date(selectedCase.updated_at).toLocaleString()}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowCaseDetail(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  Assign to Me
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
