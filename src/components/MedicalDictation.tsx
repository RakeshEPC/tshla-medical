import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { medicalCorrections } from '../services/medicalCorrections.service';
import { speechServiceRouter } from '../services/speechServiceRouter.service';
import { awsTranscribeService } from '../services/_deprecated/awsTranscribe.service';
import { awsTranscribeStreamingFixed } from '../services/_deprecated/awsTranscribeMedicalStreamingFixed.service';
import { awsTranscribeSimple } from '../services/_deprecated/awsTranscribeSimple.service';
import { getPatientData, type PatientData } from '../services/patientData.service';
import { specialtyService, type DoctorSpecialty } from '../services/specialty.service';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { dictatedNotesService } from '../services/dictatedNotesService';
import { scheduleService } from '../services/scheduleService';
import { scheduleDatabaseService } from '../services/scheduleDatabase.service';
import { azureAIService } from '../services/azureAI.service';
import { ChevronDown, FileText, Star, Clock, Mic, MicOff, Brain, User, Trash2, Copy, Printer, Stethoscope, ArrowLeft } from 'lucide-react';
import NoteFormatter from './NoteFormatter';
import { NoteSharing } from './NoteSharing';
import { noteSharingService, type ShareableNote } from '../services/noteSharing.service';
import { AudioSummaryModal } from './echo/AudioSummaryModal';
import { OrdersDisplay } from './OrdersDisplay';
import type { OrderExtractionResult } from '../services/orderExtraction.service';
import '../styles/modernUI.css';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

// Speech recognition interfaces removed - using HIPAA-compliant services only

interface MedicalDictationProps {
  patientId?: string;
  preloadPatientData?: boolean;
}

export default function MedicalDictation({ patientId, preloadPatientData = false }: MedicalDictationProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [processedNote, setProcessedNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [recordingMode, setRecordingMode] = useState<'dictation' | 'conversation' | null>(null); // Force selection
  const [audioLevel, setAudioLevel] = useState<number>(0);
  // Speech recognition ref removed - using HIPAA-compliant services
  const [doctorSpecialty, setDoctorSpecialty] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<DoctorTemplate | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templates, setTemplates] = useState<DoctorTemplate[]>([]);
  const [recentTemplates, setRecentTemplates] = useState<DoctorTemplate[]>([]);
  const [favoriteTemplates, setFavoriteTemplates] = useState<DoctorTemplate[]>([]);
  const [previousVisitNote, setPreviousVisitNote] = useState('');
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showDataRestored, setShowDataRestored] = useState(false);
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);
  const [lastSavedNoteId, setLastSavedNoteId] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [databaseAutoSaveStatus, setDatabaseAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastDatabaseSaveTime, setLastDatabaseSaveTime] = useState<Date | null>(null);
  const [aiProcessingError, setAiProcessingError] = useState<string>('');
  const [aiProcessingFailed, setAiProcessingFailed] = useState(false);

  // AI Processing Version History
  interface ProcessedNoteVersion {
    id: string;
    timestamp: Date;
    processedContent: string;
    templateUsed: string | null;
    templateId: string | null;
  }
  const [processedNoteVersions, setProcessedNoteVersions] = useState<ProcessedNoteVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showAudioSummaryModal, setShowAudioSummaryModal] = useState(false);

  // Extracted orders state
  const [extractedOrders, setExtractedOrders] = useState<OrderExtractionResult | null>(null);

  // Patient details for live editing
  const [patientDetails, setPatientDetails] = useState({
    name: '',
    mrn: '',
    dob: '',
    age: null as number | null,
    email: '',
    phone: '',
    visitDate: new Date().toLocaleDateString()
  });

  // Get current user for provider ID
  const currentUser = unifiedAuthService.getCurrentUser();
  const providerId = currentUser?.id || currentUser?.email || 'doctor-default-001';
  const providerName = currentUser?.name || 'Dr. Default';

  // Load patient data if patientId is provided and preload is enabled
  useEffect(() => {
    const loadPatientData = async () => {
      // FIRST PRIORITY: Try sessionStorage (from schedule click)
      const storedPatient = sessionStorage.getItem('current_patient');
      if (storedPatient) {
        try {
          const data = JSON.parse(storedPatient);
          setPatientDetails({
            name: data.name || '',
            mrn: data.id || '',
            dob: data.dob || '',
            age: data.age || null,
            email: data.email || '',
            phone: data.phone || '',
            visitDate: data.date || new Date().toLocaleDateString()
          });

          // Store appointmentId for linking note to appointment
          if (data.appointmentId) {
            sessionStorage.setItem('current_appointment_id', data.appointmentId);
          }

          logInfo('MedicalDictation', '✅ Patient data auto-populated from schedule', {
            patientName: data.name,
            appointmentId: data.appointmentId
          });
          return; // Exit early - we have the data
        } catch (error) {
          logError('MedicalDictation', 'Error parsing sessionStorage patient data', {});
        }
      }

      // SECOND PRIORITY: Try database lookup
      if (patientId && preloadPatientData) {
        try {
          // First try to get patient data from database schedule
          const today = new Date().toISOString().split('T')[0];
          const schedule = await scheduleDatabaseService.getScheduleForDate(providerId, today);

          // Find the patient in today's schedule
          const patient = schedule.find(p => p.id === patientId || p.name.includes(patientId) || p.mrn === patientId);

          if (patient) {
            setPatientDetails({
              name: patient.name || '',
              mrn: patient.mrn || '',
              dob: patient.dob || '',
              email: patient.email || '',
              phone: patient.phone || '',
              visitDate: new Date().toLocaleDateString()
            });
            logInfo('MedicalDictation', 'Patient data loaded from database', {});
          } else {
            // Fallback to old localStorage method
            const data = getPatientData(patientId);
            if (data) {
              setPatientDetails({
                name: data.name || '',
                mrn: data.mrn || '',
                dob: data.dob || '',
                email: data.email || '',
                phone: data.phone || '',
                visitDate: new Date().toLocaleDateString()
              });
              logInfo('MedicalDictation', 'Patient data loaded from localStorage', {});
            }
          }
        } catch (error) {
          logError('MedicalDictation', 'Error loading patient from database', {});
          // Fallback to old localStorage method
          const data = getPatientData(patientId);
          if (data) {
            setPatientDetails({
              name: data.name || '',
              mrn: data.mrn || '',
              dob: data.dob || '',
              email: data.email || '',
              phone: data.phone || '',
              visitDate: new Date().toLocaleDateString()
            });
          }
        }
      }
    };

    loadPatientData();
  }, [patientId, preloadPatientData, providerId]);

  // Load existing notes for this patient from database
  useEffect(() => {
    const loadExistingNotes = async () => {
      if (patientId && patientDetails.name) {
        try {
          logDebug('MedicalDictation', 'Debug message', {});
          const existingNotes = await scheduleDatabaseService.getNotes(providerId);

          // Find the most recent note for this patient
          const patientNotes = existingNotes.filter(note =>
            note.patientName === patientDetails.name ||
            (note.patientMrn && patientDetails.mrn && note.patientMrn === patientDetails.mrn)
          );

          if (patientNotes.length > 0) {
            // Sort by created date (assuming most recent first)
            const mostRecentNote = patientNotes[0];

            // Load the existing content
            if (mostRecentNote.rawTranscript) {
              setTranscript(mostRecentNote.rawTranscript);
            }
            if (mostRecentNote.aiProcessedNote) {
              setProcessedNote(mostRecentNote.aiProcessedNote);
            }

            setLastSavedNoteId(String(mostRecentNote.id || ''));
            logInfo('MedicalDictation', 'Info message', {});

            // Show notification that previous notes were loaded
            setTimeout(() => {
              alert(`📋 Loaded previous notes for ${patientDetails.name}\n\nYou can continue editing where you left off!`);
            }, 1000);
          }
        } catch (error) {
          logError('MedicalDictation', 'Error message', {});
        }
      }
    };

    // Only load once when component mounts with patient data
    if (patientId && patientDetails.name && !transcript && !processedNote) {
      loadExistingNotes();
    }
  }, [patientId, patientDetails.name, patientDetails.mrn, providerId]);

  // Load doctor templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        // CRITICAL: Must await getCurrentUser() to get actual user object, not Promise
        const result = await unifiedAuthService.getCurrentUser();
        if (!result.success || !result.user) {
          console.error('❌ [MedicalDictation] No authenticated user found');
          logError('MedicalDictation', 'Failed to get current user', { error: result.error });
          setTemplates([]);
          setRecentTemplates([]);
          setFavoriteTemplates([]);
          return;
        }

        const doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
        console.log('✅ [MedicalDictation] Loading templates for doctor:', { id: doctorId, email: result.user.email });

        doctorProfileService.initialize(doctorId);

        const allTemplates = await doctorProfileService.getTemplates(doctorId);
        const recent = await doctorProfileService.getRecentTemplates(doctorId);
        const favorites = await doctorProfileService.getFavoriteTemplates(doctorId);

        console.log(`✅ [MedicalDictation] Loaded ${allTemplates.length} templates from Supabase`);
        setTemplates(allTemplates);
        setRecentTemplates(recent);
        setFavoriteTemplates(favorites);

        // Set default template if available
        const defaultTemplate = await doctorProfileService.getDefaultTemplate(doctorId);
        if (defaultTemplate) {
          console.log('✅ [MedicalDictation] Set default template:', defaultTemplate.name);
          setSelectedTemplate(defaultTemplate);
        } else if (allTemplates.length > 0) {
          console.log('✅ [MedicalDictation] Set first template as default:', allTemplates[0].name);
          setSelectedTemplate(allTemplates[0]);
        }
      } catch (error) {
        console.error('❌ [MedicalDictation] Failed to load templates:', error);
        logError('MedicalDictation', 'Failed to load templates from Supabase', { error });
        // Load empty array as fallback, don't block dictation
        setTemplates([]);
        setRecentTemplates([]);
        setFavoriteTemplates([]);
      }
    };
    loadTemplates();
  }, []);

  // Auto-save transcript to localStorage every 10 seconds with visual feedback
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (transcript || processedNote) {
        setAutoSaveStatus('saving');

        const autoSaveData = {
          transcript,
          processedNote,
          patientDetails,
          previousVisitNote,
          selectedTemplate: selectedTemplate?.id,
          recordingMode,
          timestamp: new Date().toISOString()
        };

        localStorage.setItem('autosave_dictation', JSON.stringify(autoSaveData));
        const now = new Date();
        setLastSaveTime(now);
        setAutoSaveStatus('saved');

        logDebug('MedicalDictation', 'Debug message', {}); 

        // Reset status after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [transcript, processedNote, patientDetails, previousVisitNote, selectedTemplate, recordingMode]);

  // Auto-save to database every 30 seconds with changes detected
  useEffect(() => {
    const databaseAutoSaveInterval = setInterval(async () => {
      // Auto-save now works even without patient name (patient name is optional)
      // Only auto-save if we have content and already have a saved note ID (avoid creating duplicates)
      if ((transcript || processedNote) && databaseAutoSaveStatus !== 'saving' && lastSavedNoteId) {
        try {
          setDatabaseAutoSaveStatus('saving');

          // TODO: Implement UPDATE endpoint instead of creating new notes
          // For now, auto-save is disabled to prevent duplicates
          // User must click "Save to Database" manually

          setDatabaseAutoSaveStatus('idle');
          logDebug('MedicalDictation', 'Auto-save skipped - manual save required to prevent duplicates');

          // const noteId = await scheduleDatabaseService.saveNote(
          //   providerId,
          //   providerName,
          //   {
          //     patientName: patientDetails.name || '',
          //     patientMrn: patientDetails.mrn,
          //     rawTranscript: transcript,
          //     aiProcessedNote: processedNote,
          //     recordingMode: recordingMode || 'dictation',
          //     isQuickNote: !patientId
          //   }
          // );

          // if (noteId) {
          //   setLastSavedNoteId(String(noteId));
          //   setLastDatabaseSaveTime(new Date());
          //   setDatabaseAutoSaveStatus('saved');
          //   logDebug('MedicalDictation', `Auto-saved at ${new Date().toLocaleTimeString()}`);
          //   setTimeout(() => setDatabaseAutoSaveStatus('idle'), 3000);
          // } else {
          //   setDatabaseAutoSaveStatus('error');
          //   setTimeout(() => setDatabaseAutoSaveStatus('idle'), 5000);
          // }
        } catch (error) {
          logError('MedicalDictation', 'Error message', {});
          setDatabaseAutoSaveStatus('error');
          setTimeout(() => setDatabaseAutoSaveStatus('idle'), 5000);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(databaseAutoSaveInterval);
  }, [transcript, processedNote, patientDetails.name, patientDetails.mrn, recordingMode, patientId, providerId, providerName, databaseAutoSaveStatus, lastSavedNoteId]);

  // Restore auto-saved data on mount with improved UX
  useEffect(() => {
    const savedData = localStorage.getItem('autosave_dictation');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const savedTime = new Date(data.timestamp);
        const now = new Date();
        const hoursSince = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);

        // Auto-restore if less than 1 hour old (no prompt needed)
        if (hoursSince < 1) {
          setTranscript(data.transcript || '');
          setProcessedNote(data.processedNote || '');
          setPatientDetails(data.patientDetails || patientDetails);
          setPreviousVisitNote(data.previousVisitNote || '');
          setRecordingMode(data.recordingMode || null);
          if (data.selectedTemplate) {
            const template = templates.find(t => t.id === data.selectedTemplate);
            if (template) setSelectedTemplate(template);
          }
          setShowProcessed(!!data.processedNote);
          setShowDataRestored(true);
          setTimeout(() => setShowDataRestored(false), 5000); // Hide after 5 seconds
          logDebug('MedicalDictation', 'Debug message', {});
        }
        // Prompt if 1-24 hours old
        else if (hoursSince < 24) {
          if (window.confirm(`Found saved work from ${savedTime.toLocaleString()}. Continue where you left off?`)) {
            setTranscript(data.transcript || '');
            setProcessedNote(data.processedNote || '');
            setPatientDetails(data.patientDetails || patientDetails);
            setPreviousVisitNote(data.previousVisitNote || '');
            setRecordingMode(data.recordingMode || null);
            if (data.selectedTemplate) {
              const template = templates.find(t => t.id === data.selectedTemplate);
              if (template) setSelectedTemplate(template);
            }
            setShowProcessed(!!data.processedNote);
            setShowDataRestored(true);
            setTimeout(() => setShowDataRestored(false), 5000);
          } else {
            localStorage.removeItem('autosave_dictation');
          }
        }
        // Remove if older than 24 hours
        else {
          localStorage.removeItem('autosave_dictation');
        }
      } catch (error) {
        logError('MedicalDictation', 'Error message', {});
        localStorage.removeItem('autosave_dictation');
      }
    }
  }, [templates]);

  // Enhanced session extension for active dictation
  useEffect(() => {
    const extendSession = (reason = 'activity') => {
      const expiresAt = new Date(Date.now() + 120 * 60 * 1000); // Extend by 2 hours
      localStorage.setItem('session_expires', expiresAt.toISOString());
      logDebug('MedicalDictation', 'Debug message', {});
    };

    // AUTO-EXTEND WHILE RECORDING - Never timeout during active recording
    if (isRecording) {
      const recordingExtender = setInterval(() => {
        extendSession('recording');
      }, 30000); // Extend every 30 seconds while recording

      return () => clearInterval(recordingExtender);
    }

    // Extend session on meaningful user interactions (not just mouse movement)
    const events = ['click', 'keypress', 'input'];
    const handleActivity = () => extendSession('user-interaction');

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Enhanced session monitoring with auto-extension for active work
    const sessionCheck = setInterval(() => {
      const expires = localStorage.getItem('session_expires');
      if (expires) {
        const expiresAt = new Date(expires);
        const now = new Date();
        const minutesLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

        // Auto-extend if user has been actively working (transcript or note content exists)
        if (minutesLeft < 10 && (transcript.length > 0 || processedNote.length > 0)) {
          extendSession('auto-extend-active-work');
        }
        // Show warning for empty sessions only
        else if (minutesLeft < 5 && minutesLeft > 0 && !transcript && !processedNote) {
          if (window.confirm('Your session will expire in less than 5 minutes. Click OK to extend your session.')) {
            extendSession('manual-extension');
          }
        }
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(sessionCheck);
    };
  }, [isRecording, transcript, processedNote]);

  // Load doctor's specialty from localStorage and set in specialty service
  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.specialty) {
          // Set the doctor in the specialty service
          const doctor = {
            id: user.id || 'default',
            name: user.name || 'Doctor',
            specialty: user.specialty as DoctorSpecialty
          };
          specialtyService.setCurrentDoctor(doctor);
          
          // Format specialty for display
          const displaySpecialty = user.specialty === 'endocrinology' ? 'Endocrinology' :
                                 user.specialty === 'psychiatry' ? 'Psychiatry' :
                                 user.specialty === 'nutrition' ? 'Nutrition' : 
                                 user.specialty;
          setDoctorSpecialty(displaySpecialty);
          logDebug('MedicalDictation', 'Debug message', {});
        }
      } catch (error) {
        logError('MedicalDictation', 'Error message', {});
      }
    }
  }, []);

  // Initialize HIPAA-compliant speech services
  useEffect(() => {
    logDebug('MedicalDictation', 'Initializing speech services...');

    // Check if speech services are available
    if (!speechServiceRouter.isAnyServiceAvailable()) {
      setRecordingError('HIPAA-compliant speech services are not configured. Please contact administrator.');
      logWarn('MedicalDictation', 'No speech services available');
      return;
    }

    logInfo('MedicalDictation', 'Speech services initialized successfully');
    logDebug('MedicalDictation', 'Service status:', speechServiceRouter.getServiceStatus());

    return () => {
      // Cleanup will be handled by individual services
      logDebug('MedicalDictation', 'Component unmounting, cleaning up services');
    };
  }, []);

  // Monitor audio level while recording
  useEffect(() => {
    if (!isRecording) {
      setAudioLevel(0);
      return;
    }

    const audioLevelInterval = setInterval(() => {
      try {
        const service = speechServiceRouter.getStreamingService();
        if (service && typeof (service as any).getAudioLevel === 'function') {
          const level = (service as any).getAudioLevel();
          setAudioLevel(level);

          // Warn if no audio detected after 5 seconds
          if (level < 5 && isRecording) {
            const recordingDuration = Date.now() - (window as any)._recordingStartTime || 0;
            if (recordingDuration > 5000) {
              logWarn('MedicalDictation', 'Very low audio level detected - microphone may not be working');
            }
          }
        }
      } catch (error) {
        logWarn('MedicalDictation', `Error getting audio level: ${error}`);
      }
    }, 100); // Update every 100ms for smooth visualization

    // Store recording start time
    (window as any)._recordingStartTime = Date.now();

    return () => {
      clearInterval(audioLevelInterval);
      delete (window as any)._recordingStartTime;
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (isRecording) return;

    if (!recordingMode) {
      const message = 'Please select a recording mode (Dictation or Conversation) before starting.';
      setRecordingError(message);
      alert(message);
      return;
    }

    // Clear any previous errors
    setRecordingError('');

    try {
      logInfo('MedicalDictation', `Starting ${recordingMode} recording...`);

      const transcriptionStarted = await speechServiceRouter.startRecording(
        recordingMode === 'conversation' ? 'conversation' : 'dictation',
        {
          onTranscript: (text, isFinal) => {
            if (!text || text.trim().length === 0) {
              // Ignore empty transcripts
              return;
            }

            logDebug('MedicalDictation', `Transcript received: "${text}" (final: ${isFinal})`);
            const corrected = medicalCorrections.correctTranscription(text);

            if (!isFinal) {
              // Show partial results
              setInterimText(corrected);
            } else {
              // Append final results
              setTranscript(prev => {
                const updated = prev + (prev ? ' ' : '') + corrected;
                logDebug('MedicalDictation', `Updated transcript: ${updated.length} chars, ${updated.split(/\s+/).length} words`);
                return updated;
              });
              setInterimText('');
            }
          },
          onError: (error) => {
            logError('MedicalDictation', `Speech recognition error: ${error}`);

            // Parse and show user-friendly error
            let userMessage = 'Recording Error\n\n';

            if (typeof error === 'string') {
              // The error from deepgramAdapter already has user-friendly messages
              userMessage += error;
            } else {
              userMessage += 'An unexpected error occurred. Please try again.';
            }

            setRecordingError(userMessage);
            setIsRecording(false);

            // Show alert for critical errors
            if (error.includes('permission') || error.includes('microphone') || error.includes('Deepgram')) {
              alert(userMessage);
            }
          }
        }
      );

      if (transcriptionStarted) {
        setIsRecording(true);
        setRecordingError('');
        logInfo('MedicalDictation', `${recordingMode} recording started successfully`);
      } else {
        const errorMsg = 'Failed to start recording service. Please check your microphone and browser permissions.';
        setRecordingError(errorMsg);
        logError('MedicalDictation', errorMsg);
        alert(errorMsg);
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown error';
      logError('MedicalDictation', `Failed to start recording: ${errorMessage}`);

      // Show user-friendly error
      let userMessage = '❌ Failed to Start Recording\n\n';

      if (errorMessage.includes('Deepgram') || errorMessage.includes('VITE_DEEPGRAM_API_KEY')) {
        userMessage +=
          'The speech recognition service is not properly configured.\n\n' +
          'Please contact your system administrator.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('NotAllowed')) {
        userMessage +=
          'Microphone permission is required.\n\n' +
          'Please:\n' +
          '1. Click the microphone icon in your browser\'s address bar\n' +
          '2. Allow microphone access\n' +
          '3. Try recording again';
      } else if (errorMessage.includes('NotFound') || errorMessage.includes('No microphone')) {
        userMessage +=
          'No microphone was detected.\n\n' +
          'Please:\n' +
          '1. Connect a microphone\n' +
          '2. Check it\'s enabled in system settings\n' +
          '3. Refresh the page';
      } else if (errorMessage.includes('NotReadable') || errorMessage.includes('already in use')) {
        userMessage +=
          'Your microphone is being used by another application.\n\n' +
          'Please:\n' +
          '1. Close other apps using the microphone\n' +
          '2. Refresh this page\n' +
          '3. Try again';
      } else {
        userMessage += errorMessage + '\n\nPlease try again or contact support if the issue persists.';
      }

      setRecordingError(userMessage);
      alert(userMessage);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) {
      logDebug('MedicalDictation', 'Stop recording called but not currently recording');
      return;
    }

    logInfo('MedicalDictation', 'Stopping recording...');

    // Immediately set recording to false to update UI
    setIsRecording(false);

    // Stop the Speech Service Router
    try {
      speechServiceRouter.stopRecording();
      logDebug('MedicalDictation', 'Speech service stopped successfully');

      // Speech service router handles transcript internally
      // Final transcript is already set via callbacks
    } catch (error) {
      logError('MedicalDictation', `Error stopping speech service: ${error}`);
      setRecordingError('Failed to stop recording properly. Some audio may have been lost.');
    }

    // Build the final transcript including any interim text
    let finalTranscript = transcript;
    if (interimText.trim()) {
      const correctedText = medicalCorrections.correctTranscription(interimText);
      finalTranscript = transcript + (transcript ? ' ' : '') + correctedText;
      logDebug('MedicalDictation', `Added interim text: "${correctedText}"`);
    }

    // Always update transcript state with the final version
    if (finalTranscript !== transcript || interimText.trim()) {
      setTranscript(finalTranscript);
      setInterimText('');
    }

    // Check current transcript state
    logDebug('MedicalDictation', `Final transcript length: ${finalTranscript.length} characters`);
    logDebug('MedicalDictation', `Word count: ${finalTranscript.split(/\s+/).filter(w => w.length > 0).length}`);

    // Process with AI if we have any content (transcript or interim)
    if (finalTranscript.trim() || transcript.trim() || interimText.trim()) {
      logInfo('MedicalDictation', 'Audio captured successfully, processing with AI...');

      // Force update transcript if needed
      if (!finalTranscript.trim() && (transcript.trim() || interimText.trim())) {
        finalTranscript = transcript + (transcript && interimText ? ' ' : '') + interimText;
        setTranscript(finalTranscript);
      }

      // Pass the finalTranscript directly to avoid closure issues
      // Use setTimeout to ensure state updates have propagated
      setTimeout(() => {
        processWithAI(finalTranscript);
      }, 100);
    } else {
      // No audio was captured - show detailed error message
      logWarn('MedicalDictation', 'No audio captured during recording session');

      const errorMessage =
        '❌ No Audio Captured\n\n' +
        'Please check the following:\n\n' +
        '✓ Microphone is connected and turned on\n' +
        '✓ Browser has microphone permissions (check address bar)\n' +
        '✓ Microphone is not muted or volume is not at 0\n' +
        '✓ No other app is using the microphone\n' +
        '✓ You spoke clearly during recording\n\n' +
        'Tips:\n' +
        '• Click "Test Microphone" to verify your setup\n' +
        '• Try using the "Test Microphone" button before recording\n' +
        '• Refresh the page and allow microphone access when prompted';

      setRecordingError(errorMessage);
      alert(errorMessage);
    }
  };

  const processWithAI = async (transcriptToProcess?: string) => {
    // Use the passed transcript or fall back to state
    const contentToProcess = transcriptToProcess || transcript;
    logDebug('MedicalDictation', 'Starting AI processing', { transcriptLength: contentToProcess.length });

    if (!contentToProcess.trim()) {
      logError('MedicalDictation', 'No content to process');
      alert('Please record some content first');
      return;
    }

    // Clear previous errors
    setAiProcessingError('');
    setAiProcessingFailed(false);

    setIsProcessing(true);
    setShowProcessed(false);

    try {
      // Build patient context with previous visit if available
      const patientContext = `
PATIENT INFORMATION:
Name: ${patientDetails.name || '[Not provided]'}
MRN: ${patientDetails.mrn || '[Not provided]'}
DOB: ${patientDetails.dob || '[Not provided]'}
Email: ${patientDetails.email || '[Not provided]'}
Visit Date: ${patientDetails.visitDate}

${previousVisitNote ? `PREVIOUS VISIT NOTE:
${previousVisitNote}

INSTRUCTIONS: Create a comprehensive note that builds upon the previous visit. Include:
- Reference to previous conditions and their current status
- Trend analysis for chronic conditions
- Updated assessment incorporating historical context
- Continuity in the treatment plan` : ''}
      `.trim();

      // For dictation, include mode information
      const combinedContent = recordingMode === 'conversation' 
        ? `CONVERSATION TRANSCRIPT:\n${contentToProcess}`
        : contentToProcess;

      logDebug('MedicalDictation', 'Debug message', {});
      
      // Create minimal patient data for processing
      const minimalPatientData = {
        id: patientId || 'quick-note',
        name: patientDetails.name || 'Unknown Patient',
        mrn: patientDetails.mrn || 'Unknown MRN',
        dob: patientDetails.dob || '',
        email: patientDetails.email || '',
        diagnosis: [],
        medications: [],
        labResults: [],
        vitalSigns: {
          bp: '',
          hr: '',
          temp: '',
          weight: '',
          bmi: ''
        }
      };
      
      // Use selected template if available
      let templateInstructions = undefined;
      if (selectedTemplate) {
        // Provide default doctor settings to avoid Supabase auth query
        // This allows custom template sections to work while avoiding login redirects
        const defaultSettings = {
          aiStyle: 'formal' as const, // Use formal medical terminology
          defaultTemplates: {},
          preferences: {
            autoSave: true,
            showKeyboardShortcuts: true,
            theme: 'light' as const
          }
        };

        logInfo('MedicalDictation', 'Using selected template with default settings', {
          templateName: selectedTemplate.name,
          sectionCount: Object.keys(selectedTemplate.sections || {}).length
        });

        templateInstructions = {
          template: selectedTemplate,
          doctorSettings: defaultSettings
        };
      }

      const result = await azureAIService.processMedicalTranscription(
        combinedContent,
        minimalPatientData,
        null, // Legacy template parameter
        `Patient context: ${patientContext}`,
        templateInstructions // Pass custom template instructions
      );

      // Extract just the formatted note from the result
      const processedContent = result.formatted;

      // Extract orders if available
      if (result.extractedOrders) {
        setExtractedOrders(result.extractedOrders);
        logInfo('MedicalDictation', 'Extracted orders from note', {
          medications: result.extractedOrders.medications.length,
          labs: result.extractedOrders.labs.length,
          imaging: result.extractedOrders.imaging.length,
          priorAuths: result.extractedOrders.priorAuths.length,
          referrals: result.extractedOrders.referrals.length
        });
      } else {
        console.log('❌ No extractedOrders in result');
      }

      logDebug('MedicalDictation', 'Debug message', {});

      // Save version to history before updating current
      const newVersion: ProcessedNoteVersion = {
        id: `version-${Date.now()}`,
        timestamp: new Date(),
        processedContent: processedContent,
        templateUsed: selectedTemplate?.name || 'Standard SOAP Note',
        templateId: selectedTemplate?.id || null,
      };

      setProcessedNoteVersions(prev => [...prev, newVersion]);
      setProcessedNote(processedContent);
      setShowProcessed(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Set error state to show persistent error banner
      setAiProcessingFailed(true);
      setAiProcessingError(errorMessage);

      // Log detailed error for debugging
      logError('MedicalDictation', 'AI processing failed', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        transcript: contentToProcess.substring(0, 100) + '...',
        templateUsed: selectedTemplate?.name || 'No template',
        patientName: patientDetails.name || 'No patient name',
        timestamp: new Date().toISOString()
      });

      // Show detailed error modal
      const shouldRetry = confirm(
        `❌ AI Processing Failed\n\n${errorMessage}\n\nWould you like to try again?`
      );

      if (shouldRetry) {
        // User wants to retry manually
        setTimeout(() => processWithAI(contentToProcess), 500);
        return;
      } else {
        // User cancelled - keep error banner visible
        logInfo('MedicalDictation', 'User cancelled AI processing retry');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setTranscript('');
    setInterimText('');
    setProcessedNote('');
    setShowProcessed(false);
    setAiProcessingFailed(false);
    setAiProcessingError('');
    setExtractedOrders(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (error) {
      logError('MedicalDictation', 'Error message', {});
      alert('Failed to copy to clipboard');
    }
  };

  const saveToDatabase = async () => {
    if (!transcript && !processedNote) {
      alert('No content to save. Please dictate some notes first.');
      return;
    }

    // Patient name is now optional - will be saved with placeholder if missing
    const hasPatientName = patientDetails.name && patientDetails.name.trim() !== '';

    // Warn user if saving without patient name
    if (!hasPatientName) {
      const confirmSave = window.confirm(
        '⚠️ No Patient Name Entered\n\n' +
        'This note will be saved as "Unidentified Patient" and flagged for identification.\n\n' +
        'You can add the patient name later before finalizing the note.\n\n' +
        'Continue saving?'
      );
      if (!confirmSave) {
        return;
      }
    }

    setIsSavingToDatabase(true);

    try {
      const currentUser = unifiedAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const providerId = currentUser.id || currentUser.email || 'doctor-default-001';
      const providerName = currentUser.name || 'Dr. Provider';

      // Save the note to database using our new simplified service
      const noteId = await scheduleDatabaseService.saveNote(
        providerId,
        providerName,
        {
          patientName: patientDetails.name,
          patientMrn: patientDetails.mrn,
          patientEmail: patientDetails.email,
          patientPhone: patientDetails.phone,
          rawTranscript: transcript,
          aiProcessedNote: processedNote,
          recordingMode: recordingMode || 'dictation',
          isQuickNote: !patientId // true for QuickNote, false for regular dictation
        }
      );

      if (noteId) {
        // If this is a QuickNote, also add the patient to today's schedule
        if (!patientId) {
          await scheduleDatabaseService.addQuickNotePatientToSchedule(
            providerId,
            providerName,
            patientDetails.name,
            patientDetails.mrn
          );
        }

        setLastSavedNoteId(noteId.toString());
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 5000);

        logInfo('MedicalDictation', 'Info message', {});

        // Clear auto-save data since it's now permanently saved
        localStorage.removeItem('autosave_dictation');
      } else {
        throw new Error('Failed to save note - no ID returned');
      }

    } catch (error) {
      logError('MedicalDictation', 'Error message', {});
      alert(`Failed to save to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingToDatabase(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header with Patient Info */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          {/* Top Row - Title and Actions */}
          <div className="flex justify-between items-center py-2 border-b">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900">
                {patientId ? 'Patient Dictation' : 'Quick Note'}
              </h1>
              {doctorSpecialty && (
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  {doctorSpecialty}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                ← Dashboard
              </button>
              <button
                onClick={() => navigate('/staff-orders')}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                title="View all patient orders"
              >
                📋 Staff Orders
              </button>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Patient Information Section - Prominent at Top */}
          <div className="py-3 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Patient Information</h3>
              </div>
              {lastDatabaseSaveTime && (
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last saved: {lastDatabaseSaveTime.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Patient Name</label>
                <input
                  type="text"
                  value={patientDetails.name}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, name: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="Enter patient name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">MRN</label>
                <input
                  type="text"
                  value={patientDetails.mrn}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, mrn: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="Medical Record #"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  value={patientDetails.dob}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, dob: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Age</label>
                <input
                  type="text"
                  value={patientDetails.age !== null ? patientDetails.age : ''}
                  readOnly
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-medium bg-gray-100 text-gray-700"
                  placeholder="Auto-filled"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={patientDetails.email}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, email: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="patient@email.com"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={patientDetails.phone}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, phone: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600 font-medium">
              Visit Date: {patientDetails.visitDate}
            </div>
          </div>
        </div>
      </div>

      {/* AI Processing Error Banner - Persistent */}
      {aiProcessingFailed && aiProcessingError && (
        <div className="bg-red-50 border-b-2 border-red-400">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900">❌ AI Processing Failed</h3>
                <p className="text-xs text-red-800">
                  {aiProcessingError}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  <strong>What this means:</strong> Your dictation was recorded successfully, but the AI service could not process it into a structured note. The dictation transcript is safe and visible below.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => processWithAI(transcript)}
                  disabled={isProcessing}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                >
                  <Brain className="w-3 h-3 inline-block mr-1" />
                  Retry AI Processing
                </button>
                <button
                  onClick={() => {
                    setAiProcessingFailed(false);
                    setAiProcessingError('');
                  }}
                  className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Identification Warning Banner */}
      {(transcript || processedNote) && (!patientDetails.name || patientDetails.name.trim() === '') && (
        <div className="bg-yellow-50 border-b-2 border-yellow-400">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-900">⚠️ No Patient Name</h3>
                <p className="text-xs text-yellow-800">
                  This note is being auto-saved as "Unidentified Patient". Please add patient information before finalizing.
                  {databaseAutoSaveStatus === 'saved' && ' (Auto-saved to database with placeholder name)'}
                </p>
              </div>
              <button
                onClick={() => {
                  // Focus on patient name input
                  const nameInput = document.querySelector('input[placeholder="Enter patient name"]') as HTMLInputElement;
                  if (nameInput) {
                    nameInput.focus();
                    nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium"
              >
                Add Patient Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-save Status & Data Restored Notifications */}
      {showDataRestored && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-green-800">Work restored - continue where you left off!</span>
          </div>
        </div>
      )}

      {/* Database Save Success Notification */}
      {showSaveSuccess && (
        <div className="fixed top-16 right-4 z-50 animate-fade-in">
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7l2-3h12l2 3M4 7h16M12 11v4" />
            </svg>
            <span className="text-sm font-medium text-blue-800">
              ✅ Note saved to database! ID: {lastSavedNoteId?.slice(-8)} | Added to schedule
            </span>
          </div>
        </div>
      )}

      <div className="fixed top-4 left-4 z-40">
        {autoSaveStatus === 'saving' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm p-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
            <span className="text-xs text-blue-800">Saving...</span>
          </div>
        )}
        {autoSaveStatus === 'saved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm p-2 flex items-center gap-2">
            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-green-800">
              Saved {lastSaveTime ? lastSaveTime.toLocaleTimeString() : ''}
            </span>
          </div>
        )}
      </div>

      <div className="fixed top-4 right-4 z-40">
        {databaseAutoSaveStatus === 'saving' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg shadow-sm p-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
            <span className="text-xs text-purple-800">Saving to database...</span>
          </div>
        )}
        {databaseAutoSaveStatus === 'saved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm p-2 flex items-center gap-2">
            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-green-800">
              📊 Database saved {lastDatabaseSaveTime ? lastDatabaseSaveTime.toLocaleTimeString() : ''}
            </span>
          </div>
        )}
        {databaseAutoSaveStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-2 flex items-center gap-2">
            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-xs text-red-800">Database save failed</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Compact Top Control Bar with Mode Selection and Recording Controls */}
        <div className="bg-white rounded-lg shadow-md p-3 mb-4 border-2 border-blue-200">
          <div className="flex items-center justify-between gap-4">
            {/* Mode Selection - Compact but Prominent */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-700">MODE:</span>
              <button
                onClick={() => {
                  setRecordingMode('dictation');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  recordingMode === 'dictation'
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🎤 DICTATION
              </button>
              <button
                onClick={() => {
                  setRecordingMode('conversation');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  recordingMode === 'conversation'
                    ? 'bg-purple-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                👥 CONVERSATION
              </button>
            </div>

            {/* Recording and Process Controls - Moved to Top */}
            <div className="flex items-center gap-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || !recordingMode}
                className={`px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2 text-lg shadow-lg ${
                  !recordingMode
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : isProcessing
                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                    : isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-4 ring-red-300'
                    : 'bg-green-500 hover:bg-green-600 text-white ring-2 ring-green-300'
                }`}
              >
                {isRecording ? '⏹ STOP RECORDING' : '🎙️ START RECORDING'}
              </button>

              {/* Audio Level Indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-green-400">
                  <span className="text-xs font-semibold text-gray-700">AUDIO:</span>
                  <div className="w-24 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        audioLevel < 10
                          ? 'bg-red-500'
                          : audioLevel < 50
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((audioLevel / 255) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-600">{audioLevel}</span>
                </div>
              )}

              <button
                onClick={() => processWithAI()}
                disabled={!transcript.trim() || isProcessing}
                className="px-6 py-3 bg-blue-600 text-white text-base font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg"
              >
                {isProcessing ? '⏳ PROCESSING...' : '🤖 PROCESS WITH AI'}
              </button>

              <button
                onClick={saveToDatabase}
                disabled={(!transcript.trim() && !processedNote.trim()) || isSavingToDatabase}
                className="px-6 py-3 bg-green-600 text-white text-base font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg"
                title={patientDetails.name.trim() ? "Save note and create appointment in database" : "Save note (patient name will be required before finalizing)"}
              >
                {isSavingToDatabase ? '💾 SAVING...' : '💾 SAVE TO DATABASE'}
              </button>

              {/* Enroll in PCM Button - Show if we have processed content or extracted orders */}
              {(() => {
                console.log('🔍 ENROLL IN PCM Button Check:', {
                  showProcessed,
                  hasExtractedOrders: !!extractedOrders,
                  shouldShow: showProcessed || extractedOrders
                });
                return null;
              })()}
              {(showProcessed || extractedOrders) && (
                <button
                  onClick={() => {
                    // Navigate to PCM enrollment with pre-filled patient data and extracted orders
                    const params: Record<string, string> = {
                      name: patientDetails.name || 'Unidentified Patient',
                      phone: patientDetails.phone || '',
                      email: patientDetails.email || '',
                      mrn: patientDetails.mrn || '',
                      age: patientDetails.age?.toString() || '',
                      fromDictation: 'true',
                      hasOrders: extractedOrders ? 'true' : 'false',
                      medicationCount: extractedOrders?.medications.length.toString() || '0',
                      labCount: extractedOrders?.labs.length.toString() || '0'
                    };

                    // Pass clinical note for PCM data extraction (baseline values and goals)
                    const clinicalNoteText = processedNote || transcript;
                    if (clinicalNoteText.trim()) {
                      params.clinicalNote = encodeURIComponent(clinicalNoteText);
                    }

                    // If we have extracted orders, pass them as JSON
                    if (extractedOrders) {
                      params.extractedOrders = encodeURIComponent(JSON.stringify(extractedOrders));
                    }

                    const queryParams = new URLSearchParams(params);
                    navigate(`/pcm-patient-setup?${queryParams.toString()}`);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white text-base font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg"
                  title="Enroll this patient in PCM (Principal Care Management) program and auto-create orders"
                >
                  <User className="w-5 h-5" />
                  ENROLL IN PCM
                  {extractedOrders && (
                    <span className="px-2 py-0.5 bg-white text-blue-600 rounded-full text-xs font-bold">
                      +{(extractedOrders.medications.length + extractedOrders.labs.length +
                        extractedOrders.imaging.length + extractedOrders.priorAuths.length +
                        extractedOrders.referrals.length)} orders
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={clearAll}
                className="px-4 py-3 bg-red-100 text-red-700 text-base font-bold rounded-lg hover:bg-red-200 transition shadow"
                title="Clear All"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        </div>

        {/* Template selector removed - using the one in left column instead */}

        {/* Two Column Layout - 40% | 60% */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
          {/* Left Column - Previous Visit & Template */}
          <div className="space-y-4">
            {/* Previous Visit Note */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-md font-semibold text-gray-800 mb-2">
                📋 Previous Visit Note
              </h2>
              <textarea
                value={previousVisitNote}
                onChange={(e) => setPreviousVisitNote(e.target.value)}
                placeholder="Paste previous visit note from EMR here..."
                className="w-full h-20 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="mt-2 text-xs text-gray-500">
                This will be used to create continuity with today's visit
              </div>
            </div>

            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Change Template
              </h2>
              
              <button
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className="w-full px-3 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="text-sm">
                  {selectedTemplate ? selectedTemplate.name : 'No Template Selected'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showTemplateSelector ? 'rotate-180' : ''}`} />
              </button>

              {showTemplateSelector && (
                <div className="mt-2 border rounded-lg max-h-96 overflow-y-auto">
                  {/* No Template Option */}
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateSelector(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b"
                  >
                    No Template (Standard SOAP)
                  </button>

                  {/* Recent Templates */}
                  {recentTemplates.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Recent
                      </div>
                      {recentTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowTemplateSelector(false);
                            doctorProfileService.addToRecent(template.id);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm border-b flex items-center justify-between"
                        >
                          <span>{template.name}</span>
                          {template.visitType && (
                            <span className="text-xs text-gray-500">{template.visitType}</span>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Favorite Templates */}
                  {favoriteTemplates.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Favorites
                      </div>
                      {favoriteTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowTemplateSelector(false);
                            doctorProfileService.addToRecent(template.id);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-yellow-50 text-sm border-b flex items-center justify-between"
                        >
                          <span>{template.name}</span>
                          {template.visitType && (
                            <span className="text-xs text-gray-500">{template.visitType}</span>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Templates Organized by Specialty */}
                  {templates.length > 0 ? (() => {
                    // Group templates by specialty based on name prefixes
                    const specialtyGroups = {
                      'Endocrinology': templates.filter(t => t.name.includes('Endo -') || t.name.includes('Diabetes') || t.name.includes('Thyroid') || t.name.includes('Tess') || t.name.includes('Elina') || t.name.includes('Radha') || t.name.includes('Shannon')),
                      'Primary Care': templates.filter(t => t.name.includes('Primary Care -') || t.name.includes('Quick Progress') || t.name.includes('Annual')),
                      'Sports Medicine': templates.filter(t => t.name.includes('Sports Med -')),
                      'Psychiatry': templates.filter(t => t.name.includes('Psychiatry') || t.name.includes('Nikki') || t.name.includes('Ghislaine')),
                      'Nutrition': templates.filter(t => t.name.includes('Nutrition') || t.name.includes('Vanessa')),
                      'General/Other': templates.filter(t =>
                        !t.name.includes('Endo -') &&
                        !t.name.includes('Primary Care -') &&
                        !t.name.includes('Sports Med -') &&
                        !t.name.includes('Diabetes') &&
                        !t.name.includes('Thyroid') &&
                        !t.name.includes('Psychiatry') &&
                        !t.name.includes('Nutrition') &&
                        !t.name.includes('Tess') &&
                        !t.name.includes('Nikki') &&
                        !t.name.includes('Vanessa') &&
                        !t.name.includes('Elina') &&
                        !t.name.includes('Radha') &&
                        !t.name.includes('Shannon') &&
                        !t.name.includes('Ghislaine') &&
                        !t.name.includes('Quick Progress') &&
                        !t.name.includes('Annual')
                      )
                    };

                    return Object.entries(specialtyGroups).map(([specialty, specialtyTemplates]) => {
                      if (specialtyTemplates.length === 0) return null;

                      return (
                        <div key={specialty}>
                          <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center gap-2">
                            {specialty === 'Endocrinology' && '🩺'}
                            {specialty === 'Primary Care' && '👩‍⚕️'}
                            {specialty === 'Sports Medicine' && '🏃‍♂️'}
                            {specialty === 'Psychiatry' && '🧠'}
                            {specialty === 'Nutrition' && '🥗'}
                            {specialty === 'General/Other' && '📝'}
                            {specialty} ({specialtyTemplates.length})
                          </div>
                          {specialtyTemplates.map(template => (
                            <button
                              key={template.id}
                              onClick={() => {
                                setSelectedTemplate(template);
                                setShowTemplateSelector(false);
                                doctorProfileService.addToRecent(template.id);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b flex items-center justify-between"
                            >
                              <span className="text-gray-800">{template.name}</span>
                              <div className="flex items-center gap-2">
                                {template.visitType && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {template.visitType}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    }).filter(Boolean);
                  })() : (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      No templates created yet.
                      <button
                        onClick={() => navigate('/doctor/templates')}
                        className="block w-full mt-2 text-blue-600 hover:text-blue-700"
                      >
                        Create your first template →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedTemplate && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  Using: {selectedTemplate.name}
                </div>
              )}
            </div>

            {/* Transcript Display */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-md font-semibold text-gray-800 mb-3">
                📝 Transcript
              </h2>

              {/* Error Display */}
              {recordingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{recordingError}</p>
                </div>
              )}

              {/* Transcript Display / Paste Area */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {recordingMode === 'conversation' ? 'Conversation Transcript:' : 'Dictation Transcript:'}
                </h3>
                <textarea
                  value={transcript + (interimText ? interimText : '')}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={isRecording ? 'Listening...' : 'Click "Start Recording" to begin, or paste your transcript here...'}
                  className="w-full min-h-[200px] max-h-[300px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-white"
                  disabled={isRecording}
                />
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  You can type or paste transcripts directly into this field, then click "Process with AI" below
                </div>
              </div>

            </div>
          </div>

          {/* Right Column - Processed Super Note */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  📝 Processed Clinical Note
                  {previousVisitNote && (
                    <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      + History
                    </span>
                  )}
                </h2>
                {showProcessed && (
                  <div className="flex gap-2">
                    {processedNoteVersions.length > 1 && (
                      <button
                        onClick={() => setShowVersionHistory(!showVersionHistory)}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1"
                      >
                        📚 Versions ({processedNoteVersions.length})
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(processedNote.replace(/###\s*/g, '').replace(/\*\*(.*?)\*\*/g, '$1'))}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => {
                        const printContent = processedNote.replace(/###\s*/g, '').replace(/\*\*(.*?)\*\*/g, '$1');
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Medical Note - ${patientDetails.name || 'Patient'}</title>
                                <style>
                                  body { font-family: Arial, sans-serif; padding: 20px; white-space: pre-wrap; }
                                  @media print { body { padding: 10px; } }
                                </style>
                              </head>
                              <body>${printContent.replace(/\n/g, '<br>')}</body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={() => {
                        console.log('🔥 ECHO: Opening Audio Summary Modal');
                        setShowAudioSummaryModal(true);
                      }}
                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold"
                      style={{ backgroundColor: '#9333ea' }}
                    >
                      📞 Send Patient Summary (ECHO)
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4 min-h-[700px] max-h-[800px] overflow-y-auto bg-gradient-to-br from-white to-blue-50">
                {showProcessed && processedNote ? (
                  <NoteFormatter content={processedNote} />
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Processed note will appear here after clicking "Process with AI"
                  </p>
                )}
              </div>
            </div>

            {/* Orders for Staff Section */}
            {extractedOrders && showProcessed && (
              <OrdersDisplay
                orders={extractedOrders}
                patientName={patientDetails.name}
                onCopyOrders={(ordersText) => {
                  logInfo('MedicalDictation', 'Orders copied to clipboard', {
                    patientName: patientDetails.name
                  });
                }}
              />
            )}

            {/* Version History Panel */}
            {showVersionHistory && processedNoteVersions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4 border-2 border-purple-300">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-semibold text-purple-900 flex items-center gap-2">
                    📚 Processing History ({processedNoteVersions.length} versions)
                  </h3>
                  <button
                    onClick={() => setShowVersionHistory(false)}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Hide
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {processedNoteVersions.slice().reverse().map((version, index) => {
                    const versionNumber = processedNoteVersions.length - index;
                    const isCurrentVersion = version.processedContent === processedNote;

                    return (
                      <div
                        key={version.id}
                        className={`p-3 rounded-lg border ${
                          isCurrentVersion
                            ? 'bg-purple-50 border-purple-400 border-2'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`text-sm font-bold ${isCurrentVersion ? 'text-purple-900' : 'text-gray-700'}`}>
                              Version {versionNumber} {isCurrentVersion && '(Current)'}
                            </span>
                            <p className="text-xs text-gray-600 mt-1">
                              Template: {version.templateUsed}
                            </p>
                            <p className="text-xs text-gray-500">
                              {version.timestamp.toLocaleString()}
                            </p>
                          </div>
                          {!isCurrentVersion && (
                            <button
                              onClick={() => {
                                setProcessedNote(version.processedContent);
                                setShowVersionHistory(false);
                              }}
                              className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                              Load This Version
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-700 bg-white p-2 rounded border max-h-32 overflow-y-auto">
                          {version.processedContent.substring(0, 200)}
                          {version.processedContent.length > 200 && '...'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  💡 Tip: You can process with AI multiple times using different templates. Each version is saved here.
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Audio Summary Modal */}
      <AudioSummaryModal
        soapNote={processedNote}
        patientName={patientDetails.name}
        isOpen={showAudioSummaryModal}
        onClose={() => setShowAudioSummaryModal(false)}
      />
    </div>
  );
}