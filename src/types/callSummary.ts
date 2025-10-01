export interface PatientInfo {
  name?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  isExistingPatient?: boolean;
  medicalRecordNumber?: string;
}

export interface CallDetails {
  reason?: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  appointmentRequested?: boolean;
  preferredProvider?: string;
  preferredDate?: string;
  preferredTime?: string;
  symptoms?: string[];
  medications?: string[];
}

export interface CallSummary {
  callSid: string;
  patientInfo: PatientInfo;
  callDetails: CallDetails;
  actionItems: string[];
  aiNotes: string;
  sentiment: 'positive' | 'neutral' | 'concerned' | 'emergency';
  extractionConfidence: number;
  timestamp: Date;
  status: 'in_progress' | 'completed';
}

export interface LiveTranscriptEntry {
  text: string;
  speaker: 'Patient' | 'AI Assistant' | 'Unknown';
  confidence?: number;
  timestamp: Date;
  isPartial?: boolean;
  type?: 'input' | 'response' | 'transcription';
}
