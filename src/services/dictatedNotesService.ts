import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * Dictated Notes Service
 * Frontend service for managing dictated notes storage and retrieval
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://www.tshla.ai/api/schedules';

export interface DictatedNote {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_email: string;
  provider_specialty: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  patient_mrn?: string;
  patient_dob?: string;
  appointment_id?: string;
  visit_date: string;
  visit_type: 'new-patient' | 'follow-up' | 'consultation' | 'emergency' | 'annual-exam' | 'other';
  note_title: string;
  chief_complaint?: string;
  raw_transcript: string;
  processed_note: string;
  ai_summary?: string;
  clinical_impression?: string;
  template_id?: string;
  template_name?: string;
  template_sections?: any;
  recording_mode: 'dictation' | 'conversation';
  recording_duration_seconds: number;
  ai_model_used?: string;
  processing_confidence_score?: number;
  medical_terms_detected?: any;
  status: 'draft' | 'pending-review' | 'reviewed' | 'final' | 'signed' | 'amended' | 'cancelled';
  is_locked: boolean;
  requires_review: boolean;
  review_priority: 'low' | 'medium' | 'high' | 'urgent';
  quality_score?: number;
  created_at: string;
  updated_at: string;
  dictated_at: string;
  last_edited_at?: string;
  signed_at?: string;
  signed_by_provider_name?: string;
}

export interface CreateNoteRequest {
  provider_id: string;
  provider_name: string;
  provider_email?: string;
  provider_specialty?: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  patient_mrn?: string;
  patient_dob?: string;
  appointment_id?: string;
  visit_date?: string;
  visit_type?: string;
  note_title?: string;
  chief_complaint?: string;
  raw_transcript: string;
  processed_note: string;
  ai_summary?: string;
  clinical_impression?: string;
  template_id?: string;
  template_name?: string;
  template_sections?: any;
  recording_mode?: string;
  recording_duration_seconds?: number;
  ai_model_used?: string;
  processing_confidence_score?: number;
  medical_terms_detected?: any;
  status?: string;
}

export interface UpdateNoteRequest {
  processed_note?: string;
  ai_summary?: string;
  clinical_impression?: string;
  status?: string;
  updated_by_provider_id: string;
  updated_by_provider_name: string;
  change_description?: string;
}

export interface NoteSearchParams {
  query?: string;
  provider_id?: string;
  patient_name?: string;
  date_from?: string;
  date_to?: string;
}

export interface NoteVersion {
  id: string;
  note_id: string;
  version_number: number;
  change_type: string;
  change_description?: string;
  changed_by_provider_name: string;
  created_at: string;
}

export interface NoteComment {
  id: string;
  note_id: string;
  comment_text: string;
  comment_type: string;
  comment_priority: string;
  commented_by_provider_name: string;
  created_at: string;
  is_resolved: boolean;
}

class DictatedNotesService {
  private authToken: string | null = null;

  constructor() {
    this.authToken = localStorage.getItem('auth_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Save a dictated note to the database
   */
  async saveDictatedNote(note: CreateNoteRequest): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/api/dictated-notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ...note,
          visit_date: note.visit_date || new Date().toISOString().split('T')[0],
          note_title: note.note_title || `Note for ${note.patient_name}`,
          status: note.status || 'draft',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save note: ${response.statusText}`);
      }

      const data = await response.json();
      logInfo('dictatedNotesService', 'Info message', {});
      return data.noteId;
    } catch (error) {
      logError('dictatedNotesService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get provider's notes
   */
  async getProviderNotes(
    providerId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<DictatedNote[]> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.status) params.append('status', options.status);
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);

      const queryString = params.toString();
      const url = `${API_BASE}/api/providers/${providerId}/notes${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.notes || [];
    } catch (error) {
      logError('dictatedNotesService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Get specific note details with versions and comments
   */
  async getNoteDetails(noteId: string): Promise<{
    note: DictatedNote;
    versions: NoteVersion[];
    comments: NoteComment[];
  }> {
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch note details: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        note: data.note,
        versions: data.versions || [],
        comments: data.comments || [],
      };
    } catch (error) {
      logError('dictatedNotesService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(noteId: string, updates: UpdateNoteRequest): Promise<number> {
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.statusText}`);
      }

      const data = await response.json();
      return data.version;
    } catch (error) {
      logError('dictatedNotesService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Search notes
   */
  async searchNotes(searchParams: NoteSearchParams): Promise<DictatedNote[]> {
    try {
      const params = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const queryString = params.toString();
      const url = `${API_BASE}/api/notes/search${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to search notes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      logError('dictatedNotesService', 'Error message', {});
      throw error;
    }
  }

  /**
   * Save note from current dictation session
   */
  async saveFromDictationSession(sessionData: {
    transcript: string;
    processedNote: string;
    patientDetails: any;
    selectedTemplate?: any;
    recordingMode?: string;
    providerId: string;
    providerName: string;
    providerEmail?: string;
    appointmentId?: string;
  }): Promise<string> {
    const noteRequest: CreateNoteRequest = {
      provider_id: sessionData.providerId,
      provider_name: sessionData.providerName,
      provider_email: sessionData.providerEmail,
      patient_name: sessionData.patientDetails.name || 'Unknown Patient',
      patient_phone: sessionData.patientDetails.phone || '',
      patient_email: sessionData.patientDetails.email,
      patient_mrn: sessionData.patientDetails.mrn,
      appointment_id: sessionData.appointmentId,
      raw_transcript: sessionData.transcript,
      processed_note: sessionData.processedNote,
      recording_mode: sessionData.recordingMode as 'dictation' | 'conversation',
      template_id: sessionData.selectedTemplate?.id,
      template_name: sessionData.selectedTemplate?.name,
      template_sections: sessionData.selectedTemplate?.sections,
      ai_model_used: 'claude-3-5-sonnet',
      status: 'draft',
    };

    return this.saveDictatedNote(noteRequest);
  }

  /**
   * Get recent notes for provider dashboard
   */
  async getRecentNotes(providerId: string, days: number = 7): Promise<DictatedNote[]> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.getProviderNotes(providerId, {
      startDate,
      endDate,
      limit: 20,
    });
  }

  /**
   * Get notes requiring review
   */
  async getNotesRequiringReview(providerId: string): Promise<DictatedNote[]> {
    return this.getProviderNotes(providerId, {
      status: 'pending-review',
      limit: 50,
    });
  }

  /**
   * Mark note as final/signed
   */
  async signNote(noteId: string, providerId: string, providerName: string): Promise<void> {
    return this.updateNote(noteId, {
      status: 'signed',
      updated_by_provider_id: providerId,
      updated_by_provider_name: providerName,
      change_description: 'Note signed by provider',
    });
  }

  /**
   * Get notes for specific patient
   */
  async getPatientNotes(patientName: string, providerId?: string): Promise<DictatedNote[]> {
    return this.searchNotes({
      patient_name: patientName,
      provider_id: providerId,
    });
  }

  /**
   * Format note status for display
   */
  formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      draft: 'Draft',
      'pending-review': 'Pending Review',
      reviewed: 'Reviewed',
      final: 'Final',
      signed: 'Signed',
      amended: 'Amended',
      cancelled: 'Cancelled',
    };

    return statusMap[status] || status;
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      draft: 'gray',
      'pending-review': 'yellow',
      reviewed: 'blue',
      final: 'green',
      signed: 'green',
      amended: 'orange',
      cancelled: 'red',
    };

    return colorMap[status] || 'gray';
  }

  /**
   * Calculate reading time estimate
   */
  estimateReadingTime(text: string): number {
    const wordsPerMinute = 200; // Average reading speed
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Extract key information from note
   */
  extractKeyInfo(note: DictatedNote): {
    patientInfo: string;
    visitInfo: string;
    duration: string;
    wordCount: number;
  } {
    return {
      patientInfo: `${note.patient_name}${note.patient_phone ? ` • ${note.patient_phone}` : ''}`,
      visitInfo: `${this.formatVisitType(note.visit_type)} • ${this.formatDate(note.visit_date)}`,
      duration: this.formatDuration(note.recording_duration_seconds),
      wordCount: note.processed_note.split(/\s+/).length,
    };
  }

  private formatVisitType(visitType: string): string {
    const typeMap: Record<string, string> = {
      'new-patient': 'New Patient',
      'follow-up': 'Follow-up',
      consultation: 'Consultation',
      emergency: 'Emergency',
      'annual-exam': 'Annual Exam',
      other: 'Other',
    };

    return typeMap[visitType] || visitType;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
}

export const dictatedNotesService = new DictatedNotesService();
