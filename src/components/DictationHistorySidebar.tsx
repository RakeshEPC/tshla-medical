import { useState, useEffect } from 'react';
import { Clock, User, FileText, Calendar } from 'lucide-react';
import { scheduleDatabaseService } from '../services/scheduleDatabase.service';

/**
 * Dictation History Sidebar Component
 * Displays all dictations for a logged-in provider with filtering options
 */

interface DictationNote {
  id?: number;
  patientName: string;
  patientMrn?: string;
  patientEmail?: string;
  patientPhone?: string;
  rawTranscript: string;
  aiProcessedNote: string;
  recordingMode: 'dictation' | 'conversation';
  isQuickNote?: boolean;
  visitDate?: string;
  createdAt?: string; // When the note was actually created
}

interface DictationHistorySidebarProps {
  providerId: string;
  providerName: string;
  isOpen: boolean;
  onToggle: () => void;
  onDictationSelect: (dictation: DictationNote) => void;
  currentDictationId?: number | null;
}

// Helper function to format time ago (replaces date-fns)
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

export default function DictationHistorySidebar({
  providerId,
  providerName,
  isOpen,
  onToggle,
  onDictationSelect,
  currentDictationId
}: DictationHistorySidebarProps) {
  const [dictations, setDictations] = useState<DictationNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'today' | 'week'>('today');
  const [selectedDictationId, setSelectedDictationId] = useState<number | null>(currentDictationId || null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  // Load dictations from database
  useEffect(() => {
    const loadDictations = async () => {
      setIsLoading(true);
      const logs: string[] = [];

      try {
        logs.push(`🔍 Provider ID: ${providerId}`);
        logs.push(`👤 Provider Name: ${providerName}`);
        logs.push(`🌐 API Mode: ${import.meta.env.MODE}`);

        console.log('📋 [DictationHistorySidebar] Loading dictations for provider:', providerId);

        // Use existing service method - returns DictatedNote[]
        const notes = await scheduleDatabaseService.getNotes(providerId);

        logs.push(`✅ API returned ${notes.length} notes`);
        console.log('📋 [DictationHistorySidebar] Loaded', notes.length, 'dictations');

        if (notes.length > 0) {
          notes.forEach((note, i) => {
            logs.push(`📝 Note ${i + 1}: ID=${note.id}, Patient=${note.patientName}, Created=${note.createdAt || 'N/A'}`);
          });
        }

        // Sort by ID (higher ID = newer) since we don't have createdAt
        const sorted = notes.sort((a, b) => (b.id || 0) - (a.id || 0));

        setDictations(sorted);
        setDiagnostics(logs);
      } catch (error) {
        console.error('❌ [DictationHistorySidebar] Error loading dictations:', error);
        logs.push(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
        setDictations([]);
        setDiagnostics(logs);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadDictations();
    }
  }, [providerId, isOpen]);

  // Update selected ID when current dictation changes
  useEffect(() => {
    if (currentDictationId) {
      setSelectedDictationId(currentDictationId);
    }
  }, [currentDictationId]);

  // Filter dictations based on selected time range
  const filteredDictations = dictations.filter(dictation => {
    // Use createdAt (when note was saved) as primary, fall back to visitDate
    const dateStr = dictation.createdAt || dictation.visitDate;
    if (!dateStr) return true; // Show all if no date

    const dictationDate = new Date(dateStr);
    const now = new Date();

    if (filterMode === 'today') {
      // Compare dates in local timezone to avoid UTC mismatch
      // toLocaleDateString() returns consistent format for same calendar day
      return dictationDate.toLocaleDateString() === now.toLocaleDateString();
    } else {
      // Last 7 days - compare in local timezone
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      // Compare dates ignoring time by comparing date strings
      return dictationDate.toLocaleDateString() >= sevenDaysAgo.toLocaleDateString();
    }
  });

  // Generate summary for anonymous notes (no patient name)
  const generateSummary = (dictation: DictationNote): string => {
    // If we have patient name, return it
    if (dictation.patientName &&
        dictation.patientName.trim() !== '' &&
        dictation.patientName !== 'Unidentified Patient') {
      return dictation.patientName;
    }

    // Otherwise, create summary from transcript or processed note
    const content = dictation.aiProcessedNote || dictation.rawTranscript || '';

    if (!content.trim()) {
      return 'Empty Note';
    }

    // Extract first meaningful sentence (up to 60 chars)
    const firstSentence = content.split(/[.!?]/)[0].trim();
    const summary = firstSentence.substring(0, 60);

    return summary.length < firstSentence.length
      ? `${summary}...`
      : summary;
  };

  // Handle dictation click
  const handleDictationClick = (dictation: DictationNote) => {
    console.log('📋 [DictationHistorySidebar] Selected dictation:', dictation.id);
    setSelectedDictationId(dictation.id || null);
    onDictationSelect(dictation);
  };

  // Calculate counts for filter buttons
  const todayCount = dictations.filter(d => {
    const dateStr = d.createdAt || d.visitDate;
    return dateStr && new Date(dateStr).toLocaleDateString() === new Date().toLocaleDateString();
  }).length;

  const weekCount = dictations.filter(d => {
    const dateStr = d.createdAt || d.visitDate;
    if (!dateStr) return true;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(dateStr).toLocaleDateString() >= sevenDaysAgo.toLocaleDateString();
  }).length;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-fit max-h-[800px] overflow-hidden transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            Dictation History
          </h3>
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            title="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Provider Info */}
        <div className="text-xs text-gray-600 mb-2">
          {providerName}
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode('today')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterMode === 'today'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            <Calendar className="w-3 h-3 inline-block mr-1" />
            Today ({todayCount})
          </button>
          <button
            onClick={() => setFilterMode('week')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterMode === 'week'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Last 7 Days ({weekCount})
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading dictations...</p>
        </div>
      )}

      {/* Diagnostics Panel */}
      {diagnostics.length > 0 && (
        <div className="bg-yellow-50 border-t border-b border-yellow-200 p-3">
          <p className="text-xs font-semibold text-yellow-800 mb-2">🔧 Diagnostics:</p>
          <div className="space-y-1">
            {diagnostics.map((log, i) => (
              <p key={i} className="text-xs font-mono text-yellow-900">{log}</p>
            ))}
          </div>
          <p className="text-xs text-yellow-700 mt-2">
            Total notes fetched: {dictations.length} | After filtering ({filterMode}): {filteredDictations.length}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredDictations.length === 0 && (
        <div className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">
            No dictations found
          </p>
          <p className="text-xs text-gray-500">
            {filterMode === 'today'
              ? 'No dictations recorded today'
              : 'No dictations in the last 7 days'}
          </p>
          {filterMode === 'today' && weekCount > 0 && (
            <button
              onClick={() => setFilterMode('week')}
              className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              View last 7 days ({weekCount} available)
            </button>
          )}
        </div>
      )}

      {/* Dictation List */}
      {!isLoading && filteredDictations.length > 0 && (
        <div className="overflow-y-auto max-h-[700px]">
          {filteredDictations.map(dictation => {
            const summary = generateSummary(dictation);
            const isAnonymous = !dictation.patientName ||
                                dictation.patientName.trim() === '' ||
                                dictation.patientName === 'Unidentified Patient';
            const isSelected = selectedDictationId === dictation.id;

            return (
              <button
                key={dictation.id}
                onClick={() => handleDictationClick(dictation)}
                className={`
                  w-full p-3 text-left border-b hover:bg-purple-50
                  transition-colors cursor-pointer
                  ${isSelected ? 'bg-purple-100 border-l-4 border-l-purple-600' : 'border-l-4 border-l-transparent'}
                `}
              >
                {/* Patient Name or Summary */}
                <div className="flex items-start gap-2 mb-1">
                  {isAnonymous ? (
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isAnonymous ? 'text-gray-600 italic' : 'text-gray-900'
                    }`}>
                      {summary}
                    </p>
                    {dictation.patientMrn && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        MRN: {dictation.patientMrn}
                      </p>
                    )}
                    {isAnonymous && (
                      <p className="text-xs text-orange-600 mt-0.5">
                        ⚠️ Anonymous - No patient identified
                      </p>
                    )}
                  </div>
                </div>

                {/* Timestamp and Metadata */}
                <div className="flex items-center gap-2 text-xs text-gray-500 ml-6">
                  {dictation.visitDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(dictation.visitDate)}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">
                    {dictation.recordingMode === 'conversation' ? '👥 Conv' : '🎤 Dict'}
                  </span>
                  {dictation.isQuickNote && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                      Quick Note
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer Stats */}
      {!isLoading && filteredDictations.length > 0 && (
        <div className="bg-gray-50 p-2 border-t text-center">
          <p className="text-xs text-gray-600">
            Showing {filteredDictations.length} of {dictations.length} total dictations
          </p>
        </div>
      )}
    </div>
  );
}
