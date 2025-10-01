import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patient.service';
import { awsTranscribeStreamingFixed as transcribeService } from '../services/awsTranscribeMedicalStreamingFixed.service';
import type { Patient, ChatMessage } from '../types/patient.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function PatientChat() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputMethod, setInputMethod] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPatientData();
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadPatientData = () => {
    const currentPatient = patientService.getCurrentPatient();
    if (!currentPatient) {
      navigate('/patient-login');
      return;
    }
    setPatient(currentPatient);
  };

  const loadChatHistory = () => {
    // Load from localStorage for now
    const stored = localStorage.getItem('patient_chat_history');
    if (stored) {
      try {
        const history = JSON.parse(stored);
        setMessages(history);
      } catch (e) {
        logError('PatientChat', 'Error message', {});
      }
    } else {
      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        patientId: '',
        timestamp: new Date().toISOString(),
        sender: 'ai',
        type: 'text',
        content:
          "Hello! I'm AVA, your personal health assistant. I'm here to help you with your health journey. What would you like to discuss today?",
        metadata: {
          sentiment: 'positive',
          topic: 'greeting',
        },
      };
      setMessages([welcomeMessage]);
    }
  };

  const saveChatHistory = (newMessages: ChatMessage[]) => {
    localStorage.setItem('patient_chat_history', JSON.stringify(newMessages));
  };

  const startRecording = async () => {
    setIsRecording(true);
    setCurrentTranscript('');

    try {
      await transcribeService.startRecording({
        onTranscript: (text: string) => {
          setCurrentTranscript(text);
        },
        onError: (error: Error) => {
          logError('PatientChat', 'Error message', {});
          stopRecording();
        },
        mode: 'dictation',
      });
    } catch (error) {
      logError('PatientChat', 'Error message', {});
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    transcribeService.stopRecording();

    if (currentTranscript.length > 0) {
      await handleSendMessage(currentTranscript, 'voice');
      setCurrentTranscript('');
    }
  };

  const handleSendMessage = async (text: string, type: 'text' | 'voice' = 'text') => {
    if (!text.trim() || !patient) return;

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      patientId: patient.internalId,
      timestamp: new Date().toISOString(),
      sender: 'patient',
      type,
      content: text,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsProcessing(true);

    try {
      // Build context for AI
      const context = await buildAIContext(text);

      // Get AI response
      const aiResponse = await azureAIService.processWithClaude(context, 'patient_chat');

      // Create AI message
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        patientId: patient.internalId,
        timestamp: new Date().toISOString(),
        sender: 'ai',
        type: 'text',
        content: aiResponse,
        metadata: {
          sentiment: detectSentiment(aiResponse),
          topic: detectTopic(text),
        },
      };

      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      saveChatHistory(updatedMessages);

      // Speak the response
      await speakResponse(aiResponse);
    } catch (error) {
      logError('PatientChat', 'Error message', {});
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        patientId: patient.internalId,
        timestamp: new Date().toISOString(),
        sender: 'ai',
        type: 'text',
        content: "I apologize, but I'm having trouble processing your message. Please try again.",
        metadata: {
          sentiment: 'neutral',
        },
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const buildAIContext = async (userMessage: string): Promise<string> => {
    if (!patient) return userMessage;

    let context = `You are AVA, a compassionate and knowledgeable AI health assistant for TSHLA Medical. 
You are chatting with ${patient.firstName} ${patient.lastName}.

Patient Information:
- AVA ID: ${patient.patientAvaId}
- Programs Enrolled: ${Object.entries(patient.programs)
      .filter(([_, p]) => p?.enrolled)
      .map(([name]) => name)
      .join(', ')}
`;

    // Add PumpDrive context if available
    if (patient.programs.pumpdrive?.finalRecommendations) {
      const topPump = patient.programs.pumpdrive.finalRecommendations[0];
      context += `
- Recommended Pump: ${topPump.pumpName} (${topPump.matchScore}% match)
- Key Reasons: ${topPump.keyReasons.join(', ')}
`;
    }

    // Add Weight Loss context if available
    if (patient.programs.weightloss?.enrolled) {
      context += `
- Weight Loss Program: ${patient.programs.weightloss.currentPhase || 'Active'}
- Last Check-in: ${patient.programs.weightloss.lastCheckin || 'Not yet'}
`;
    }

    context += `

Recent Conversation:
${messages
  .slice(-5)
  .map(m => `${m.sender === 'patient' ? 'Patient' : 'AVA'}: ${m.content}`)
  .join('\n')}

Patient's Current Message: ${userMessage}

Guidelines for your response:
1. Be supportive, encouraging, and positive
2. If discussing pumps, emphasize why their recommended pump is perfect for them
3. Provide specific, actionable advice
4. Use the patient's name occasionally for personalization
5. Keep responses concise but helpful
6. If they have concerns, address them with empathy
7. Celebrate their progress and commitment to health
8. For weight loss questions, provide evidence-based guidance
9. Always maintain HIPAA compliance

Respond naturally and conversationally:`;

    return context;
  };

  const speakResponse = async (text: string) => {
    setIsSpeaking(true);
    try {
      // Use Rachel voice for consistency
      await elevenLabsService.speak(text, '21m00Tcm4TlvDq8ikWAM');
    } catch (error) {
      logError('PatientChat', 'Error message', {});
    } finally {
      setIsSpeaking(false);
    }
  };

  const detectSentiment = (text: string): 'positive' | 'neutral' | 'concerned' => {
    const positiveWords = [
      'great',
      'excellent',
      'wonderful',
      'perfect',
      'amazing',
      'congratulations',
    ];
    const concernedWords = ['concern', 'worry', 'difficult', 'challenge', 'problem'];

    const lowerText = text.toLowerCase();

    if (positiveWords.some(word => lowerText.includes(word))) {
      return 'positive';
    }
    if (concernedWords.some(word => lowerText.includes(word))) {
      return 'concerned';
    }
    return 'neutral';
  };

  const detectTopic = (text: string): string => {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('pump') || lowerText.includes('insulin')) {
      return 'pumpdrive';
    }
    if (
      lowerText.includes('weight') ||
      lowerText.includes('diet') ||
      lowerText.includes('exercise')
    ) {
      return 'weightloss';
    }
    if (lowerText.includes('check') || lowerText.includes('progress')) {
      return 'progress';
    }
    return 'general';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/patient/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  AVA
                </div>
                <div>
                  <div className="font-semibold text-gray-900">AVA Health Assistant</div>
                  <div className="text-xs text-gray-500">Always here to help</div>
                </div>
              </div>
            </div>

            {isSpeaking && (
              <div className="flex items-center space-x-2 bg-blue-100 px-3 py-1 rounded-full">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <div
                    className="w-1.5 h-4 bg-blue-600 rounded-full animate-pulse"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-1.5 h-3 bg-blue-500 rounded-full animate-pulse"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <span className="text-xs text-blue-700">Speaking...</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto"
      >
        <div className="space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-2xl ${message.sender === 'patient' ? 'order-2' : 'order-1'}`}>
                <div className="flex items-end space-x-2">
                  {message.sender === 'ai' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      AVA
                    </div>
                  )}

                  <div>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.sender === 'patient'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white shadow-md'
                      }`}
                    >
                      <p className={message.sender === 'patient' ? 'text-white' : 'text-gray-800'}>
                        {message.content}
                      </p>
                      {message.type === 'voice' && (
                        <div
                          className={`text-xs mt-1 flex items-center space-x-1 ${
                            message.sender === 'patient' ? 'text-blue-100' : 'text-gray-400'
                          }`}
                        >
                          <span>🎤</span>
                          <span>Voice message</span>
                        </div>
                      )}
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        message.sender === 'patient' ? 'text-right' : 'text-left'
                      } text-gray-400`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>

                  {message.sender === 'patient' && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0">
                      {patient.firstName[0]}
                      {patient.lastName[0]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2 bg-white shadow-md rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Input Method Toggle */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setInputMethod('text')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  inputMethod === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'
                }`}
              >
                ⌨️ Type
              </button>
              <button
                onClick={() => setInputMethod('voice')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  inputMethod === 'voice' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'
                }`}
              >
                🎤 Voice
              </button>
            </div>
          </div>

          {inputMethod === 'text' ? (
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputText);
                  }
                }}
                placeholder="Type your message..."
                disabled={isProcessing}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => handleSendMessage(inputText)}
                disabled={!inputText.trim() || isProcessing}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  !inputText.trim() || isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700'
                }`}
              >
                Send
              </button>
            </div>
          ) : (
            <div className="text-center">
              {isRecording ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <button
                      onClick={stopRecording}
                      className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  </div>
                  {currentTranscript && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                      {currentTranscript}
                    </div>
                  )}
                  <p className="text-sm text-gray-500">Tap to stop recording</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <button
                      onClick={startRecording}
                      disabled={isProcessing}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
                        isProcessing
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700'
                      }`}
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18.75v3.25M8 21h8" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">Tap to start recording</p>
                </div>
              )}
            </div>
          )}

          {/* Suggested Questions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Try asking:</span>
            {patient.programs.pumpdrive?.finalRecommendations && (
              <button
                onClick={() => handleSendMessage('Tell me more about my recommended pump')}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200"
              >
                About my pump recommendation
              </button>
            )}
            {patient.programs.weightloss?.enrolled && (
              <>
                <button
                  onClick={() => handleSendMessage('What should I eat today?')}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200"
                >
                  Meal suggestions
                </button>
                <button
                  onClick={() => handleSendMessage('How can I stay motivated?')}
                  className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200"
                >
                  Motivation tips
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
