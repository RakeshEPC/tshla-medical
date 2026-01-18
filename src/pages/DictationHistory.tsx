import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FileText, Calendar, User, Clock, Search, Filter, Trash2, ArrowLeft } from 'lucide-react';
import { dictationStorageService } from '../services/dictationStorage.service';
import ConfirmDeleteDictationModal from '../components/ConfirmDeleteDictationModal';
import { useAuth } from '../contexts/AuthContext';
import '../styles/unified-theme.css';

interface Dictation {
  id: string;
  patient_name: string;
  patient_mrn: string;
  visit_date: string;
  created_at: string;
  status: string;
  transcription_text: string;
  final_note: string;
  appointment_id: number | null;
}

type DateRangeFilter = '7days' | '30days' | '90days' | 'all';

export default function DictationHistory() {
  console.log('🎬 DictationHistory component mounted');
  console.log('📍 Location:', window.location.pathname);
  console.log('🔧 Component rendering at:', new Date().toISOString());

  const navigate = useNavigate();
  const { user } = useAuth();

  console.log('👤 Auth user object:', user);
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'completed' | 'signed'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('30days');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [dictationToDelete, setDictationToDelete] = useState<Dictation | null>(null);

  console.log('👤 User:', user?.email, 'Loading:', loading, 'Dictations:', dictations.length);

  useEffect(() => {
    console.log('🔄 useEffect triggered - loading dictations');
    loadDictations();
  }, [statusFilter, dateRangeFilter]);

  const loadDictations = async () => {
    try {
      setLoading(true);
      console.log('🔍 DictationHistory: Loading dictations...');

      // Calculate date range
      let dateThreshold: string | null = null;
      if (dateRangeFilter !== 'all') {
        const now = new Date();
        const daysAgo = {
          '7days': 7,
          '30days': 30,
          '90days': 90
        }[dateRangeFilter];

        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() - daysAgo);
        dateThreshold = thresholdDate.toISOString();
      }

      console.log('📅 Date filter:', dateRangeFilter, 'Threshold:', dateThreshold);
      console.log('🏷️ Status filter:', statusFilter);

      // Query dictated_notes table (where QuickNote saves dictations)
      // NOTE: We'll filter deleted_at manually because Supabase .is() seems unreliable
      let query = supabase
        .from('dictated_notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      console.log('🔍 Query built for dictated_notes table');

      // Apply date range filter
      if (dateThreshold) {
        query = query.gte('created_at', dateThreshold);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      console.log('📊 Query result (before deleted filter):', {
        count: data?.length || 0,
        error: error,
        hasData: !!data,
        dataType: typeof data,
        firstRecord: data?.[0]
      });

      // CRITICAL: Manually filter out soft-deleted notes
      // (Supabase .is('deleted_at', null) doesn't seem to work reliably)
      const filteredData = (data || []).filter((note: any) => {
        const isDeleted = note.deleted_at !== null && note.deleted_at !== undefined;
        if (isDeleted) {
          console.log('🗑️ [DictationHistory] Filtering out deleted note:', note.id, 'deleted_at:', note.deleted_at);
        }
        return !isDeleted;
      });

      console.log('📊 After manual deleted filter:', {
        beforeCount: data?.length || 0,
        afterCount: filteredData.length,
        removedCount: (data?.length || 0) - filteredData.length
      });

      if (error) {
        console.error('❌ Supabase error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!filteredData || filteredData.length === 0) {
        console.warn('⚠️ No dictations found in database. Table might be empty or RLS blocking access.');
      }

      // Map dictated_notes table to Dictation interface format
      const mappedData = filteredData.map(note => ({
        id: String(note.id),
        patient_name: note.patient_name,
        patient_mrn: note.patient_mrn,
        visit_date: note.visit_date,
        created_at: note.created_at,
        status: note.status || 'completed',
        transcription_text: note.raw_transcript || '',
        final_note: note.processed_note || '',
        appointment_id: null
      }));

      console.log('✅ Loaded dictations:', mappedData.length);
      setDictations(mappedData);
    } catch (error) {
      console.error('❌ Error loading dictations:', error);
      alert('Failed to load dictations: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const filteredDictations = dictations.filter(dict => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      dict.patient_name?.toLowerCase().includes(search) ||
      dict.patient_mrn?.toLowerCase().includes(search) ||
      dict.transcription_text?.toLowerCase().includes(search) ||
      dict.final_note?.toLowerCase().includes(search)
    );
  });


  const handleDeleteClick = (dictation: Dictation, e: React.MouseEvent) => {
    e.stopPropagation();
    setDictationToDelete(dictation);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: 'wrong_chart' | 'duplicate' | 'test' | 'other') => {
    if (!dictationToDelete) {
      console.error('❌ [DictationHistory] No dictation to delete');
      return;
    }

    if (!user?.id) {
      console.error('❌ [DictationHistory] No user ID available');
      alert('Cannot delete: User not authenticated');
      return;
    }

    console.log('🗑️ [DictationHistory] Starting delete for:', {
      dictationId: dictationToDelete.id,
      userId: user.id,
      reason: reason,
      patientName: dictationToDelete.patient_name
    });

    const result = await dictationStorageService.deleteDictation(
      dictationToDelete.id,
      user.id,
      reason
    );

    console.log('📋 [DictationHistory] Delete result:', result);

    if (result.success) {
      console.log('✅ [DictationHistory] Delete successful, removing from UI');
      console.log('📊 [DictationHistory] Before filter - dictations count:', dictations.length);

      // Immediately remove from UI (optimistic update)
      const deletedId = dictationToDelete.id;
      setDictations(prev => {
        const filtered = prev.filter(d => d.id !== deletedId);
        console.log('📊 [DictationHistory] After filter - dictations count:', filtered.length);
        console.log('🗑️ [DictationHistory] Removed ID:', deletedId);
        return filtered;
      });

      setDeleteModalOpen(false);
      setDictationToDelete(null);

      // Also reload from server to ensure sync
      console.log('🔄 [DictationHistory] Reloading from server...');
      await loadDictations();

      alert('Dictation deleted successfully');
    } else {
      console.error('❌ [DictationHistory] Delete failed:', result.error);
      alert(`Failed to delete: ${result.error}`);
    }
  };

  const getDateRangeLabel = () => {
    switch (dateRangeFilter) {
      case '7days': return 'Last 7 Days';
      case '30days': return 'Last 30 Days';
      case '90days': return 'Last 90 Days';
      case 'all': return 'All Time';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="unified-page-header">
          <button
            onClick={() => navigate('/dashboard')}
            className="back-button"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="unified-page-title">Dictation History</h1>
          <p className="unified-page-subtitle">View and manage all your saved dictations</p>
        </div>
        {/* Search and Filter Bar */}
        <div className="unified-card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by patient name, MRN, or note content..."
                className="unified-input pl-10"
              />
            </div>

            {/* Date Range Filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
                className="unified-select pl-10"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="unified-select pl-10"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Drafts</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="signed">Signed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stats-card">
            <div className="stats-value">{dictations.length}</div>
            <div className="stats-label">Total Dictations</div>
            <div className="text-xs text-slate-500 mt-1">({getDateRangeLabel()})</div>
          </div>
          <div className="stats-card" style={{ borderLeftColor: '#10b981' }}>
            <div className="stats-value" style={{ color: '#10b981' }}>
              {dictations.filter(d => d.status === 'completed').length}
            </div>
            <div className="stats-label">Completed</div>
          </div>
          <div className="stats-card" style={{ borderLeftColor: '#6366f1' }}>
            <div className="stats-value" style={{ color: '#6366f1' }}>
              {dictations.filter(d => d.status === 'signed').length}
            </div>
            <div className="stats-label">Signed</div>
          </div>
          <div className="stats-card" style={{ borderLeftColor: '#f59e0b' }}>
            <div className="stats-value" style={{ color: '#f59e0b' }}>
              {dictations.filter(d => d.status === 'draft').length}
            </div>
            <div className="stats-label">Drafts</div>
          </div>
        </div>

        {/* Dictations List */}
        {loading ? (
          <div className="unified-card text-center py-12">
            <div className="unified-spinner mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading dictations...</p>
          </div>
        ) : filteredDictations.length === 0 ? (
          <div className="unified-card text-center py-12">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No dictations found</h3>
            <p className="text-slate-600 mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Start dictating to see your notes here'}
            </p>
            <button
              onClick={() => navigate('/quick-note')}
              className="btn-primary"
            >
              Start New Dictation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDictations.map((dictation) => (
              <div
                key={dictation.id}
                className="unified-card cursor-pointer"
                onClick={() => navigate(`/dictation-viewer/${dictation.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {dictation.patient_name || 'Unknown Patient'}
                      </h3>
                      <span className={`status-badge status-badge-${dictation.status === 'completed' ? 'completed' : dictation.status === 'signed' ? 'accessed' : 'pending'}`}>
                        {dictation.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      {dictation.patient_mrn && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400" />
                          <span>MRN: {dictation.patient_mrn}</span>
                        </div>
                      )}
                      {dictation.visit_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{new Date(dictation.visit_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{new Date(dictation.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteClick(dictation, e)}
                      className="btn-danger flex items-center gap-2"
                      title="Delete this dictation"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dictation-viewer/${dictation.id}`);
                      }}
                      className="btn-primary"
                    >
                      View Note
                    </button>
                  </div>
                </div>

                {/* Note Preview */}
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <p className="text-sm text-slate-700 line-clamp-3">
                    {dictation.final_note || dictation.transcription_text || 'No content'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {dictationToDelete && (
        <ConfirmDeleteDictationModal
          dictation={{
            id: dictationToDelete.id,
            patient_name: dictationToDelete.patient_name,
            patient_mrn: dictationToDelete.patient_mrn,
            visit_date: dictationToDelete.visit_date
          }}
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDictationToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
