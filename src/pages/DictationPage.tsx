import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientData, type PatientData } from '../services/patientData.service';
import { templateStorage } from '../lib/templateStorage';
import type { Template } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
import { elevenLabsService, ELEVENLABS_VOICES } from '../services/elevenLabs.service';
import { azureAIService } from '../services/azureAI.service';

export default function DictationPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [selectedVoice, setSelectedVoice] = useState(elevenLabsService.getVoice());
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [processedNote, setProcessedNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [patientData, setPatientData] = useState<PatientData | undefined>();
  const [patientSummary, setPatientSummary] = useState('');

  // Load patient data
  useEffect(() => {
    if (patientId) {
      const data = getPatientData(patientId);
      setPatientData(data);

      // Build patient summary for AI context (NOT added to transcript)
      if (data) {
        const summary = `PATIENT CONTEXT:
Name: ${data.name}
MRN: ${data.mrn}
DOB: ${data.dob}

ACTIVE DIAGNOSES:
${data.diagnosis.map(d => `• ${d}`).join('\n')}

CURRENT MEDICATIONS:
${data.medications.map(m => `• ${m.name} ${m.dosage} - ${m.frequency} (${m.indication})`).join('\n')}

RECENT LAB RESULTS:
${data.labResults
  .slice(0, 3)
  .map(l => `• ${l.test}: ${l.value} (Normal: ${l.normal}) - ${l.date}`)
  .join('\n')}

VITALS (Last Visit):
• BP: ${data.vitalSigns.bp}
• HR: ${data.vitalSigns.hr} bpm
• Temp: ${data.vitalSigns.temp}
• Weight: ${data.vitalSigns.weight}
• BMI: ${data.vitalSigns.bmi}
${data.vitalSigns.glucose ? `• Glucose: ${data.vitalSigns.glucose}` : ''}

${
  data.mentalHealth
    ? `MENTAL HEALTH SCREENING:
• PHQ-9 Score: ${data.mentalHealth.phq9Score}
• GAD-7 Score: ${data.mentalHealth.gad7Score}
• Last Screening: ${data.mentalHealth.lastScreening}`
    : ''
}`;
        setPatientSummary(summary);
      }
    }
  }, [patientId]);

  // Load templates
  useEffect(() => {
    const allTemplates = templateStorage.getTemplates();
    setTemplates(allTemplates);
    // Set first template as default if available
    if (allTemplates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(allTemplates[0].id);
      setCurrentTemplate(allTemplates[0]);
    }
  }, []);

  // Update current template when selection changes
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      setCurrentTemplate(template || null);
    }
  }, [selectedTemplate, templates]);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }

        if (final) {
          setTranscript(prev => prev + final);
          setInterimText('');
        } else {
          setInterimText(interim);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        logError('DictationPage', 'Error message', {});
        setIsRecording(false);
        elevenLabsService.speak('Speech recognition error. Please try again.');
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recognitionInstance);
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      elevenLabsService.speak('Speech recognition not supported in this browser');
      alert('Speech recognition not supported in this browser');
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      setInterimText('');
      elevenLabsService.speak('Recording stopped');
    } else {
      recognition.start();
      setIsRecording(true);
      elevenLabsService.speak('Recording started. Please speak clearly.');
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    elevenLabsService.setVoice(voiceId);
    elevenLabsService.testVoice(voiceId);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    setCurrentTemplate(template || null);
    // Track template usage
    templateStorage.trackUsage(templateId);
  };

  const processWithAI = async () => {
    if (!transcript.trim()) {
      elevenLabsService.speak('No transcript to process. Please record some dictation first.');
      alert('No transcript to process');
      return;
    }

    setIsProcessing(true);
    elevenLabsService.speak('Processing with AI using selected template. Please wait.');

    try {
      // Prepare patient data for AI processing
      const patientDataForAI = {
        name: patientData?.name || 'Unknown Patient',
        fullName: patientData?.name || 'Unknown Patient',
        mrn: patientData?.mrn || 'Unknown',
        dob: patientData?.dob || 'Unknown',
        dateOfBirth: patientData?.dob || 'Unknown',
        diagnosis: patientData?.diagnosis || [],
        medications: patientData?.medications || [],
        vitalSigns: patientData?.vitalSigns || {},
        labResults: patientData?.labResults || [],
      };

      // Pass patient summary as additional context (separate from transcript)
      const additionalContext = patientSummary;

      logInfo('DictationPage', 'Processing with AI', {
        templateId: currentTemplate?.id,
        templateName: currentTemplate?.name,
        transcriptLength: transcript.length,
      });

      // Call the real AI service with the selected template
      const result = await azureAIService.processMedicalTranscription(
        transcript,
        patientDataForAI as any,
        currentTemplate,
        additionalContext
      );

      if (result.formatted) {
        setProcessedNote(result.formatted);
        setShowProcessed(true);
        elevenLabsService.speak('AI processing complete. Note is ready for review.');
        logInfo('DictationPage', 'AI processing completed successfully', {});
      } else {
        throw new Error('No formatted note returned from AI');
      }
    } catch (error) {
      logError('DictationPage', 'AI processing failed', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      elevenLabsService.speak(`AI processing failed: ${errorMessage}`);
      alert(`Failed to process with AI: ${errorMessage}\n\nPlease check your Azure/AWS credentials and try again.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveNote = async () => {
    const noteToSave = showProcessed ? processedNote : transcript;
    // Save to localStorage for now
    const visitId = `visit-${Date.now()}`;
    localStorage.setItem(
      visitId,
      JSON.stringify({
        patientId,
        note: noteToSave,
        patientSummary, // Save patient context separately
        template: selectedTemplate,
        templateName: currentTemplate?.name,
        timestamp: new Date().toISOString(),
      })
    );
    localStorage.setItem('last-visit', visitId);
    elevenLabsService.speak('Note saved successfully.');
    navigate('/doctor');
  };

  const printNote = () => {
    const visitId = localStorage.getItem('last-visit') || '1';
    navigate(`/print/${visitId}`);
  };

  const createSummary = () => {
    const visitId = localStorage.getItem('last-visit') || '1';
    navigate(`/visit-summary/${visitId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/doctor')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-lg font-semibold">Medical Dictation</h1>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {patientData
                  ? `${patientData.name} (${patientData.mrn})`
                  : `Patient ID: ${patientId}`}
              </span>
            </div>
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              ⚙️ Voice Settings
            </button>
          </div>
        </div>
      </div>

      {/* Voice Settings Panel */}
      {showVoiceSettings && (
        <div className="bg-white shadow-lg border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Voice:</label>
              <select
                value={selectedVoice}
                onChange={e => handleVoiceChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {ELEVENLABS_VOICES.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} - {voice.description}
                  </option>
                ))}
              </select>
              <button
                onClick={() => elevenLabsService.testVoice(selectedVoice)}
                className="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                🔊 Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Patient Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">Patient Summary</h3>
              {patientData ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="font-medium text-gray-600">Demographics</p>
                    <p>{patientData.name}</p>
                    <p>DOB: {patientData.dob}</p>
                    <p>MRN: {patientData.mrn}</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-600">Active Diagnoses</p>
                    {patientData.diagnosis.map((dx, i) => (
                      <p key={i} className="text-gray-700">
                        • {dx}
                      </p>
                    ))}
                  </div>

                  <div>
                    <p className="font-medium text-gray-600">Current Medications</p>
                    {patientData.medications.slice(0, 5).map((med, i) => (
                      <p key={i} className="text-gray-700">
                        • {med.name} {med.dosage}
                      </p>
                    ))}
                  </div>

                  <div>
                    <p className="font-medium text-gray-600">Recent Labs</p>
                    {patientData.labResults.slice(0, 3).map((lab, i) => (
                      <p key={i} className="text-gray-700">
                        • {lab.test}: {lab.value}
                      </p>
                    ))}
                  </div>

                  <div>
                    <p className="font-medium text-gray-600">Last Vitals</p>
                    <p>BP: {patientData.vitalSigns.bp}</p>
                    <p>HR: {patientData.vitalSigns.hr}</p>
                    {patientData.vitalSigns.glucose && (
                      <p>Glucose: {patientData.vitalSigns.glucose}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Loading patient data...</p>
              )}
            </div>
          </div>

          {/* Right Column - Dictation Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Template:</label>
                <select
                  value={selectedTemplate}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.specialty}
                      {template.is_system_template ? ' (System)' : ' (Custom)'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => navigate('/template-builder')}
                  className="px-3 py-2 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                >
                  Create Template
                </button>
              </div>
              {currentTemplate && (
                <p className="text-xs text-gray-500 mt-2">
                  Type: {currentTemplate.template_type} | Used: {currentTemplate.usage_count || 0}{' '}
                  times
                </p>
              )}
            </div>

            {/* Recording Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Voice Dictation</h2>
                {isRecording && (
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-red-600">Recording...</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={toggleRecording}
                  className={`px-6 py-3 rounded-lg font-medium transition ${
                    isRecording
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
                </button>

                <button
                  onClick={processWithAI}
                  disabled={!transcript || isProcessing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? '⏳ Processing...' : '🤖 Process with AI'}
                </button>
              </div>

              {interimText && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 italic">{interimText}</p>
                </div>
              )}
            </div>

            {/* Transcript / Processed Note Area */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">
                  {showProcessed ? 'AI Processed Note' : 'Dictation Transcript'}
                </h3>
                <div className="space-x-2">
                  {showProcessed && (
                    <button
                      onClick={() => setShowProcessed(false)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      View Original Transcript
                    </button>
                  )}
                  {!showProcessed && transcript && (
                    <button
                      onClick={() => setTranscript('')}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Clear Transcript
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={showProcessed ? processedNote : transcript}
                onChange={e =>
                  showProcessed ? setProcessedNote(e.target.value) : setTranscript(e.target.value)
                }
                className="w-full h-96 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Your dictation will appear here..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <div className="space-x-3">
                <button
                  onClick={() => {
                    setTranscript('');
                    setProcessedNote('');
                    setShowProcessed(false);
                    setInterimText('');
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Clear All
                </button>
              </div>

              <div className="space-x-3">
                {showProcessed && (
                  <>
                    <button
                      onClick={printNote}
                      className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      🖨️ Print Note
                    </button>
                    <button
                      onClick={createSummary}
                      className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      📊 Create Summary
                    </button>
                  </>
                )}
                <button
                  onClick={saveNote}
                  disabled={!transcript && !processedNote}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 Save & Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
