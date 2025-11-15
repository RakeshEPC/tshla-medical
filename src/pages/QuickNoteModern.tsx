import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { speechServiceRouter } from '../services/speechServiceRouter.service';
import { azureAIService } from '../services/azureAI.service';
import { medicalCorrections } from '../services/medicalCorrections.service';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { 
  Mic, 
  MicOff, 
  Brain, 
  Sparkles, 
  User, 
  Calendar, 
  Mail, 
  FileText, 
  Copy, 
  Download,
  ArrowLeft,
  Play,
  Square,
  Zap,
  Heart,
  Star,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import '../styles/modernUI.css';
import '../styles/quicknote-calm.css';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import { retryStrategyService } from '../services/retryStrategy.service';
import { classifyError, formatErrorForUser } from '../services/aiErrors';
import { NoteQualityRating, type QualityRating as QualityRatingType } from '../components/NoteQualityRating';
import { noteQualityRatingService } from '../services/noteQualityRating.service';
import { analyticsDatabaseService } from '../services/analyticsDatabase.service';

interface PatientDetails {
  name: string;
  mrn: string;
  dob: string;
  email: string;
  visitDate: string;
}

export default function QuickNoteModern() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [processedNote, setProcessedNote] = useState('');
  const [editableNote, setEditableNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'analyzing' | 'structuring' | 'validating' | 'complete' | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showProcessed, setShowProcessed] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState<{ current: number; max: number; reason: string } | null>(null);
  const [qualityRating, setQualityRating] = useState<{
    quality: 'excellent' | 'good' | 'poor';
    confidence: number;
    issues: string[];
  } | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [recordingMode, setRecordingMode] = useState<'dictation' | 'conversation'>('dictation');
  const [selectedTemplate, setSelectedTemplate] = useState<DoctorTemplate | null>(null);
  const [templates, setTemplates] = useState<DoctorTemplate[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<DoctorTemplate | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [patientDetails, setPatientDetails] = useState<PatientDetails>({
    name: '',
    mrn: '',
    dob: '',
    email: '',
    visitDate: new Date().toLocaleDateString()
  });

  const [wordCount, setWordCount] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Microphone testing
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micTestResult, setMicTestResult] = useState<{
    success: boolean;
    message: string;
    deviceName?: string;
  } | null>(null);

  // Note metadata for quality rating
  const [noteMetadata, setNoteMetadata] = useState<{
    noteId: string;
    promptVersionId?: string;
    modelUsed?: string;
  } | null>(null);

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const result = await unifiedAuthService.getCurrentUser();
      if (result.success && result.user) {
        setCurrentUser(result.user);
      }
    };
    loadUser();
  }, []);

  // Load templates when user is ready
  useEffect(() => {
    if (currentUser) {
      loadTemplates();
    }
  }, [currentUser]);

  // Update word count
  useEffect(() => {
    const words = transcript.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [transcript]);

  // Recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const loadTemplates = async () => {
    if (!currentUser) return;

    try {
      const doctorId = currentUser.authUserId || currentUser.id || currentUser.email || 'doctor-default-001';

      doctorProfileService.initialize(doctorId);
      const allTemplates = await doctorProfileService.getTemplates(doctorId);
      setTemplates(allTemplates);

      const defaultTemplate = await doctorProfileService.getDefaultTemplate(undefined, doctorId);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      logError('QuickNoteModern', 'Error loading templates', { error });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const testMicrophone = async () => {
    setIsTesting(true);
    setMicTestResult(null);
    setAudioLevel(0);

    try {
      logInfo('QuickNoteModern', 'Starting microphone test...');

      // Request microphone access and measure audio levels
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Get device information
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const currentDevice = audioInputs.find(device =>
        stream.getAudioTracks()[0].label === device.label
      ) || audioInputs[0];

      logInfo('QuickNoteModern', `Microphone detected: ${currentDevice?.label}`);

      // Create audio context to measure levels
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;

      // Measure audio for 3 seconds
      const measureInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const level = Math.floor((average / 255) * 100);
        setAudioLevel(level);

        if (level > maxLevel) {
          maxLevel = level;
        }
      }, 100);

      // Stop after 3 seconds
      setTimeout(() => {
        clearInterval(measureInterval);

        // Clean up
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();

        // Evaluate results
        if (maxLevel < 5) {
          setMicTestResult({
            success: false,
            message: 'No audio detected. Please check if microphone is muted or volume is too low.',
            deviceName: currentDevice?.label
          });
        } else if (maxLevel < 20) {
          setMicTestResult({
            success: true,
            message: 'Microphone working but audio level is low. Try speaking louder.',
            deviceName: currentDevice?.label
          });
        } else {
          setMicTestResult({
            success: true,
            message: 'Microphone is working perfectly!',
            deviceName: currentDevice?.label
          });
        }

        setIsTesting(false);
        setAudioLevel(0);

        logInfo('QuickNoteModern', `Microphone test complete. Max level: ${maxLevel}`);
      }, 3000);

    } catch (error: any) {
      logError('QuickNoteModern', `Microphone test failed: ${error.message}`);

      let errorMessage = 'Microphone test failed. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Permission denied. Please allow microphone access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Microphone is being used by another application.';
      } else {
        errorMessage += error.message;
      }

      setMicTestResult({
        success: false,
        message: errorMessage
      });

      setIsTesting(false);
      setAudioLevel(0);
    }
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      logDebug('QuickNoteModern', 'Starting recording with Deepgram via speechServiceRouter');

      const transcriptionStarted = await speechServiceRouter.startRecording(
        recordingMode,
        {
          onTranscript: (text, isFinal) => {
            const corrected = medicalCorrections.correctTranscription(text);

            if (!isFinal) {
              setInterimText(corrected);
            } else {
              setTranscript(prev => {
                const updated = prev + (prev ? ' ' : '') + corrected;
                return updated;
              });
              setInterimText('');
            }
          },
          onError: (error) => {
            logError('QuickNoteModern', `Recording error: ${error}`);
            setRecordingError(`Error: ${error}`);
            setIsRecording(false);
          },
          onEnd: () => {
            logInfo('QuickNoteModern', 'Recording ended');
          }
        }
      );

      if (transcriptionStarted) {
        setIsRecording(true);
        setRecordingError('');
      } else {
        setRecordingError('Failed to start recording');
      }
    } catch (error) {
      logError('QuickNoteModern', `Failed to start recording: ${error}`);
      setRecordingError('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);

    try {
      speechServiceRouter.stopRecording();

      let completeTranscript = transcript;
      if (interimText.trim()) {
        const correctedText = medicalCorrections.correctTranscription(interimText);
        completeTranscript = transcript + (transcript ? ' ' : '') + correctedText;
        setTranscript(completeTranscript);
        setInterimText('');
      }

      // Auto-process with AI after recording stops
      if (completeTranscript.trim()) {
        setTimeout(() => {
          processWithAI(completeTranscript);
        }, 500);
      }
    } catch (error) {
      logError('QuickNoteModern', `Failed to stop recording: ${error}`);
    }
  };

  const processWithAI = async (transcriptToProcess?: string) => {
    const contentToProcess = transcriptToProcess || transcript;

    if (!contentToProcess.trim()) {
      alert('Please record some content first');
      return;
    }

    // Track template usage to update "last used" timestamp
    if (selectedTemplate) {
      try {
        await doctorProfileService.trackTemplateUsage(selectedTemplate.id);
        logInfo('QuickNoteModern', 'Template usage tracked', { templateId: selectedTemplate.id });
      } catch (error) {
        logWarn('QuickNoteModern', 'Failed to track template usage', { error });
        // Don't block AI processing if tracking fails
      }
    }

    setIsProcessing(true);
    setShowProcessed(false);
    setProcessingStage('analyzing');
    setProcessingProgress(0);

    // Simulate progress stages with realistic timing
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 95) return 95; // Cap at 95% until actually done
        return prev + 5;
      });
    }, 300);

    try {
      // Stage 1: Analyzing (0-30%)
      setProcessingStage('analyzing');
      await new Promise(resolve => setTimeout(resolve, 500));
      const patientContext = `
PATIENT INFORMATION:
Name: ${patientDetails.name || '[Not provided]'}
MRN: ${patientDetails.mrn || '[Not provided]'}
DOB: ${patientDetails.dob || '[Not provided]'}
Email: ${patientDetails.email || '[Not provided]'}
Visit Date: ${patientDetails.visitDate}
      `.trim();

      const combinedContent = recordingMode === 'conversation'
        ? `CONVERSATION TRANSCRIPT:\n${contentToProcess}`
        : contentToProcess;

      // Stage 2: Structuring (30-70%)
      setProcessingStage('structuring');

      const minimalPatientData = {
        id: 'quick-note-modern',
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
      
      let templateInstructions = undefined;
      logDebug('QuickNoteModern', 'Checking for selected template');
      if (selectedTemplate) {
        logInfo('QuickNoteModern', `Using template: ${selectedTemplate.name}`);
        try {
          const settings = await doctorProfileService.getSettings();
          templateInstructions = {
            template: selectedTemplate,
            doctorSettings: settings
          };
          logInfo('QuickNoteModern', 'Template instructions prepared with doctor settings');
        } catch (error) {
          templateInstructions = {
            template: selectedTemplate,
            doctorSettings: null
          };
          logDebug('QuickNoteModern', 'Using template without doctor settings');
        }
      } else {
        logDebug('QuickNoteModern', 'No template selected, using default SOAP format');
      }

      // Wrap AI processing with intelligent retry mechanism
      const result = await retryStrategyService.executeWithRetry(
        async () => {
          return await azureAIService.processMedicalTranscription(
            combinedContent,
            minimalPatientData,
            null,
            `Patient context: ${patientContext}`,
            templateInstructions
          );
        },
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 20000,
          exponentialBase: 2,
          jitterMax: 1000
        },
        (retryInfo) => {
          // Show retry information to user
          setRetryAttempt({
            current: retryInfo.attemptNumber,
            max: retryInfo.totalAttempts,
            reason: retryInfo.reason
          });
          setProcessingStage('analyzing'); // Reset to analyzing during retry
          logInfo('QuickNoteModern', `Retry attempt ${retryInfo.attemptNumber}/${retryInfo.totalAttempts}`, {
            delay: retryInfo.delayMs,
            reason: retryInfo.reason
          });
        }
      );

      // Stage 3: Validating (70-95%)
      setProcessingStage('validating');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stage 4: Complete (95-100%)
      setProcessingStage('complete');
      setProcessingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));

      const processedContent = result.formatted;
      setProcessedNote(processedContent);
      setEditableNote(processedContent);
      setShowProcessed(true);

      // Extract quality rating if available
      if (result.qualityCheck) {
        setQualityRating({
          quality: result.qualityCheck.quality,
          confidence: result.qualityCheck.confidence,
          issues: result.qualityCheck.issues
        });
      } else {
        // Default quality for successful processing
        setQualityRating({
          quality: 'good',
          confidence: 0.85,
          issues: []
        });
      }

      // Capture note metadata for quality rating
      setNoteMetadata({
        noteId: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        promptVersionId: result.metadata?.promptVersionId,
        modelUsed: result.metadata?.model
      });

      clearInterval(progressInterval);
    } catch (error) {
      clearInterval(progressInterval);
      logError('QuickNoteModern', 'AI processing failed after retries', { error });

      // Use classified error for user-friendly message
      const classifiedError = classifyError(error);
      const userFriendlyMessage = formatErrorForUser(classifiedError);

      // Show detailed error modal instead of basic alert
      const shouldRetry = confirm(
        `${userFriendlyMessage}\n\nWould you like to try again?`
      );

      if (shouldRetry) {
        // User wants to retry manually
        setTimeout(() => processWithAI(transcript), 500);
        return;
      }
    } finally {
      setIsProcessing(false);
      setProcessingStage(null);
      setProcessingProgress(0);
      setRetryAttempt(null);
    }
  };

  const copyToClipboard = async (text?: string) => {
    try {
      const textToCopy = text || editableNote;
      await navigator.clipboard.writeText(textToCopy.replace(/###\s*/g, '').replace(/\*\*(.*?)\*\*/g, '$1'));
      
      // Show a simple notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 notification-calm';
      notification.innerHTML = '✓ Copied to clipboard';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) document.body.removeChild(notification);
      }, 2000);
    } catch (error) {
      logError('QuickNoteModern', 'Error message', {});
      alert('Failed to copy to clipboard');
    }
  };

  const handleQualityRating = async (rating: QualityRatingType) => {
    try {
      // Save to localStorage
      const ratingId = noteQualityRatingService.submitRating(
        rating,
        currentUser?.id || currentUser?.email,
        patientDetails.mrn || undefined
      );

      logInfo('QuickNoteModern', 'Quality rating submitted', { ratingId });

      // Also save to database if available
      try {
        await analyticsDatabaseService.saveQualityRating(
          rating,
          currentUser?.id || currentUser?.email,
          patientDetails.mrn || undefined
        );
        logInfo('QuickNoteModern', 'Quality rating saved to database');
      } catch (dbError) {
        logWarn('QuickNoteModern', 'Failed to save rating to database (will retry later)', { dbError });
      }
    } catch (error) {
      logError('QuickNoteModern', 'Failed to submit quality rating', { error });
    }
  };

  const clearAll = () => {
    setTranscript('');
    setInterimText('');
    setProcessedNote('');
    setEditableNote('');
    setShowProcessed(false);
    setIsEditingNote(false);
    setWordCount(0);
    setRecordingDuration(0);
    setQualityRating(null);
    setNoteMetadata(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <div className="absolute -top-4 -left-4 w-96 h-96 bg-blue-200 rounded-full filter blur-3xl opacity-40"></div>
        <div className="absolute -bottom-4 -right-4 w-96 h-96 bg-indigo-200 rounded-full filter blur-3xl opacity-40"></div>
      </div>

      {/* Header */}
      <div className="glass-card-calm mx-4 mt-4 p-4 relative z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/doctor')}
              className="glass-button p-2 rounded-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-calm-gradient flex items-center gap-2">
                <Zap className="w-6 h-6" />
                Quick Note
              </h1>
              <p className="text-sm text-gray-600">
                Welcome, {currentUser?.name || 'Doctor'}
              </p>
            </div>
          </div>
          
          {/* Recording Stats */}
          <div className="flex items-center gap-4">
            <div className="status-indicator status-ready">
              📝 {wordCount} words
            </div>
            <div className="status-indicator status-ready">
              ⏱️ {formatDuration(recordingDuration)}
            </div>
            <button
              onClick={() => {
                unifiedAuthService.logout();
                navigate('/login');
              }}
              className="btn-calm btn-calm-danger px-4 py-2 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          
          {/* Left Column - Recording & Patient */}
          <div className="space-y-6">

            {/* Template Selection - Top Priority Position */}
            <div className="glass-card-calm p-6 card-hover-calm template-selector-prominent">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Note Template
                  {selectedTemplate && (
                    <span className="ml-2 text-xs px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full shadow-sm animate-fade-in">
                      ✓ Active
                    </span>
                  )}
                </h3>
                {selectedTemplate && (
                  <button
                    onClick={() => {
                      setPreviewTemplate(selectedTemplate);
                      setShowTemplatePreview(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                    title="Preview template structure"
                  >
                    Preview Sections
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className={`glass-button w-full p-4 rounded-lg text-left flex items-center justify-between hover:scale-[1.02] transition-all shadow-sm ${
                  selectedTemplate ? 'border-2 border-blue-500 bg-blue-50 bg-opacity-50' : 'border border-gray-300'
                }`}
                title="Click to change template"
              >
                <div className="flex-1">
                  <div className="font-semibold text-base">
                    {selectedTemplate ? selectedTemplate.name : 'Default SOAP Note'}
                  </div>
                  {selectedTemplate && selectedTemplate.description && (
                    <div className="text-xs text-gray-700 mt-1 line-clamp-2">
                      {selectedTemplate.description}
                    </div>
                  )}
                  {selectedTemplate && selectedTemplate.specialty && (
                    <div className="text-xs text-blue-600 mt-1 font-medium">
                      📋 {selectedTemplate.specialty}
                    </div>
                  )}
                  {!selectedTemplate && (
                    <div className="text-xs text-gray-600 mt-1">
                      Standard SOAP format • Click to select a custom template
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 ml-2 transition-transform ${showTemplateSelector ? 'rotate-180' : ''}`} />
              </button>

              {showTemplateSelector && (
                <div className="mt-3 glass-card p-3 max-h-72 overflow-y-auto modern-scrollbar slide-in-right border border-gray-200 shadow-lg">
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateSelector(false);
                    }}
                    className={`w-full p-3 text-left hover:bg-blue-50 rounded-lg text-sm mb-2 transition-all ${
                      !selectedTemplate ? 'bg-blue-100 border-2 border-blue-500 shadow-sm' : 'border border-gray-200 bg-white'
                    }`}
                  >
                    <div className="font-semibold flex items-center justify-between">
                      <span>Default SOAP Note</span>
                      {!selectedTemplate && (
                        <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Standard SOAP Note Format</div>
                  </button>

                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplateSelector(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-blue-50 rounded-lg text-sm mb-2 transition-all group ${
                        selectedTemplate?.id === template.id ? 'bg-blue-100 border-2 border-blue-500 shadow-sm' : 'border border-gray-200 bg-white'
                      }`}
                      title={`Click to use ${template.name}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setPreviewTemplate(template);
                        setShowTemplatePreview(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{template.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTemplate(template);
                              setShowTemplatePreview(true);
                            }}
                            className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                            title="Preview this template"
                          >
                            👁️
                          </button>
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <div className="text-xs text-gray-700 mt-1 group-hover:text-gray-900">{template.description}</div>
                      )}
                      {template.specialty && (
                        <div className="text-xs text-blue-600 mt-1 font-medium">
                          📋 {template.specialty}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {Object.values(template.sections).length} sections • {Object.values(template.sections).filter(s => s.required).length} required
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recording Mode Selection */}
            <div className="glass-card-calm p-6 card-hover-calm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Recording Mode
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRecordingMode('dictation')}
                  className={`p-4 rounded-xl transition-all duration-300 ${
                    recordingMode === 'dictation'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-200'
                  }`}
                >
                  <Mic className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm font-semibold">Dictation</div>
                  <div className="text-xs opacity-75">Single speaker</div>
                </button>
                
                <button
                  onClick={() => setRecordingMode('conversation')}
                  className={`p-4 rounded-xl transition-all duration-300 ${
                    recordingMode === 'conversation'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200'
                  }`}
                >
                  <User className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm font-semibold">Conversation</div>
                  <div className="text-xs opacity-75">Multi-speaker</div>
                </button>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="glass-card-calm p-6 card-hover-calm text-center">
              <div className="mb-6">
                <div className="flex justify-center gap-4 mb-4">
                  {/* Start Recording Button */}
                  <button
                    onClick={startRecording}
                    disabled={isRecording || isProcessing}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isRecording || isProcessing
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                    } text-white`}
                  >
                    <Play className="w-8 h-8 ml-1" />
                  </button>
                  
                  {/* Stop Recording Button */}
                  <button
                    onClick={stopRecording}
                    disabled={!isRecording || isProcessing}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      !isRecording || isProcessing
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl'
                    } text-white`}
                  >
                    <Square className="w-8 h-8" />
                  </button>
                </div>
                
                {/* Recording Status */}
                <div className="mt-4">
                  <div className="text-lg font-semibold text-gray-800">
                    {isRecording ? '🎙️ Recording...' : '🎤 Ready to Record'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {isRecording ? `Duration: ${formatDuration(recordingDuration)}` : 'Click start to begin'}
                  </div>
                  
                  {/* Simple Recording Indicator */}
                  {isRecording && (
                    <div className="mt-3 flex justify-center">
                      <div className="status-indicator status-recording">
                        <div className="w-2 h-2 bg-red-500 rounded-full recording-dot"></div>
                        <span>Recording Live</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => processWithAI()}
                  disabled={!transcript.trim() || isProcessing}
                  className="btn-calm btn-calm-primary px-6 py-3 flex items-center gap-2"
                >
                  {!isProcessing ? (
                    <>
                      <Brain className="w-5 h-5" />
                      AI Process
                    </>
                  ) : (
                    <>
                      <div className="spinner-calm"></div>
                      Processing
                    </>
                  )}
                </button>
                
                <button
                  onClick={clearAll}
                  className="btn-calm btn-calm-danger px-6 py-3 flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Clear
                </button>
              </div>

              {recordingError && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm animate-shake">
                  {recordingError}
                </div>
              )}

              {/* Microphone Test Section */}
              <div className="mt-4">
                <button
                  onClick={testMicrophone}
                  disabled={isTesting || isRecording}
                  className="btn-calm btn-calm-secondary px-4 py-2 text-sm w-full flex items-center justify-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <div className="spinner-calm"></div>
                      Testing Microphone... Speak now!
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Test Microphone
                    </>
                  )}
                </button>

                {/* Audio Level Meter */}
                {isTesting && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs font-medium text-gray-700 mb-2 text-center">
                      Audio Level: {audioLevel}%
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 transition-all duration-100 ${
                          audioLevel > 50 ? 'bg-green-500' :
                          audioLevel > 20 ? 'bg-yellow-500' :
                          audioLevel > 5 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(audioLevel, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-2 text-center">
                      Speak clearly into your microphone
                    </div>
                  </div>
                )}

                {/* Microphone Test Results */}
                {micTestResult && (
                  <div className={`mt-3 p-3 border rounded-lg ${
                    micTestResult.success
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                  }`}>
                    <div className="flex items-start gap-2">
                      {micTestResult.success ? (
                        <span className="text-xl">✓</span>
                      ) : (
                        <span className="text-xl">⚠️</span>
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-semibold">
                          {micTestResult.message}
                        </div>
                        {micTestResult.deviceName && (
                          <div className="text-xs mt-1 opacity-80">
                            Device: {micTestResult.deviceName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Processing Progress Indicator */}
              {isProcessing && processingStage && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  {/* Retry Indicator */}
                  {retryAttempt && (
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-yellow-600 font-semibold">
                          ⚠️ Retry {retryAttempt.current}/{retryAttempt.max}
                        </span>
                        <span className="text-yellow-700">
                          {retryAttempt.reason.substring(0, 60)}...
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="spinner-calm"></div>
                        <span className="text-sm font-semibold text-gray-800">
                          {processingStage === 'analyzing' && '🔍 Analyzing transcription...'}
                          {processingStage === 'structuring' && '📝 Structuring medical note...'}
                          {processingStage === 'validating' && '✓ Validating content...'}
                          {processingStage === 'complete' && '✅ Complete!'}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-blue-600">
                        {Math.round(processingProgress)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ease-out ${
                          retryAttempt
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        }`}
                        style={{ width: `${processingProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stage Description */}
                  <div className="text-xs text-gray-600">
                    {retryAttempt ? (
                      <span className="font-medium">
                        Retrying due to temporary issue. This is normal and ensures best quality.
                      </span>
                    ) : (
                      <>
                        {processingStage === 'analyzing' && 'Extracting medical information from your dictation'}
                        {processingStage === 'structuring' && 'Organizing content into proper medical note format'}
                        {processingStage === 'validating' && 'Checking for completeness and accuracy'}
                        {processingStage === 'complete' && 'Your medical note is ready!'}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Patient Details */}
            <div className="glass-card-calm p-6 card-hover-calm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                Patient Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                  <input
                    type="text"
                    value={patientDetails.name}
                    onChange={(e) => setPatientDetails(prev => ({ ...prev, name: e.target.value }))}
                    className="modern-input-calm w-full"
                    placeholder="Enter patient name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MRN</label>
                  <input
                    type="text"
                    value={patientDetails.mrn}
                    onChange={(e) => setPatientDetails(prev => ({ ...prev, mrn: e.target.value }))}
                    className="modern-input-calm w-full"
                    placeholder="Medical Record Number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={patientDetails.dob}
                    onChange={(e) => setPatientDetails(prev => ({ ...prev, dob: e.target.value }))}
                    className="modern-input-calm w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={patientDetails.email}
                    onChange={(e) => setPatientDetails(prev => ({ ...prev, email: e.target.value }))}
                    className="modern-input-calm w-full"
                    placeholder="patient@email.com"
                  />
                </div>
              </div>
            </div>

            {/* Live Transcript - Moved to Left Sidebar */}
            <div className="glass-card-calm p-6 card-hover-calm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-500" />
                Live Transcript
              </h3>
              
              <div className="bg-white bg-opacity-80 rounded-xl p-3 min-h-48 max-h-64 overflow-y-auto calm-scrollbar">
                {transcript || interimText ? (
                  <div className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                    {transcript}
                    {interimText && (
                      <span className="text-blue-500 italic">{interimText}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Mic className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Start recording to see your transcript</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - AI Generated Note (Much Larger) */}
          <div className="space-y-4">
            {/* Quality Rating Banner */}
            {showProcessed && qualityRating && (
              <div className={`glass-card-calm p-4 border-l-4 ${
                qualityRating.quality === 'excellent' ? 'border-green-500 bg-green-50' :
                qualityRating.quality === 'good' ? 'border-blue-500 bg-blue-50' :
                'border-red-500 bg-red-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {qualityRating.quality === 'excellent' && (
                        <>
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                            <Star className="w-5 h-5 text-white fill-white" />
                          </div>
                          <div>
                            <div className="font-semibold text-green-900">Excellent Quality</div>
                            <div className="text-xs text-green-700">
                              Confidence: {Math.round(qualityRating.confidence * 100)}%
                            </div>
                          </div>
                        </>
                      )}
                      {qualityRating.quality === 'good' && (
                        <>
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-semibold text-blue-900">Good Quality</div>
                            <div className="text-xs text-blue-700">
                              Confidence: {Math.round(qualityRating.confidence * 100)}%
                            </div>
                          </div>
                        </>
                      )}
                      {qualityRating.quality === 'poor' && (
                        <>
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-semibold text-red-900">Needs Review</div>
                            <div className="text-xs text-red-700">
                              Confidence: {Math.round(qualityRating.confidence * 100)}%
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Quality Issues */}
                    {qualityRating.issues.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-700 mb-1">Quality Issues Detected:</div>
                        <ul className="text-xs space-y-1">
                          {qualityRating.issues.slice(0, 3).map((issue, index) => (
                            <li key={index} className="text-gray-600 flex items-start gap-1">
                              <span className="text-gray-400">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                          {qualityRating.issues.length > 3 && (
                            <li className="text-gray-500 italic">
                              ...and {qualityRating.issues.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Regenerate Button for Poor Quality */}
                  {qualityRating.quality === 'poor' && (
                    <button
                      onClick={() => processWithAI(transcript)}
                      disabled={isProcessing}
                      className="btn-calm btn-calm-primary px-4 py-2 text-sm"
                      title="Regenerate note with improved AI processing"
                    >
                      <Brain className="w-4 h-4" />
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="glass-card-calm p-6 card-hover-calm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI-Generated Note
                </h3>
              
              {showProcessed && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingNote(!isEditingNote)}
                    className={`glass-button p-2 rounded-lg hover:scale-105 transition-transform ${isEditingNote ? 'bg-blue-100' : ''}`}
                    title={isEditingNote ? "View formatted" : "Edit note"}
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => copyToClipboard()}
                    className="glass-button p-2 rounded-lg hover:scale-105 transition-transform"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const printContent = editableNote.replace(/###\s*/g, '').replace(/\*\*(.*?)\*\*/g, '$1');
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
                    className="glass-button p-2 rounded-lg hover:scale-105 transition-transform"
                    title="Print note"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className={`bg-white bg-opacity-80 rounded-xl p-4 min-h-[700px] max-h-[900px] overflow-y-auto calm-scrollbar editable-note-container ${isEditingNote ? 'editing' : ''}`}>
              {showProcessed && editableNote ? (
                <>
                  <div className="edit-indicator"></div>
                  {isEditingNote ? (
                    <textarea
                      value={editableNote}
                      onChange={(e) => setEditableNote(e.target.value)}
                      className="note-textarea w-full h-full min-h-[650px] p-2"
                      placeholder="Edit your medical note here..."
                      autoFocus
                      onBlur={() => setIsEditingNote(false)}
                    />
                  ) : (
                    <div 
                      className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed cursor-text min-h-[650px]"
                      onClick={() => setIsEditingNote(true)}
                      title="Click to edit"
                    >
                      {editableNote.split('\n').map((line, index) => {
                        if (line.startsWith('###')) {
                          return (
                            <h3 key={index} className="text-lg font-bold text-blue-600 mt-4 mb-2">
                              {line.replace('###', '').trim()}
                            </h3>
                          );
                        } else if (line.includes('**')) {
                          return (
                            <p key={index} className="mb-2">
                              {line.split('**').map((part, i) => 
                                i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
                              )}
                            </p>
                          );
                        } else {
                          return <p key={index} className="mb-2">{line}</p>;
                        }
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Your AI-generated note will appear here</p>
                    <p className="text-sm mt-2">Record your dictation and process with AI!</p>
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Note Quality Rating */}
            {showProcessed && noteMetadata && (
              <NoteQualityRating
                noteId={noteMetadata.noteId}
                templateId={selectedTemplate?.id}
                promptVersionId={noteMetadata.promptVersionId}
                modelUsed={noteMetadata.modelUsed}
                onSubmitRating={handleQualityRating}
                compact={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Template Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          isOpen={showTemplatePreview}
          onClose={() => {
            setShowTemplatePreview(false);
            setPreviewTemplate(null);
          }}
          onUseTemplate={() => {
            setSelectedTemplate(previewTemplate);
            setShowTemplateSelector(false);
          }}
          currentTemplateId={selectedTemplate?.id}
        />
      )}
    </div>
  );
}