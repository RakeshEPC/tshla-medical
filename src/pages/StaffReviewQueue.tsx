/**
 * Staff Review Queue
 * Allows staff to review and approve/reject patient edits to their H&P charts
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, User, Calendar, Eye, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PatientEdit {
  id: string;
  patient_phone: string;
  tshla_id: string;
  patient_name?: string;
  edit_type: string;
  section_name: string;
  edit_data: any;
  chart_history_id?: string;
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  priority: 'high' | 'normal' | 'low';
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function StaffReviewQueue() {
  const [edits, setEdits] = useState<PatientEdit[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);

  useEffect(() => {
    loadEdits();
  }, [filter]);

  const loadEdits = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('staff_review_queue')
        .select('*')
        .order('priority', { ascending: false }) // High priority first
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setEdits(data || []);
    } catch (err: any) {
      console.error('Error loading edits:', err);
      setError('Failed to load patient edits');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (editId: string, action: 'approve' | 'reject') => {
    if (!reviewNotes.trim() && action === 'reject') {
      alert('Please provide a reason for rejecting this edit');
      return;
    }

    setReviewingId(editId);
    setError('');

    try {
      // Get current user (staff) ID from auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const edit = edits.find(e => e.id === editId);
      if (!edit) throw new Error('Edit not found');

      // Update review status in staff_review_queue
      const { error: updateError } = await supabase
        .from('staff_review_queue')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id,
          review_notes: reviewNotes.trim() || null
        })
        .eq('id', editId);

      if (updateError) throw updateError;

      // If approved, apply changes to patient's H&P
      if (action === 'approve') {
        // Get current H&P to build the updated value
        const { data: currentHP, error: hpError } = await supabase
          .from('patient_comprehensive_chart')
          .select(edit.section_name)
          .eq('patient_phone', edit.patient_phone)
          .single();

        if (hpError) throw hpError;

        // Build new value by appending or merging the edit
        let newValue;
        const currentValue = currentHP?.[edit.section_name];

        if (Array.isArray(currentValue)) {
          // Array sections (allergies, family_history, current_goals)
          newValue = [...currentValue, edit.edit_data];
        } else if (typeof currentValue === 'object') {
          // Object sections (social_history)
          newValue = { ...currentValue, ...edit.edit_data };
        } else {
          // Default: just use the edit data
          newValue = edit.edit_data;
        }

        // Apply via API
        const response = await fetch(`${API_BASE_URL}/api/hp/patient/${edit.tshla_id}/apply-edit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            editId: editId,
            section: edit.section_name,
            newValue: newValue,
            reviewedBy: session.user.id
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to apply changes to patient H&P');
        }
      }

      // Reload the list
      await loadEdits();
      setReviewingId(null);
      setReviewNotes('');
      setExpandedEditId(null);
    } catch (err: any) {
      console.error('Error reviewing edit:', err);
      setError(err.message || 'Failed to review edit');
      setReviewingId(null);
    }
  };

  const renderEditData = (editData: any, editType: string) => {
    // Handle different edit types
    if (editType.includes('allergy') || editType.includes('goal')) {
      return (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
          <pre className="whitespace-pre-wrap">{JSON.stringify(editData, null, 2)}</pre>
        </div>
      );
    }

    // Default: Show JSON
    return (
      <div className="bg-green-50 border border-green-200 rounded p-3">
        <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(editData, null, 2)}</pre>
      </div>
    );
  };

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      allergies: 'Allergies',
      family_history: 'Family History',
      social_history: 'Social History',
      current_goals: 'Current Goals'
    };
    return labels[section] || section;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3" />
          Pending Review
        </span>
      );
    } else if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3" />
          Approved
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="w-3 h-3" />
          High Priority
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Edit Review Queue</h1>
          <p className="text-gray-600">
            Review and approve patient-submitted changes to their medical charts
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                filter === status
                  ? 'text-teal-600 border-teal-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'pending' && edits.filter(e => e.status === 'pending').length > 0 && (
                <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full px-2 py-0.5">
                  {edits.filter(e => e.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            <p className="mt-2 text-gray-600">Loading patient edits...</p>
          </div>
        ) : edits.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 text-lg">No {filter !== 'all' ? filter : ''} edits found</p>
            <p className="text-sm text-gray-500 mt-2">
              Patient edits will appear here for review
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {edits.map((edit) => (
              <div
                key={edit.id}
                className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
              >
                {/* Edit Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-teal-100 rounded-full p-2">
                        <User className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {edit.patient_name || edit.tshla_id}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Section: <span className="font-medium">{getSectionLabel(edit.section_name)}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Type: {edit.edit_type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getPriorityBadge(edit.priority)}
                      <div className="text-right">
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(edit.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(edit.status)}
                    </div>
                  </div>
                </div>

                {/* Edit Details */}
                <div className="p-4">
                  {expandedEditId === edit.id ? (
                    <>
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Patient's Addition/Update:</p>
                        {renderEditData(edit.edit_data, edit.edit_type)}
                      </div>

                      {/* Review Actions (only for pending) */}
                      {edit.status === 'pending' && (
                        <div className="mt-4 border-t pt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Review Notes (required for rejection)
                          </label>
                          <textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add notes about this review..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            rows={3}
                          />

                          <div className="flex gap-3 mt-3">
                            <button
                              onClick={() => handleReview(edit.id, 'approve')}
                              disabled={reviewingId === edit.id}
                              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {reviewingId === edit.id ? 'Approving...' : 'Approve & Apply Changes'}
                            </button>
                            <button
                              onClick={() => handleReview(edit.id, 'reject')}
                              disabled={reviewingId === edit.id}
                              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              {reviewingId === edit.id ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reviewed details (for approved/rejected) */}
                      {edit.status !== 'pending' && edit.review_notes && (
                        <div className="mt-4 border-t pt-4">
                          <p className="text-sm font-medium text-gray-700">Reviewer Notes:</p>
                          <p className="text-sm text-gray-600 mt-1">{edit.review_notes}</p>
                          {edit.reviewed_at && (
                            <p className="text-xs text-gray-500 mt-2">
                              Reviewed on {new Date(edit.reviewed_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setExpandedEditId(null);
                          setReviewNotes('');
                        }}
                        className="mt-4 text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Hide Details
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setExpandedEditId(edit.id)}
                      className="w-full flex items-center justify-center gap-2 text-teal-600 hover:text-teal-700 font-medium py-2 hover:bg-teal-50 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details & Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
