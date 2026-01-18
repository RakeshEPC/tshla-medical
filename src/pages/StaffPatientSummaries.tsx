/**
 * Staff Patient Summaries Dashboard
 * Centralized view of all patient audio summaries across all providers
 * Shows pending summaries, allows copying links, and tracking sent status
 *
 * Created: 2026-01-13
 * Access: All staff (providers, nurses, virtual assistants)
 */

import { useState, useEffect } from 'react';
import {
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Phone,
  Calendar,
  User,
  CheckCheck,
  X,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/unified-theme.css';

interface PatientSummary {
  id: string;
  share_link_id: string;
  share_link_url: string;
  patient_name: string;
  patient_phone: string;
  patient_mrn: string;
  tshla_id: string;
  patient_id: string;
  athena_mrn: string;
  provider_name: string;
  provider_id: string;
  created_at: string;
  expires_at: string;
  access_count: number;
  last_accessed_at: string | null;
  staff_sent_at: string | null;
  staff_sent_by: string | null;
  status: 'pending' | 'sent' | 'accessed' | 'expired';
  summary_script: string;
  followup_date: string | null;
  followup_notes: string | null;
  appointment_made: boolean;
  appointment_made_at: string | null;
  appointment_made_by: string | null;
}

export default function StaffPatientSummaries() {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // State
  const [summaries, setSummaries] = useState<PatientSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<PatientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // UI state
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [selectedSummaries, setSelectedSummaries] = useState<Set<string>>(new Set());

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [summaryToDelete, setSummaryToDelete] = useState<PatientSummary | null>(null);
  const [confirmPatientName, setConfirmPatientName] = useState('');
  const [deleteReason, setDeleteReason] = useState<'wrong_chart' | 'duplicate' | 'test' | 'other'>('wrong_chart');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Load summaries from backend
   */
  const loadSummaries = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Calculate date range based on filter
      let startDate = null;
      if (dateFilter === '24hours') {
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === '7days') {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === '30days') {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`${API_BASE_URL}/api/staff/pending-summaries?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to load summaries: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSummaries(data.data);
        setFilteredSummaries(data.data);
      } else {
        throw new Error(data.error || 'Failed to load summaries');
      }

    } catch (err: any) {
      console.error('Error loading summaries:', err);
      setError(err.message || 'Failed to load summaries');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Apply filters
   */
  useEffect(() => {
    let filtered = summaries;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.patient_name?.toLowerCase().includes(query) ||
        s.patient_phone?.includes(query) ||
        s.tshla_id?.toLowerCase().includes(query) ||
        s.patient_mrn?.toLowerCase().includes(query) ||
        s.athena_mrn?.toLowerCase().includes(query)
      );
    }

    // Apply provider filter
    if (providerFilter !== 'all') {
      filtered = filtered.filter(s => s.provider_id === providerFilter);
    }

    setFilteredSummaries(filtered);
  }, [searchQuery, providerFilter, summaries]);

  /**
   * Load summaries on mount and when filters change
   */
  useEffect(() => {
    loadSummaries();
  }, [statusFilter, dateFilter]);

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(`${type}`);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  /**
   * Mark summary as sent
   */
  const markAsSent = async (summaryId: string) => {
    try {
      // Get current staff user ID (from session storage or auth)
      const staffData = sessionStorage.getItem('tshla_medical_user');
      const staffId = staffData ? JSON.parse(staffData).id : null;

      const response = await fetch(`${API_BASE_URL}/api/staff/summaries/${summaryId}/mark-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId })
      });

      if (!response.ok) {
        throw new Error('Failed to mark as sent');
      }

      // Reload summaries
      await loadSummaries();

    } catch (err: any) {
      console.error('Error marking as sent:', err);
      alert(`Failed to mark as sent: ${err.message}`);
    }
  };

  /**
   * Bulk mark as sent
   */
  const bulkMarkAsSent = async () => {
    if (selectedSummaries.size === 0) {
      alert('Please select summaries to mark as sent');
      return;
    }

    if (!confirm(`Mark ${selectedSummaries.size} summaries as sent?`)) {
      return;
    }

    for (const summaryId of selectedSummaries) {
      await markAsSent(summaryId);
    }

    setSelectedSummaries(new Set());
  };

  /**
   * Toggle appointment made status
   */
  const handleAppointmentMadeToggle = async (summaryId: string, currentStatus: boolean) => {
    try {
      // Get current staff user ID
      const staffData = sessionStorage.getItem('tshla_medical_user');
      const staffId = staffData ? JSON.parse(staffData).id : null;

      const response = await fetch(`${API_BASE_URL}/api/patient-summaries/${summaryId}/appointment-made`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentMade: !currentStatus,
          staffId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update appointment status');
      }

      // Reload summaries to reflect change
      await loadSummaries();

    } catch (err: any) {
      console.error('Error toggling appointment status:', err);
      alert(`Failed to update appointment status: ${err.message}`);
    }
  };

  /**
   * Handle delete button click
   */
  const handleDeleteClick = (summary: PatientSummary) => {
    setSummaryToDelete(summary);
    setConfirmPatientName('');
    setDeleteReason('wrong_chart');
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  /**
   * Confirm and execute delete
   */
  const handleConfirmDelete = async () => {
    if (!summaryToDelete) return;

    // Verify patient name matches
    if (confirmPatientName.trim().toLowerCase() !== summaryToDelete.patient_name.toLowerCase()) {
      setDeleteError('Patient name does not match. Please type the name exactly as shown.');
      return;
    }

    try {
      // Get current staff user ID
      const staffData = sessionStorage.getItem('tshla_medical_user');
      const staffId = staffData ? JSON.parse(staffData).id : null;

      const response = await fetch(`${API_BASE_URL}/api/staff/patient-summaries/${summaryToDelete.id}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: staffId,
          reason: deleteReason
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete summary');
      }

      // Close modal and reload
      setDeleteModalOpen(false);
      setSummaryToDelete(null);
      await loadSummaries();
      alert('Patient summary deleted successfully');

    } catch (err: any) {
      console.error('Error deleting summary:', err);
      setDeleteError(err.message || 'Failed to delete summary');
    }
  };

  /**
   * Toggle summary selection
   */
  const toggleSelection = (summaryId: string) => {
    const newSelection = new Set(selectedSummaries);
    if (newSelection.has(summaryId)) {
      newSelection.delete(summaryId);
    } else {
      newSelection.add(summaryId);
    }
    setSelectedSummaries(newSelection);
  };

  /**
   * Get unique providers from summaries
   */
  const getUniqueProviders = () => {
    const providersMap = new Map<string, string>();
    summaries.forEach(s => {
      if (s.provider_id && s.provider_name) {
        providersMap.set(s.provider_id, s.provider_name);
      }
    });
    return Array.from(providersMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  /**
   * Get status badge
   */
  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();

    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <X className="w-3 h-3" />
          Expired
        </span>
      );
    }

    switch (status) {
      case 'accessed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCheck className="w-3 h-3" />
            Accessed
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3" />
            Sent
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  /**
   * Format date/time
   */
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Calculate time until expiration
   */
  const getTimeUntilExpiration = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  /**
   * Format follow-up date with color coding and appointment checkbox
   */
  const formatFollowUpDate = (
    summaryId: string,
    followupDate: string | null,
    followupNotes: string | null,
    appointmentMade: boolean
  ) => {
    if (!followupDate) {
      return (
        <span className="text-xs text-gray-400">Not scheduled</span>
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUp = new Date(followupDate);
    followUp.setHours(0, 0, 0, 0);
    const diffMs = followUp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Determine color based on timing
    let colorClass = 'text-gray-700 bg-gray-50';
    let icon = <Calendar className="w-3 h-3" />;

    if (diffDays < 0) {
      // Overdue
      colorClass = 'text-red-700 bg-red-50';
      icon = <AlertCircle className="w-3 h-3" />;
    } else if (diffDays <= 14) {
      // Upcoming (within 2 weeks)
      colorClass = 'text-yellow-700 bg-yellow-50';
      icon = <Clock className="w-3 h-3" />;
    }

    const formattedDate = followUp.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const relativeTime = diffDays < 0
      ? `${Math.abs(diffDays)} days ago`
      : diffDays === 0
      ? 'Today'
      : diffDays === 1
      ? 'Tomorrow'
      : `in ${diffDays} days`;

    return (
      <div className="flex flex-col gap-2">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
          {icon}
          {formattedDate}
        </div>
        <div className="text-xs text-gray-500">{relativeTime}</div>
        {followupNotes && (
          <div className="text-xs text-gray-600 italic" title={followupNotes}>
            {followupNotes.length > 30 ? followupNotes.substring(0, 30) + '...' : followupNotes}
          </div>
        )}
        {/* Appointment Made Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={appointmentMade}
            onChange={() => handleAppointmentMadeToggle(summaryId, appointmentMade)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className={`text-xs font-medium ${appointmentMade ? 'text-green-700' : 'text-gray-600'}`}>
            Appt Made
          </span>
        </label>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="unified-page-header">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <button
                onClick={() => navigate('/dashboard')}
                className="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <h1 className="unified-page-title">Patient Audio Summaries</h1>
              <p className="unified-page-subtitle">
                Manage and send patient visit summaries via web portal
              </p>
            </div>
            <button
              onClick={loadSummaries}
              disabled={isLoading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient name, phone, MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="unified-input pl-10"
              />
            </div>

            {/* Provider Filter */}
            <div className="relative">
              <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="unified-select pl-10"
              >
                <option value="all">All Providers</option>
                {getUniqueProviders().map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="unified-select pl-10"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="accessed">Accessed</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="unified-select pl-10"
              >
                <option value="24hours">Last 24 Hours</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedSummaries.size > 0 && (
            <div className="mt-4 flex items-center gap-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <span className="text-sm font-semibold text-slate-700">
                {selectedSummaries.size} selected
              </span>
              <button
                onClick={bulkMarkAsSent}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Sent
              </button>
              <button
                onClick={() => setSelectedSummaries(new Set())}
                className="text-sm text-slate-600 hover:text-slate-900 font-medium"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="unified-card bg-red-50 border-l-4 border-red-500 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="unified-card text-center py-12">
            <div className="unified-spinner mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading summaries...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredSummaries.length === 0 && (
          <div className="unified-card text-center py-12">
            <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No summaries found</h3>
            <p className="text-slate-600">
              {searchQuery ? 'Try adjusting your search or filters' : 'No patient summaries have been created yet'}
            </p>
          </div>
        )}

        {/* Summaries Table */}
        {!isLoading && filteredSummaries.length > 0 && (
          <div className="unified-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="unified-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedSummaries.size === filteredSummaries.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSummaries(new Set(filteredSummaries.map(s => s.id)));
                          } else {
                            setSelectedSummaries(new Set());
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TSHLA ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Athena MRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Follow Up
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSummaries.map((summary) => (
                    <tr key={summary.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSummaries.has(summary.id)}
                          onChange={() => toggleSelection(summary.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{summary.patient_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {summary.patient_phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {summary.tshla_id}
                          </code>
                          <button
                            onClick={() => copyToClipboard(summary.tshla_id, `tshla-${summary.id}`)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Copy TSHLA ID"
                          >
                            {copiedItem === `tshla-${summary.id}` ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {summary.athena_mrn || 'N/A'}
                          </code>
                          {summary.athena_mrn && summary.athena_mrn !== 'N/A' && (
                            <button
                              onClick={() => copyToClipboard(summary.athena_mrn, `mrn-${summary.id}`)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Copy Athena MRN"
                            >
                              {copiedItem === `mrn-${summary.id}` ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {summary.provider_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{formatDateTime(summary.created_at)}</div>
                        <div className="text-xs text-gray-500">
                          Expires in {getTimeUntilExpiration(summary.expires_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {formatFollowUpDate(summary.id, summary.followup_date, summary.followup_notes, summary.appointment_made)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(summary.status, summary.expires_at)}
                        {summary.access_count > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Accessed {summary.access_count}x
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {/* Copy Link Button */}
                          <button
                            onClick={() => copyToClipboard(summary.share_link_url, `link-${summary.id}`)}
                            className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1 text-sm"
                            title="Copy shareable link"
                          >
                            {copiedItem === `link-${summary.id}` ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy Link
                              </>
                            )}
                          </button>

                          {/* Mark as Sent */}
                          {summary.status === 'pending' && (
                            <button
                              onClick={() => markAsSent(summary.id)}
                              className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm"
                              title="Mark as sent to patient"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Preview Link */}
                          <a
                            href={summary.share_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                            title="Preview patient view"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(summary);
                            }}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg"
                            title="Delete summary (wrong chart)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {!isLoading && filteredSummaries.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="stats-card">
              <div className="stats-value">{filteredSummaries.length}</div>
              <div className="stats-label">Total Summaries</div>
            </div>
            <div className="stats-card" style={{ borderLeftColor: '#f59e0b' }}>
              <div className="stats-value" style={{ color: '#f59e0b' }}>
                {filteredSummaries.filter(s => s.status === 'pending').length}
              </div>
              <div className="stats-label">Pending</div>
            </div>
            <div className="stats-card" style={{ borderLeftColor: '#6366f1' }}>
              <div className="stats-value" style={{ color: '#6366f1' }}>
                {filteredSummaries.filter(s => s.status === 'sent').length}
              </div>
              <div className="stats-label">Sent</div>
            </div>
            <div className="stats-card" style={{ borderLeftColor: '#10b981' }}>
              <div className="stats-value" style={{ color: '#10b981' }}>
                {filteredSummaries.filter(s => s.status === 'accessed').length}
              </div>
              <div className="stats-label">Accessed</div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && summaryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Patient Summary?</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="text-sm text-amber-800">
                <div><strong>Patient:</strong> {summaryToDelete.patient_name}</div>
                <div><strong>TSHLA ID:</strong> {summaryToDelete.tshla_id}</div>
                <div><strong>Created:</strong> {formatDateTime(summaryToDelete.created_at)}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for deletion <span className="text-red-600">*</span>
                </label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="wrong_chart">Wrong Patient Chart</option>
                  <option value="duplicate">Duplicate Entry</option>
                  <option value="test">Test/Demo Data</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type patient name to confirm <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={confirmPatientName}
                  onChange={(e) => {
                    setConfirmPatientName(e.target.value);
                    setDeleteError(null);
                  }}
                  placeholder={summaryToDelete.patient_name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Type "{summaryToDelete.patient_name}" to confirm deletion
                </p>
              </div>

              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSummaryToDelete(null);
                  setConfirmPatientName('');
                  setDeleteError(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
