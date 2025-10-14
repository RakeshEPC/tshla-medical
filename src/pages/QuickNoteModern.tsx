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
  ChevronDown
} from 'lucide-react';
import '../styles/modernUI.css';
import '../styles/quicknote-calm.css';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

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
  const [showProcessed, setShowProcessed] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [recordingMode, setRecordingMode] = useState<'dictation' | 'conversation'>('dictation');
  const [selectedTemplate, setSelectedTemplate] = useState<DoctorTemplate | null>(null);
  const [templates, setTemplates] = useState<DoctorTemplate[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
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

  // Load user and templates
  useEffect(() => {
    const user = unifiedAuthService.getCurrentUser();
    setCurrentUser(user);
    loadTemplates();
  }, []);

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
    try {
      const currentUser = unifiedAuthService.getCurrentUser();
      const doctorId = currentUser?.id || currentUser?.email || 'doctor-default-001';
      
      doctorProfileService.initialize(doctorId);
      const allTemplates = await doctorProfileService.getTemplates(doctorId);
      setTemplates(allTemplates);

      const defaultTemplate = await doctorProfileService.getDefaultTemplate(doctorId);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      logError('QuickNoteModern', 'Error message', {});
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    setIsProcessing(true);
    setShowProcessed(false);

    try {
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

      const result = await azureAIService.processMedicalTranscription(
        combinedContent,
        minimalPatientData,
        null,
        `Patient context: ${patientContext}`,
        templateInstructions
      );
      
      const processedContent = result.formatted;
      setProcessedNote(processedContent);
      setEditableNote(processedContent);
      setShowProcessed(true);
    } catch (error) {
      logError('QuickNoteModern', 'Error message', {});
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to process with AI: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
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

  const clearAll = () => {
    setTranscript('');
    setInterimText('');
    setProcessedNote('');
    setEditableNote('');
    setShowProcessed(false);
    setIsEditingNote(false);
    setWordCount(0);
    setRecordingDuration(0);
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
                  {isProcessing ? (
                    <>
                      <div className="spinner-calm"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      AI Process
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
            </div>

            {/* Template Selection - Enhanced Visibility */}
            <div className="glass-card-calm p-6 card-hover-calm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Template
                {selectedTemplate && (
                  <span className="ml-auto text-xs px-2 py-1 bg-blue-500 text-white rounded-full">
                    Active
                  </span>
                )}
              </h3>

              <button
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className={`glass-button w-full p-3 rounded-lg text-left flex items-center justify-between hover:scale-105 transition-transform ${
                  selectedTemplate ? 'border-2 border-blue-500' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="font-semibold">
                    {selectedTemplate ? selectedTemplate.name : 'No Template Selected'}
                  </div>
                  {selectedTemplate && selectedTemplate.description && (
                    <div className="text-xs text-gray-600 mt-1">
                      {selectedTemplate.description}
                    </div>
                  )}
                  {!selectedTemplate && (
                    <div className="text-xs text-gray-600 mt-1">
                      Standard SOAP format
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showTemplateSelector ? 'rotate-180' : ''}`} />
              </button>

              {showTemplateSelector && (
                <div className="mt-3 glass-card p-3 max-h-64 overflow-y-auto modern-scrollbar slide-in-right">
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateSelector(false);
                    }}
                    className={`w-full p-3 text-left hover:bg-white hover:bg-opacity-50 rounded text-sm mb-2 transition-all ${
                      !selectedTemplate ? 'bg-blue-50 border-2 border-blue-400' : 'border border-gray-200'
                    }`}
                  >
                    <div className="font-semibold">No Template</div>
                    <div className="text-xs text-gray-600 mt-1">Standard SOAP Note Format</div>
                  </button>

                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplateSelector(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-white hover:bg-opacity-50 rounded text-sm mb-2 transition-all ${
                        selectedTemplate?.id === template.id ? 'bg-blue-50 border-2 border-blue-400' : 'border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{template.name}</div>
                        {selectedTemplate?.id === template.id && (
                          <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <div className="text-xs text-gray-600 mt-1">{template.description}</div>
                      )}
                      {template.specialty && (
                        <div className="text-xs text-blue-600 mt-1 font-medium">
                          {template.specialty}
                        </div>
                      )}
                    </button>
                  ))}
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
        </div>
      </div>
    </div>
  );
}