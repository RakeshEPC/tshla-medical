"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getQuestionsForMedication } from "@/lib/priorAuth/medicationQuestions";
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

// Medication keywords that trigger prior auth
const PRIOR_AUTH_MEDICATIONS = [
  'ozempic', 'wegovy', 'mounjaro', 'saxenda', 'trulicity',
  'humira', 'enbrel', 'remicade', 'stelara', 'cosentyx',
  'dupixent', 'xeljanz', 'otezla', 'taltz', 'skyrizi'
];

interface PriorAuthData {
  medication: string;
  diagnosis: string;
  dosage: string;
  duration: string;
  previousTreatments: string;
  clinicalRationale: string;
}

export default function FullDriverPage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [soapNote, setSoapNote] = useState("");
  const [patientSummary, setPatientSummary] = useState("");
  const [showPriorAuth, setShowPriorAuth] = useState(false);
  const [priorAuthData, setPriorAuthData] = useState<PriorAuthData>({
    medication: "",
    diagnosis: "",
    dosage: "",
    duration: "",
    previousTreatments: "",
    clinicalRationale: ""
  });
  const [detectedMedications, setDetectedMedications] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [noteData, setNoteData] = useState<any>(null);
  const [currentMedQuestions, setCurrentMedQuestions] = useState<string[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<{ [key: string]: boolean }>({});
  const [capturedAnswers, setCapturedAnswers] = useState<{ [key: string]: string }>({});

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [interimText, setInterimText] = useState("");
  const finalTranscriptRef = useRef("");
  
  // Check for medications whenever transcript changes
  useEffect(() => {
    if (transcript) {
      logDebug('FullDriverPage', 'Debug message', {}); 
      checkForMedications(transcript);
      if (currentMedQuestions.length > 0) {
        checkAnsweredQuestions(transcript);
      }
    }
  }, [transcript, checkForMedications, currentMedQuestions]);
  
  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);
  
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates/my');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      logError('FullDriverPage', 'Error message', {});
    }
  };

  // Initialize speech recognition only once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
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
        
        // Update interim display
        setInterimText(interim);
        
        // Update final transcript
        if (final) {
          logDebug('FullDriverPage', 'Debug message', {});
          finalTranscriptRef.current += final;
          setTranscript(finalTranscriptRef.current);
        }
      };
      
      recognition.onerror = (event: any) => {
        logError('FullDriverPage', 'Error message', {});
        if (event.error === 'no-speech') {
          // Ignore no-speech errors
          return;
        }
        setError(`Speech recognition error: ${event.error}`);
      };
      
      recognition.onend = () => {
        // Recognition stopped, clear interim
        setInterimText("");
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []); // No dependencies - initialize only once

  // Check for medications that need prior auth - enhanced version
  const checkForMedications = useCallback((text: string) => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    let foundNewMedication = false;
    
    PRIOR_AUTH_MEDICATIONS.forEach(med => {
      if (lowerText.includes(med)) {
        // Check if this is a new medication
        setDetectedMedications(prev => {
          if (!prev.includes(med)) {
            foundNewMedication = true;
            logDebug('FullDriverPage', 'Debug message', {});
            
            // Immediately show prior auth form
            setShowPriorAuth(true);
            
            // Set the medication name with proper capitalization
            const capitalizedMed = med.charAt(0).toUpperCase() + med.slice(1);
            setPriorAuthData(prevData => ({
              ...prevData,
              medication: capitalizedMed
            }));
            
            // Get questions for this medication
            const questions = getQuestionsForMedication(med);
            logDebug('FullDriverPage', 'Debug message', {});
            setCurrentMedQuestions(questions);
            
            // Initialize answered tracking
            const questionsMap: { [key: string]: boolean } = {};
            questions.forEach(q => {
              questionsMap[q] = false;
            });
            setAnsweredQuestions(questionsMap);
            
            // Extract all context immediately
            setTimeout(() => {
              extractPriorAuthContext(lowerText, med);
              if (currentMedQuestions.length > 0) {
                checkAnsweredQuestions(lowerText);
              }
            }, 100);
            
            // Visual feedback - make it more noticeable
            if (typeof window !== 'undefined') {
              // Flash the prior auth section
              setTimeout(() => {
                const priorAuthSection = document.querySelector('.prior-auth-section');
                if (priorAuthSection) {
                  priorAuthSection.classList.add('animate-pulse', 'ring-4', 'ring-red-500');
                  // Scroll to prior auth section
                  priorAuthSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => {
                    priorAuthSection.classList.remove('animate-pulse', 'ring-4', 'ring-red-500');
                  }, 3000);
                }
              }, 100);
              
              // Play a sound if available
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCl+yvDTizMGHm7A7OOaRQYRVqzn7qxSEAVIsenkrVkYCDuS1/LNeS0GI3nH8N+RQAkUXrTp66hVFApGn+DyvmwhBCl+yvDTizMGHm7A7OOaRQYRVqzn7qxSEAVIsenkrVkYCDuS1/LNeS0GI3nH8N+RQAkUXrTp66hVFApGn+DyvmwhBCl+yvDTizMGHm7A7OOaRQYRVqzn7qxSEAVIsenkrVkYCDuS1/LNeSsGI3fH8N+RQAkUXrTp66hVFApGn+DyvmwhBCl+yvDTizMGHm7A7OOaRQYRVqzn7qxSEAVIsenkrVkYCDuS1/LNeSsGI3fH8N+RQAkUXrTp66hVFApGn+DyvmwhBCl+yvDTizMGHm7A7OOaRQYRVqzn7qxSEA==');
                audio.volume = 0.3;
                audio.play().catch(() => {});
              } catch (e) {}
            }
            
            return [...prev, med];
          }
          return prev;
        });
      }
    });
    
    return foundNewMedication;
  }, [currentMedQuestions]);

  // Check if questions are being answered in the transcript
  const checkAnsweredQuestions = useCallback((text: string) => {
    if (!text || currentMedQuestions.length === 0) return;
    const lowerText = text.toLowerCase();
    
    // Question-answer patterns
    const answerPatterns: { [key: string]: RegExp[] } = {
      "What is the patient's current A1C level?": [
        /a1c\s*(?:is|of|level)?\s*(\d+\.?\d*)/i,
        /hemoglobin a1c\s*(\d+\.?\d*)/i,
        /glycated hemoglobin\s*(\d+\.?\d*)/i
      ],
      "What is their BMI?": [
        /bmi\s*(?:is|of)?\s*(\d+\.?\d*)/i,
        /body mass index\s*(\d+\.?\d*)/i
      ],
      "Have they tried metformin? For how long?": [
        /metformin/i,
        /tried metformin/i,
        /failed metformin/i,
        /on metformin for/i
      ],
      "What is their weight and height?": [
        /(?:weight|weighs)\s*(\d+)\s*(?:pounds?|lbs?|kg)/i,
        /(?:height|tall)\s*(\d+)\s*(?:feet|ft|cm|inches)/i
      ],
      "Previous weight loss attempts (diet, exercise programs)?": [
        /diet/i,
        /exercise program/i,
        /weight loss attempt/i,
        /tried to lose weight/i
      ]
    };
    
    // Check each question
    currentMedQuestions.forEach(question => {
      if (!answeredQuestions[question]) {
        let answered = false;
        let capturedAnswer = "";
        
        // Check if this question has specific patterns
        if (answerPatterns[question]) {
          answerPatterns[question].forEach(pattern => {
            const match = text.match(pattern);
            if (match) {
              answered = true;
              capturedAnswer = match[0];
            }
          });
        }
        
        // Generic checks based on keywords in the question
        const questionLower = question.toLowerCase();
        if (questionLower.includes('a1c') && lowerText.includes('a1c')) {
          answered = true;
          const match = text.match(/a1c[^.]*(?:\.|$)/i);
          capturedAnswer = match ? match[0] : "A1C mentioned";
        }
        if (questionLower.includes('bmi') && lowerText.includes('bmi')) {
          answered = true;
          const match = text.match(/bmi[^.]*(?:\.|$)/i);
          capturedAnswer = match ? match[0] : "BMI mentioned";
        }
        if (questionLower.includes('metformin') && lowerText.includes('metformin')) {
          answered = true;
          const match = text.match(/metformin[^.]*(?:\.|$)/i);
          capturedAnswer = match ? match[0] : "Metformin mentioned";
        }
        if (questionLower.includes('tried') && (lowerText.includes('tried') || lowerText.includes('failed'))) {
          answered = true;
          const match = text.match(/(?:tried|failed)[^.]*(?:\.|$)/i);
          capturedAnswer = match ? match[0] : "Previous attempts mentioned";
        }
        if (questionLower.includes('kidney') && (lowerText.includes('egfr') || lowerText.includes('kidney'))) {
          answered = true;
          const match = text.match(/(?:kidney|egfr)[^.]*(?:\.|$)/i);
          capturedAnswer = match ? match[0] : "Kidney function mentioned";
        }
        if (questionLower.includes('history') && lowerText.includes('history')) {
          answered = true;
          const match = text.match(/history[^.]*(?:\.|$)/i);
          capturedAnswer = match ? match[0] : "History mentioned";
        }
        
        if (answered) {
          setAnsweredQuestions(prev => ({ ...prev, [question]: true }));
          setCapturedAnswers(prev => ({ ...prev, [question]: capturedAnswer }));
        }
      }
    });
  }, [currentMedQuestions, answeredQuestions]);
  
  // Extract context for prior auth from speech - enhanced version
  const extractPriorAuthContext = useCallback((text: string, medication: string) => {
    logDebug('FullDriverPage', 'Debug message', {});
    const lowerText = text.toLowerCase();
    
    // Look for diagnosis mentions - expanded list
    const diagnosisMap: { [key: string]: string } = {
      'diabetes': 'Type 2 Diabetes Mellitus',
      'type 2': 'Type 2 Diabetes Mellitus', 
      'type two': 'Type 2 Diabetes Mellitus',
      'weight loss': 'Obesity/Weight Management',
      'obesity': 'Obesity (BMI > 30)',
      'overweight': 'Overweight (BMI 25-30)',
      'rheumatoid': 'Rheumatoid Arthritis',
      'psoriasis': 'Psoriasis',
      'crohn': "Crohn's Disease",
      'ulcerative colitis': 'Ulcerative Colitis',
      'ankylosing': 'Ankylosing Spondylitis',
      'psoriatic arthritis': 'Psoriatic Arthritis'
    };
    
    let diagnoses: string[] = [];
    Object.entries(diagnosisMap).forEach(([keyword, diagnosis]) => {
      if (lowerText.includes(keyword)) {
        diagnoses.push(diagnosis);
      }
    });
    
    if (diagnoses.length > 0) {
      setPriorAuthData(prev => ({ 
        ...prev, 
        diagnosis: diagnoses.join(', ')
      }));
    }
    
    // Look for dosage patterns
    const dosagePatterns = [
      /(\d+(?:\.\d+)?)\s*(mg|milligrams?|mcg|micrograms?|units?|ml|milliliters?)/i,
      /(once|twice|three times|four times)\s*(daily|a day|per day|weekly|a week|per week)/i,
      /(\d+)\s*(tablets?|pills?|capsules?|injections?|doses?)\s*(daily|weekly|monthly)?/i
    ];
    
    dosagePatterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        setPriorAuthData(prev => ({ 
          ...prev, 
          dosage: prev.dosage ? `${prev.dosage}, ${match[0]}` : match[0]
        }));
      }
    });
    
    // Look for duration patterns
    const durationPatterns = [
      /(\d+)\s*(months?|weeks?|years?|days?)/i,
      /(short[- ]?term|long[- ]?term|chronic|ongoing|continuous)/i,
      /(three|six|twelve)\s*months?/i
    ];
    
    durationPatterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        setPriorAuthData(prev => ({ 
          ...prev, 
          duration: match[0]
        }));
      }
    });
    
    // Look for previous treatments
    const previousTreatmentKeywords = [
      'tried', 'failed', 'previously', 'before', 'unsuccessful', 
      'intolerant', 'allergic', 'side effects', 'didn\'t work'
    ];
    
    previousTreatmentKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        // Extract the context around the keyword
        const index = lowerText.indexOf(keyword);
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(lowerText.length, index + 100);
        const context = text.substring(contextStart, contextEnd);
        
        setPriorAuthData(prev => ({ 
          ...prev, 
          previousTreatments: prev.previousTreatments ? 
            `${prev.previousTreatments}; ${context}` : context
        }));
      }
    });
    
    // Look for clinical rationale keywords
    const rationaleKeywords = [
      'because', 'due to', 'reason', 'necessary', 'requires', 
      'indicated', 'appropriate', 'benefit', 'improve'
    ];
    
    rationaleKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        const index = lowerText.indexOf(keyword);
        const contextStart = Math.max(0, index - 30);
        const contextEnd = Math.min(lowerText.length, index + 100);
        const context = text.substring(contextStart, contextEnd);
        
        setPriorAuthData(prev => ({ 
          ...prev, 
          clinicalRationale: prev.clinicalRationale ? 
            `${prev.clinicalRationale} ${context}` : context
        }));
      }
    });
    
    // Auto-fill standard rationale based on medication
    if (medication && !lowerText.includes('because')) {
      const standardRationales: { [key: string]: string } = {
        'ozempic': 'Patient requires GLP-1 agonist for glycemic control and weight management',
        'wegovy': 'Patient meets criteria for weight management medication (BMI > 30 or BMI > 27 with comorbidities)',
        'mounjaro': 'Dual GIP/GLP-1 agonist indicated for improved glycemic control',
        'humira': 'TNF inhibitor required for moderate to severe inflammatory condition',
        'dupixent': 'IL-4/IL-13 inhibitor for moderate to severe atopic condition'
      };
      
      if (standardRationales[medication.toLowerCase()]) {
        setPriorAuthData(prev => ({ 
          ...prev, 
          clinicalRationale: prev.clinicalRationale || standardRationales[medication.toLowerCase()]
        }));
      }
    }
  }, []);

  // Session timeout is now handled by SessionMonitor component
  // (removed duplicate logic to prevent conflicts)

  // Recording functions with speech-to-text
  const startRecording = async () => {
    try {
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      // Also start audio recording for backup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err: any) {
      setError(`Microphone access error: ${err.message}`);
    }
  };

  const pauseRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        logDebug('FullDriverPage', 'Debug message', {});
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    setInterimText(""); // Clear interim text
  };

  // Generate SOAP note
  const generateSOAP = async () => {
    if (!transcript || !patientId) {
      setError("Please enter both Patient ID and Transcript");
      return;
    }
    
    setLoading(true);
    setError("");
    setSoapNote(""); // Clear previous note
    
    try {
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          meta: { patientId, format: 'soap' },
          template: selectedTemplate
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate SOAP note`);
      }
      
      const result = await response.json();
      
      // Store the full result for template rendering
      setNoteData(result);
      
      // Format SOAP note
      if (result.soap) {
        const soap = result.soap;
        const formattedNote = [
          "SUBJECTIVE:",
          soap.subjective || 'N/A',
          "",
          "OBJECTIVE:",
          soap.objective || 'N/A',
          "",
          "ASSESSMENT:",
          soap.assessment || 'N/A',
          "",
          "PLAN:",
          soap.plan || 'N/A'
        ].join('\n');
        setSoapNote(formattedNote);
      } else {
        setSoapNote("Generated note:\n" + JSON.stringify(result, null, 2));
      }
    } catch (error: any) {
      logError('FullDriverPage', 'Error message', {});
      if (error.message.includes('OPENAI_API_KEY')) {
        setError("OpenAI API key not configured. Please check server environment variables.");
      } else {
        setError(`Error generating SOAP note: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate patient summary
  const generateSummary = async () => {
    if (!transcript || !patientId) {
      setError("Please enter both Patient ID and Transcript");
      return;
    }
    
    setLoading(true);
    setError("");
    setPatientSummary(""); // Clear previous summary
    
    try {
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          meta: { patientId, format: 'summary' }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate summary`);
      }
      
      const result = await response.json();
      
      // Format summary
      if (result.summary) {
        const summary = result.summary;
        const formattedSummary = [];
        
        formattedSummary.push("PATIENT SUMMARY:");
        formattedSummary.push(summary.lay_terms || 'N/A');
        formattedSummary.push("");
        formattedSummary.push("ACTION ITEMS:");
        
        if (Array.isArray(summary.action_items) && summary.action_items.length > 0) {
          summary.action_items.forEach(item => {
            formattedSummary.push(`• ${item}`);
          });
        } else {
          formattedSummary.push("• None");
        }
        
        setPatientSummary(formattedSummary.join('\n'));
      } else {
        setPatientSummary("Generated summary:\n" + JSON.stringify(result, null, 2));
      }
    } catch (error: any) {
      logError('FullDriverPage', 'Error message', {});
      if (error.message.includes('OPENAI_API_KEY')) {
        setError("OpenAI API key not configured. Please check server environment variables.");
      } else {
        setError(`Error generating summary: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Save prior auth data to localStorage for history page
  const savePriorAuthData = useCallback(() => {
    const paData = {
      ...priorAuthData,
      patientId,
      transcript,
      questions: currentMedQuestions,
      answeredQuestions,
      capturedAnswers,
      timestamp: new Date().toISOString(),
      id: `PA-${Date.now()}`,
      status: 'ready_to_submit'
    };
    
    // Get existing PA data
    const existing = localStorage.getItem('pending_pa_submissions');
    const paList = existing ? JSON.parse(existing) : [];
    paList.push(paData);
    localStorage.setItem('pending_pa_submissions', JSON.stringify(paList));
    
    logDebug('FullDriverPage', 'Debug message', {});
    return paData;
  }, [priorAuthData, patientId, transcript, currentMedQuestions, answeredQuestions, capturedAnswers]);
  
  // Submit prior auth
  const submitPriorAuth = async () => {
    setLoading(true);
    try {
      // Save to localStorage first
      const savedData = savePriorAuthData();
      
      const response = await fetch('/api/priorauth/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...priorAuthData,
          patientId,
          capturedAnswers,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) throw new Error('Failed to submit prior auth');
      
      alert('Prior authorization saved! View in Prior Auth History.');
      setShowPriorAuth(false);
      
      // Open prior auth history in new tab
      window.open('/driver/priorauth', '_blank');
    } catch (error: any) {
      setError(`Failed to submit prior auth: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Timer */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Medical Dictation System</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Session: {Math.floor(sessionTimeRemaining / 60)}:
                {String(sessionTimeRemaining % 60).padStart(2, '0')}
              </span>
              <button
                onClick={() => setSessionTimeRemaining(30 * 60)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Extend
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Dictation Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              {/* Patient ID and Template Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient ID
                  </label>
                  <input
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Enter patient ID"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template (Optional)
                  </label>
                  <select
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => {
                      const template = templates.find(t => t.id === e.target.value);
                      setSelectedTemplate(template || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">No Template</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.specialty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recording Controls */}
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={startRecording}
                    disabled={isRecording}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className={`w-3 h-3 ${isRecording ? 'animate-pulse' : ''} bg-white rounded-full`}></span>
                    {isRecording ? "Recording..." : "Start"}
                  </button>
                  
                  {isRecording && !isPaused && (
                    <button onClick={pauseRecording} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                      Pause
                    </button>
                  )}
                  
                  {isRecording && isPaused && (
                    <button onClick={resumeRecording} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Resume
                    </button>
                  )}
                  
                  <button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    Stop
                  </button>
                </div>
                {isRecording && (
                  <p className="text-sm text-red-600 animate-pulse">
                    ● Live transcription active - speak clearly...
                  </p>
                )}
              </div>

              {/* Live Transcript */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Live Transcript
                </label>
                <div className="relative">
                  <textarea
                    id="transcript-area"
                    value={transcript + (interimText ? ' ' + interimText : '')}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setTranscript(newValue);
                      finalTranscriptRef.current = newValue;
                    }}
                    className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="Your dictation will appear here in real-time as you speak..."
                  />
                  {interimText && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-yellow-100 text-xs rounded">
                      Listening...
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {transcript.length} characters | {transcript.split(' ').filter(w => w).length} words
                </p>
              </div>

              {/* Detected Medications - More prominent */}
              {detectedMedications.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg animate-pulse">
                  <p className="text-sm font-bold text-red-700">
                    ⚠️ PRIOR AUTH MEDICATIONS DETECTED:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {detectedMedications.map((med, idx) => (
                      <span key={idx} className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-semibold">
                        {med.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  {showPriorAuth && (
                    <p className="text-xs text-red-600 mt-2">
                      ↓ Prior auth form is open below - Auto-filling from your speech...
                    </p>
                  )}
                </div>
              )}

              {/* Generation Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={generateSOAP}
                  disabled={loading || !transcript || !patientId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate SOAP Note"}
                </button>
                
                <button
                  onClick={generateSummary}
                  disabled={loading || !transcript || !patientId}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate Summary"}
                </button>
                
                <button
                  onClick={() => {
                    setTranscript("");
                    finalTranscriptRef.current = "";
                    setSoapNote("");
                    setPatientSummary("");
                    setDetectedMedications([]);
                    setInterimText("");
                    setError("");
                    setNoteData(null);
                    setCurrentMedQuestions([]);
                    setAnsweredQuestions({});
                    setCapturedAnswers({});
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* SOAP Note Display */}
            {soapNote && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h3 className="text-lg font-semibold mb-3">SOAP Note</h3>
                <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
                  {soapNote}
                </div>
                
                {/* Template Sections if template was used */}
                {selectedTemplate && noteData?.templateSections && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold text-gray-700 mb-3">Template Sections</h4>
                    {selectedTemplate.sections.map((section: any) => {
                      const content = noteData.templateSections[section.id];
                      if (!content) return null;
                      return (
                        <div key={section.id} className="mb-3">
                          <h5 className="font-medium text-gray-600">{section.title}</h5>
                          <p className="text-sm text-gray-700 mt-1">{content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* ICD Codes if available */}
                {noteData?.codes && (noteData.codes.icd10?.length > 0 || noteData.codes.icd9?.length > 0) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold text-gray-700 mb-2">Suggested Codes</h4>
                    {noteData.codes.icd10?.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-600">ICD-10: </span>
                        <span className="text-sm">{noteData.codes.icd10.join(', ')}</span>
                      </div>
                    )}
                    {noteData.codes.icd9?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">ICD-9: </span>
                        <span className="text-sm">{noteData.codes.icd9.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Patient Summary Display */}
            {patientSummary && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h3 className="text-lg font-semibold mb-3">Patient Summary</h3>
                <div className="whitespace-pre-wrap text-sm bg-blue-50 p-4 rounded">
                  {patientSummary}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            {/* Prior Auth Questions Guide */}
            {currentMedQuestions.length > 0 && (
              <div className="bg-blue-50 rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-400">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-blue-800">
                    📋 Required Information for {priorAuthData.medication}
                  </h3>
                  <span className="text-sm text-blue-600">
                    {Object.values(answeredQuestions).filter(Boolean).length}/{currentMedQuestions.length} answered
                  </span>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {currentMedQuestions.map((question, idx) => {
                    const isAnswered = answeredQuestions[question];
                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg transition-all ${
                          isAnswered 
                            ? 'bg-green-100 border-green-300' 
                            : 'bg-white border-gray-200'
                        } border`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 ${
                            isAnswered ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {isAnswered ? '✓' : '○'}
                          </span>
                          <div className="flex-1">
                            <p className={`text-sm ${
                              isAnswered ? 'text-green-800 line-through' : 'text-gray-700 font-medium'
                            }`}>
                              {question}
                            </p>
                            {isAnswered && capturedAnswers[question] && (
                              <p className="text-xs text-green-600 mt-1">
                                Captured: "{capturedAnswers[question]}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    💡 <strong>Tip:</strong> Address these points while dictating to ensure PA approval
                  </p>
                </div>
                
                {Object.values(answeredQuestions).filter(Boolean).length === currentMedQuestions.length && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-300">
                    <p className="text-sm text-green-800 font-semibold">
                      ✅ All required information captured! Ready for PA submission.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Prior Auth Form - Enhanced visibility */}
            {showPriorAuth && (
              <div className="bg-red-50 rounded-lg shadow-lg p-6 mb-6 prior-auth-section border-4 border-red-400 transition-all duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-red-700">
                    🚨 PRIOR AUTHORIZATION REQUIRED
                  </h3>
                  <button
                    onClick={() => setShowPriorAuth(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Medication</label>
                    <input
                      type="text"
                      value={priorAuthData.medication}
                      onChange={(e) => setPriorAuthData(prev => ({ ...prev, medication: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Diagnosis</label>
                    <input
                      type="text"
                      value={priorAuthData.diagnosis}
                      onChange={(e) => setPriorAuthData(prev => ({ ...prev, diagnosis: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dosage</label>
                    <input
                      type="text"
                      value={priorAuthData.dosage}
                      onChange={(e) => setPriorAuthData(prev => ({ ...prev, dosage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration</label>
                    <input
                      type="text"
                      value={priorAuthData.duration}
                      onChange={(e) => setPriorAuthData(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Previous Treatments</label>
                    <textarea
                      value={priorAuthData.previousTreatments}
                      onChange={(e) => setPriorAuthData(prev => ({ ...prev, previousTreatments: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Clinical Rationale</label>
                    <textarea
                      value={priorAuthData.clinicalRationale}
                      onChange={(e) => setPriorAuthData(prev => ({ ...prev, clinicalRationale: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={submitPriorAuth}
                      disabled={loading || !priorAuthData.medication}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
                    >
                      Submit Prior Auth
                    </button>
                    <button
                      onClick={() => {
                        // Auto-fill with common values
                        setPriorAuthData(prev => ({
                          ...prev,
                          dosage: prev.dosage || '0.25mg weekly',
                          duration: prev.duration || '12 months',
                          previousTreatments: prev.previousTreatments || 'Metformin - inadequate glycemic control',
                          clinicalRationale: prev.clinicalRationale || 'Medical necessity for improved disease management'
                        }));
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Auto-Fill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Tools</h3>
              <div className="space-y-2">
                <Link href="/driver/templates" className="block w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-center">
                  Templates
                </Link>
                <Link href="/driver/priorauth" className="block w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center">
                  Prior Auth History
                </Link>
                <Link href="/driver/template-studio" className="block w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-center">
                  Template Studio
                </Link>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-700 p-3 rounded mt-4">
                {error}
                <button onClick={() => setError("")} className="ml-2 text-red-500">✕</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}