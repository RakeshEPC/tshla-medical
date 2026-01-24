/**
 * Patient Document Upload Page
 * Allows patients to upload medical records via:
 * - File upload (PDF, images, Word docs)
 * - Text paste/typing
 * - Voice recording
 * AI processes content and extracts to H&P
 * Created: 2026-01-24
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload,
  FileText,
  Mic,
  ArrowLeft,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
  Paperclip,
  Type,
  Volume2,
  Send
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface SessionData {
  sessionId: string;
  tshlaId: string;
  patientId: string;
  patientName: string;
  phone: string;
}

type UploadMethod = 'file' | 'text' | 'voice';

export default function PatientDocumentUpload() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Session
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Upload method
  const [selectedMethod, setSelectedMethod] = useState<UploadMethod>('file');

  // File upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Text input
  const [textContent, setTextContent] = useState('');

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check session on mount
   */
  useEffect(() => {
    // Check location state first
    if (location.state?.session) {
      setSession(location.state.session);
      setIsLoading(false);
    } else {
      // Check sessionStorage
      const savedSession = sessionStorage.getItem('patient_portal_session');
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          setSession(sessionData);
        } catch (error) {
          console.error('Error parsing session:', error);
        }
      }
      setIsLoading(false);
    }
  }, [location.state]);

  /**
   * Recording timer
   */
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  /**
   * Redirect if no session
   */
  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/patient-portal-unified');
    }
  }, [isLoading, session, navigate]);

  /**
   * Handle file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      setError(null);
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      setError(null);
    }
  };

  /**
   * Remove file from list
   */
  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Start voice recording
   */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioURL(URL.createObjectURL(audioBlob));

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  /**
   * Stop voice recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /**
   * Clear voice recording
   */
  const clearRecording = () => {
    setAudioBlob(null);
    setAudioURL(null);
    setRecordingTime(0);
  };

  /**
   * Format recording time
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Submit upload
   */
  const handleSubmit = async () => {
    if (!session) return;

    // Validate input
    if (selectedMethod === 'file' && selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }
    if (selectedMethod === 'text' && !textContent.trim()) {
      setError('Please enter some text');
      return;
    }
    if (selectedMethod === 'voice' && !audioBlob) {
      setError('Please record some audio');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('tshlaId', session.tshlaId);
      formData.append('patientId', session.patientId);
      formData.append('sessionId', session.sessionId);
      formData.append('uploadMethod', selectedMethod);

      if (selectedMethod === 'file') {
        setProcessingStatus('Uploading files...');
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
      } else if (selectedMethod === 'text') {
        setProcessingStatus('Processing text...');
        formData.append('textContent', textContent);
      } else if (selectedMethod === 'voice') {
        setProcessingStatus('Processing audio recording...');
        if (audioBlob) {
          formData.append('audio', audioBlob, 'recording.webm');
        }
      }

      setProcessingStatus('Extracting medical information with AI...');

      const response = await fetch(`${API_BASE_URL}/api/patient-portal/upload-document`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setProcessingStatus('Successfully added to your medical chart!');
      setUploadSuccess(true);

      // Clear form after 2 seconds and return to dashboard
      setTimeout(() => {
        navigate('/patient-portal-unified', { state: { session } });
      }, 2000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Upload className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Upload Medical Records</h1>
                <p className="text-sm text-gray-600">
                  Upload documents, CCD/XML files, or record notes - AI will extract and add to your chart
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/patient-portal-unified', { state: { session } })}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Upload Method Selection */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Upload Method</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Upload */}
            <button
              onClick={() => setSelectedMethod('file')}
              className={`p-4 border-2 rounded-xl transition-all ${
                selectedMethod === 'file'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Paperclip className={`w-8 h-8 mx-auto mb-2 ${
                selectedMethod === 'file' ? 'text-green-600' : 'text-gray-600'
              }`} />
              <p className="font-medium text-gray-900">Upload Files</p>
              <p className="text-xs text-gray-600 mt-1">PDFs, images, documents</p>
            </button>

            {/* Text Input */}
            <button
              onClick={() => setSelectedMethod('text')}
              className={`p-4 border-2 rounded-xl transition-all ${
                selectedMethod === 'text'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <Type className={`w-8 h-8 mx-auto mb-2 ${
                selectedMethod === 'text' ? 'text-blue-600' : 'text-gray-600'
              }`} />
              <p className="font-medium text-gray-900">Type or Paste</p>
              <p className="text-xs text-gray-600 mt-1">Enter text directly</p>
            </button>

            {/* Voice Recording */}
            <button
              onClick={() => setSelectedMethod('voice')}
              className={`p-4 border-2 rounded-xl transition-all ${
                selectedMethod === 'voice'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <Mic className={`w-8 h-8 mx-auto mb-2 ${
                selectedMethod === 'voice' ? 'text-purple-600' : 'text-gray-600'
              }`} />
              <p className="font-medium text-gray-900">Voice Record</p>
              <p className="text-xs text-gray-600 mt-1">Speak your information</p>
            </button>
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* File Upload */}
          {selectedMethod === 'file' && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${
                  isDragging ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className="text-gray-900 font-medium mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Supported: PDF, JPG, PNG, DOCX, TXT, XML, CCD (Max 10MB each)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,.xml,.ccd"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Select Files
                </button>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    Selected Files ({selectedFiles.length})
                  </p>
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-600">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Text Input */}
          {selectedMethod === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Enter or Paste Medical Information
              </label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste lab results, doctor's notes, or type medical information here..."
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-600 mt-2">
                AI will extract diagnoses, medications, lab results, and other medical data
              </p>
            </div>
          )}

          {/* Voice Recording */}
          {selectedMethod === 'voice' && (
            <div className="text-center">
              {!isRecording && !audioBlob && (
                <div>
                  <Mic className="w-16 h-16 mx-auto mb-4 text-purple-600" />
                  <p className="text-gray-900 font-medium mb-2">
                    Record your medical information
                  </p>
                  <p className="text-sm text-gray-600 mb-6">
                    Speak clearly about your conditions, medications, or test results
                  </p>
                  <button
                    onClick={startRecording}
                    className="px-8 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center space-x-2 mx-auto"
                  >
                    <Mic className="w-5 h-5" />
                    <span>Start Recording</span>
                  </button>
                </div>
              )}

              {isRecording && (
                <div>
                  <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-10 h-10 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">
                    {formatTime(recordingTime)}
                  </p>
                  <p className="text-sm text-gray-600 mb-6">Recording in progress...</p>
                  <button
                    onClick={stopRecording}
                    className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700"
                  >
                    Stop Recording
                  </button>
                </div>
              )}

              {!isRecording && audioBlob && (
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-900 font-medium">Recording Complete</p>
                    <p className="text-sm text-green-700">
                      Duration: {formatTime(recordingTime)}
                    </p>
                  </div>
                  {audioURL && (
                    <div className="mb-4">
                      <audio src={audioURL} controls className="w-full" />
                    </div>
                  )}
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      onClick={clearRecording}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Re-record
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!isProcessing && !uploadSuccess && (
          <button
            onClick={handleSubmit}
            disabled={
              (selectedMethod === 'file' && selectedFiles.length === 0) ||
              (selectedMethod === 'text' && !textContent.trim()) ||
              (selectedMethod === 'voice' && !audioBlob)
            }
            className="w-full py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold text-lg"
          >
            <Send className="w-5 h-5" />
            <span>Process and Add to Medical Chart</span>
          </button>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold text-blue-900 mb-2">{processingStatus}</p>
            <p className="text-sm text-blue-700">Please wait, this may take a moment...</p>
          </div>
        )}

        {/* Success Status */}
        {uploadSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-xl font-bold text-green-900 mb-2">Successfully Uploaded!</p>
            <p className="text-sm text-green-700">
              Information has been added to your medical chart
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">How AI Processing Works</p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                <li>AI reads your documents or listens to your recording</li>
                <li>Extracts diagnoses, medications, lab results, and allergies</li>
                <li>Adds structured data to your H&P (History & Physical)</li>
                <li>Your doctor will review and approve the extracted information</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
