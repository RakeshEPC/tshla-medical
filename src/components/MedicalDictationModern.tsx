import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { speechServiceRouter } from '../services/speechServiceRouter.service';
import { azureAIService } from '../services/azureAI.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import styles from '../styles/MedicalDictation.module.css';
import {
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
  Activity, Mic, MicOff, Users, FileText, Save, Copy,
  Share2, ChevronLeft, Download, Loader, Check, AlertCircle
} from 'lucide-react';

interface MedicalDictationProps {
  patientId?: string;
  preloadPatientData?: boolean;
}

export default function MedicalDictationModern({ patientId, preloadPatientData = false }: MedicalDictationProps) {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [processedNote, setProcessedNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [recordingMode, setRecordingMode] = useState<'dictation' | 'conversation' | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DoctorTemplate | null>(null);
  const [templates, setTemplates] = useState<DoctorTemplate[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'warning' | 'error', text: string } | null>(null);
  
  // Patient details for live editing
  const [patientDetails, setPatientDetails] = useState({
    name: '',
    mrn: '',
    dob: '',
    email: '',
    visitDate: new Date().toLocaleDateString()
  });

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      const currentUser = unifiedAuthService.getCurrentUser();
      const doctorId = currentUser?.id || currentUser?.email || 'doctor-default-001';
      
      doctorProfileService.initialize(doctorId);
      
      try {
        const allTemplates = await doctorProfileService.getTemplates(doctorId);
        setTemplates(allTemplates);
        
        const defaultTemplate = await doctorProfileService.getDefaultTemplate(doctorId);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate);
        }
      } catch (error) {
        logError('MedicalDictationModern', 'Error message', {});
        setTemplates([]);
      }
    };
    loadTemplates();
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (transcript || processedNote) {
        const autoSaveData = {
          transcript,
          processedNote,
          patientDetails,
          selectedTemplate: selectedTemplate?.id,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('autosave_dictation', JSON.stringify(autoSaveData));
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [transcript, processedNote, patientDetails, selectedTemplate]);

  const startRecording = async () => {
    if (!recordingMode) {
      setStatusMessage({ type: 'warning', text: 'Please select a recording mode first' });
      return;
    }

    setRecordingError('');
    setStatusMessage({ type: 'info', text: 'Starting recording...' });
    
    try {
      const callbacks = {
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            setTranscript(prev => prev + ' ' + text);
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        onError: (error: string) => {
          setRecordingError(error);
          setStatusMessage({ type: 'error', text: error });
        },
        onEnd: () => {
          setIsRecording(false);
          setStatusMessage({ type: 'info', text: 'Recording ended' });
        }
      };

      const success = await speechServiceRouter.startRecording(
        recordingMode,
        callbacks
      );

      if (success) {
        setIsRecording(true);
        setStatusMessage({ type: 'success', text: `Recording in ${recordingMode} mode` });
      } else {
        throw new Error('Failed to start recording');
      }
    } catch (error) {
      logError('MedicalDictationModern', 'Error message', {});
      setRecordingError('Failed to start recording. Please check your microphone.');
      setStatusMessage({ type: 'error', text: 'Failed to start recording' });
    }
  };

  const stopRecording = () => {
    try {
      logInfo('MedicalDictationModern', 'Stopping recording...');

      // Stop the speech service
      speechServiceRouter.stopRecording();

      // Update UI state
      setIsRecording(false);
      setInterimText('');
      setStatusMessage({ type: 'info', text: 'Recording stopped' });

      logInfo('MedicalDictationModern', 'Recording stopped successfully');
    } catch (error) {
      // Even if stopRecording fails, update UI to prevent stuck state
      logError('MedicalDictationModern', 'Error stopping recording (UI updated anyway)', { error });
      setIsRecording(false);
      setInterimText('');
      setStatusMessage({ type: 'warning', text: 'Recording stopped (with minor errors)' });
    }
  };

  const processWithAI = async () => {
    if (!transcript.trim()) {
      setStatusMessage({ type: 'warning', text: 'No transcript to process' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage({ type: 'info', text: 'Processing with AI...' });
    
    try {
      const patientData = {
        id: patientId || `patient-${Date.now()}`,
        fullName: patientDetails.name,
        mrn: patientDetails.mrn,
        dateOfBirth: patientDetails.dob,
        email: patientDetails.email
      };

      const result = await azureAIService.processMedicalTranscription(
        transcript,
        patientData,
        null,
        '',
        selectedTemplate ? {
          template: selectedTemplate,
          doctorSettings: {
            defaultNoteFormat: 'SOAP',
            preferredTerminology: 'standard'
          }
        } : undefined
      );

      setProcessedNote(result.formatted);
      setStatusMessage({ type: 'success', text: 'Note processed successfully' });
    } catch (error) {
      logError('MedicalDictationModern', 'Error message', {});
      setStatusMessage({ type: 'error', text: 'Failed to process note with AI' });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage({ type: 'success', text: 'Copied to clipboard!' });
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (error) {
      setStatusMessage({ type: 'error', text: 'Failed to copy' });
    }
  };

  const saveNote = () => {
    const noteData = {
      patientDetails,
      transcript,
      processedNote,
      timestamp: new Date().toISOString(),
      template: selectedTemplate?.name
    };
    
    const blob = new Blob([JSON.stringify(noteData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-note-${patientDetails.mrn || 'patient'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setStatusMessage({ type: 'success', text: 'Note saved to file' });
  };

  return (
    <div className={styles.dictationContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button
              onClick={() => navigate('/doctor')}
              className={`${styles.btn} ${styles.btnIcon}`}
            >
              <ChevronLeft size={16} />
            </button>
            <div className={styles.logo}>
              <Activity size={24} />
              <span>TSHLA Medical</span>
            </div>
            <span className={styles.pageTitle}>Quick Note</span>
          </div>
          
          <div className={styles.headerActions}>
            {processedNote && (
              <>
                <button
                  onClick={() => copyToClipboard(processedNote)}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  <Copy size={16} />
                  Copy
                </button>
                <button
                  onClick={saveNote}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  <Download size={16} />
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Left Column - Patient Details */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Users size={16} />
              Patient Information
            </h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.patientDetailsGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Patient Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={patientDetails.name}
                  onChange={(e) => setPatientDetails({...patientDetails, name: e.target.value})}
                  placeholder="Enter patient name"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>MRN</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={patientDetails.mrn}
                  onChange={(e) => setPatientDetails({...patientDetails, mrn: e.target.value})}
                  placeholder="Enter MRN"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date of Birth</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={patientDetails.dob}
                  onChange={(e) => setPatientDetails({...patientDetails, dob: e.target.value})}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={patientDetails.email}
                  onChange={(e) => setPatientDetails({...patientDetails, email: e.target.value})}
                  placeholder="patient@email.com"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Visit Date</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={patientDetails.visitDate}
                  disabled
                />
              </div>
            </div>
            
            {/* Template Selector */}
            <div className={styles.templateSelector}>
              <label className={styles.formLabel}>Template</label>
              <select
                className={styles.templateDropdown}
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const template = templates.find(t => t.id === e.target.value);
                  setSelectedTemplate(template || null);
                }}
              >
                <option value="">Select a template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Center Column - Recording Controls & Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Recording Controls */}
          <div className={styles.recordingSection}>
            <div className={styles.recordingModeSelector}>
              <div
                className={`${styles.modeCard} ${recordingMode === 'dictation' ? styles.active : ''}`}
                onClick={() => setRecordingMode('dictation')}
              >
                <span className={styles.modeIcon}>🎤</span>
                <div className={styles.modeName}>Dictation Mode</div>
                <div className={styles.modeDescription}>Single speaker dictation</div>
              </div>
              
              <div
                className={`${styles.modeCard} ${recordingMode === 'conversation' ? styles.active : ''}`}
                onClick={() => setRecordingMode('conversation')}
              >
                <span className={styles.modeIcon}>👥</span>
                <div className={styles.modeName}>Ambient Scribe</div>
                <div className={styles.modeDescription}>Multi-speaker conversation</div>
              </div>
            </div>
            
            <div className={styles.recordingControls}>
              <button
                className={`${styles.recordButton} ${
                  isRecording ? styles.recording : 
                  isProcessing ? styles.processing : 
                  styles.idle
                }`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || !recordingMode}
              >
                {isRecording ? <MicOff /> : isProcessing ? <Loader /> : <Mic />}
              </button>
              <div className={styles.recordButtonText}>
                {isRecording ? 'Stop Recording' : isProcessing ? 'Processing...' : 'Start Recording'}
              </div>
            </div>
            
            {statusMessage && (
              <div className={`${styles.statusMessage} ${styles[statusMessage.type]}`}>
                {statusMessage.type === 'error' && <AlertCircle size={16} />}
                {statusMessage.type === 'success' && <Check size={16} />}
                {statusMessage.type === 'info' && <Loader size={16} className={styles.loadingSpinner} />}
                {statusMessage.text}
              </div>
            )}
          </div>
          
          {/* Transcript */}
          <div className={styles.transcriptSection}>
            <div className={styles.transcriptHeader}>
              <h3 className={styles.transcriptTitle}>
                <FileText size={16} />
                Transcript
              </h3>
              <div className={styles.transcriptActions}>
                {transcript && (
                  <button
                    onClick={() => copyToClipboard(transcript)}
                    className={`${styles.btn} ${styles.btnIcon}`}
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className={styles.transcriptBody}>
              {transcript || interimText ? (
                <div className={styles.transcriptText}>
                  {transcript}
                  {interimText && (
                    <span className={styles.interimText}> {interimText}</span>
                  )}
                </div>
              ) : (
                <div className={`${styles.transcriptText} ${styles.empty}`}>
                  Start recording to see transcript here...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Processed Note */}
        <div className={styles.processedNoteSection}>
          <div className={styles.processedNoteHeader}>
            <h3 className={styles.transcriptTitle}>
              <FileText size={16} />
              Processed Note
            </h3>
            <button
              onClick={processWithAI}
              disabled={!transcript || isProcessing}
              className={`${styles.btn} ${styles.btnSuccess}`}
            >
              {isProcessing ? (
                <>
                  <Loader size={16} className={styles.loadingSpinner} />
                  Processing...
                </>
              ) : (
                <>
                  <Activity size={16} />
                  Process with AI
                </>
              )}
            </button>
          </div>
          <div className={styles.processedNoteBody}>
            {processedNote ? (
              <div className={styles.processedNoteText}>
                {processedNote}
              </div>
            ) : (
              <div className={`${styles.transcriptText} ${styles.empty}`}>
                Processed note will appear here...
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}