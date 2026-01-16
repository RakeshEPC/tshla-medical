import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FileText, Calendar, User, Clock, Search, Filter, Trash2 } from 'lucide-react';
import { dictationStorageService } from '../services/dictationStorage.service';
import ConfirmDeleteDictationModal from '../components/ConfirmDeleteDictationModal';
import { useAuth } from '../contexts/AuthContext';

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

  const navigate = useNavigate();
  const { user } = useAuth();
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

      // Query dictated_notes table (where actual dictations are stored)
      let query = supabase
        .from('dictated_notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply date range filter
      if (dateThreshold) {
        query = query.gte('created_at', dateThreshold);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      console.log('📊 Query result:', { count: data?.length || 0, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      // Map dictated_notes to Dictation interface format
      const mappedData = (data || []).map(note => ({
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

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      signed: 'bg-blue-100 text-blue-800'
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  const handleDeleteClick = (dictation: Dictation, e: React.MouseEvent) => {
    e.stopPropagation();
    setDictationToDelete(dictation);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: 'wrong_chart' | 'duplicate' | 'test' | 'other') => {
    if (!dictationToDelete || !user?.id) return;

    const result = await dictationStorageService.deleteDictation(
      dictationToDelete.id,
      user.id,
      reason
    );

    if (result.success) {
      setDeleteModalOpen(false);
      setDictationToDelete(null);
      loadDictations(); // Refresh list
      alert('Dictation deleted successfully');
    } else {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-100 hover:text-white mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Dictation History</h1>
          <p className="text-blue-100 mt-1">View and manage all your saved dictations</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by patient name, MRN, or note content..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Range Filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Total Dictations</div>
            <div className="text-2xl font-bold text-gray-900">{dictations.length}</div>
            <div className="text-xs text-gray-500 mt-1">({getDateRangeLabel()})</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-2xl font-bold text-green-600">
              {dictations.filter(d => d.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Signed</div>
            <div className="text-2xl font-bold text-blue-600">
              {dictations.filter(d => d.status === 'signed').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Drafts</div>
            <div className="text-2xl font-bold text-yellow-600">
              {dictations.filter(d => d.status === 'draft').length}
            </div>
          </div>
        </div>

        {/* Dictations List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dictations...</p>
          </div>
        ) : filteredDictations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No dictations found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Start dictating to see your notes here'}
            </p>
            <button
              onClick={() => navigate('/quick-note')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              Start New Dictation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDictations.map((dictation) => (
              <div
                key={dictation.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/dictation-viewer/${dictation.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {dictation.patient_name || 'Unknown Patient'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(dictation.status)}`}>
                        {dictation.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {dictation.patient_mrn && (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          MRN: {dictation.patient_mrn}
                        </div>
                      )}
                      {dictation.visit_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(dictation.visit_date).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(dictation.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Delete Button - Temporarily disabled (dictated_notes table doesn't have soft delete) */}
                    {/* TODO: Add soft delete columns to dictated_notes table */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dictation-viewer/${dictation.id}`);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      View Note
                    </button>
                  </div>
                </div>

                {/* Note Preview */}
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-700 line-clamp-3">
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
