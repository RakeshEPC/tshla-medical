/**
 * Patient Portal AI Chat Section
 * Voice-enabled diabetes education chat with AI (Rachel)
 * Uses comprehensive H&P for personalized responses
 * Created: 2026-01-23
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Volume2,
  VolumeX,
  Loader2,
  ArrowLeft,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string | null;
  timestamp: Date;
  isPlaying?: boolean;
  rated?: boolean | null;
}

export default function PatientPortalAIChatSection() {
  const navigate = useNavigate();
  const location = useLocation();

  // Session
  const [session, setSession] = useState<PatientSession | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [questionsRemaining, setQuestionsRemaining] = useState(20);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Audio
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Load session
   */
  useEffect(() => {
    const stateSession = location.state?.session;
    if (stateSession) {
      setSession(stateSession);
      return;
    }

    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession) {
      navigate('/patient-portal-login');
      return;
    }

    setSession(JSON.parse(savedSession));
  }, [navigate, location.state]);

  /**
   * Load stats
   */
  useEffect(() => {
    if (!session) return;
    loadStats();
  }, [session]);

  /**
   * Scroll to bottom on new messages
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Load question stats
   */
  const loadStats = async () => {
    if (!session) return;

    setIsLoadingStats(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ai-chat/stats?tshlaId=${session.tshlaId}`,
        {
          headers: { 'x-session-id': session.sessionId },
        }
      );

      const data = await response.json();

      if (data.success) {
        setQuestionsRemaining(data.stats.questionsRemaining);
      }
    } catch (err) {
      console.error('Load stats error:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  /**
   * Send message
   */
  const sendMessage = async () => {
    if (!inputMessage.trim() || !session || isSending) return;

    if (inputMessage.length > 500) {
      setError('Message is too long. Please keep it under 500 characters.');
      return;
    }

    if (questionsRemaining <= 0) {
      setError('You\'ve reached your daily limit of 20 questions. Please try again tomorrow.');
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputMessage('');
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': session.sessionId,
        },
        body: JSON.stringify({
          tshlaId: session.tshlaId,
          message: userMessage.content,
          sessionId: session.sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        audioUrl: data.audioUrl,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setQuestionsRemaining((prev) => Math.max(0, prev - 1));

      // Auto-play audio if enabled
      if (audioEnabled && data.audioUrl) {
        playAudio(assistantMessage.id, data.audioUrl);
      }

      // Show urgent alert if detected
      if (data.urgentAlert) {
        alert(
          'URGENT: We\'ve detected urgent symptoms and notified your care team. If this is an emergency, please call 911 immediately.'
        );
      }
    } catch (err: any) {
      console.error('Send message error:', err);
      setError(err.message || 'Failed to send message. Please try again.');
      // Remove user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Play audio
   */
  const playAudio = (messageId: string, audioUrl: string) => {
    if (!audioUrl) return;

    // Stop any currently playing audio
    Object.values(audioRefs.current).forEach((audio) => audio.pause());

    const audio = new Audio(audioUrl);
    audioRefs.current[messageId] = audio;

    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        isPlaying: m.id === messageId ? true : false,
      }))
    );

    audio.addEventListener('ended', () => {
      setMessages((prev) =>
        prev.map((m) => ({ ...m, isPlaying: false }))
      );
    });

    audio.play();
  };

  /**
   * Toggle audio for message
   */
  const toggleAudio = (messageId: string, audioUrl: string | null) => {
    if (!audioUrl) return;

    const audio = audioRefs.current[messageId];
    const message = messages.find((m) => m.id === messageId);

    if (message?.isPlaying) {
      audio?.pause();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isPlaying: false } : m
        )
      );
    } else {
      playAudio(messageId, audioUrl);
    }
  };

  /**
   * Rate message
   */
  const rateMessage = async (messageId: string, helpful: boolean) => {
    try {
      await fetch(`${API_BASE_URL}/api/ai-chat/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': session?.sessionId || '',
        },
        body: JSON.stringify({
          conversationId: messageId,
          helpful,
        }),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, rated: helpful } : m
        )
      );
    } catch (err) {
      console.error('Rate message error:', err);
    }
  };

  /**
   * Handle Enter key
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-lg p-4 border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Ask Rachel</h1>
                <p className="text-sm text-gray-600">Your Diabetes Educator</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`p-2 rounded-lg ${
                  audioEnabled
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
                title={audioEnabled ? 'Disable audio' : 'Enable audio'}
              >
                {audioEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </button>

              <div className="text-right">
                <p className="text-xs text-gray-500">Questions today</p>
                <p className="text-lg font-bold text-gray-900">
                  {20 - questionsRemaining} / 20
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="max-w-4xl mx-auto flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">I'm here to help with diabetes education!</p>
            <p className="mt-1">
              Ask me about your medications, lab results, diet, exercise, or general diabetes
              care. I can't diagnose or prescribe, but I can explain and educate.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Hi {session.patientName.split(' ')[0]}! 👋
              </h2>
              <p className="text-gray-600 mb-6">
                I'm Rachel, your diabetes educator. What would you like to learn about today?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <button
                  onClick={() => setInputMessage('What should my A1C goal be?')}
                  className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    What should my A1C goal be?
                  </p>
                </button>
                <button
                  onClick={() =>
                    setInputMessage('Tell me about my medications')
                  }
                  className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    Tell me about my medications
                  </p>
                </button>
                <button
                  onClick={() => setInputMessage('What foods should I eat?')}
                  className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    What foods should I eat?
                  </p>
                </button>
                <button
                  onClick={() =>
                    setInputMessage('How much should I exercise?')
                  }
                  className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    How much should I exercise?
                  </p>
                </button>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xl rounded-2xl p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {message.role === 'assistant' && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      {message.audioUrl && (
                        <button
                          onClick={() =>
                            toggleAudio(message.id, message.audioUrl!)
                          }
                          className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200"
                        >
                          {message.isPlaying ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => rateMessage(message.id, true)}
                        disabled={message.rated !== null && message.rated !== undefined}
                        className={`p-2 rounded-lg ${
                          message.rated === true
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                        } disabled:opacity-50`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rateMessage(message.id, false)}
                        disabled={message.rated !== null && message.rated !== undefined}
                        className={`p-2 rounded-lg ${
                          message.rated === false
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
                        } disabled:opacity-50`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs opacity-50 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="max-w-xl bg-white border-2 border-gray-200 rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                  <p className="text-sm text-gray-600">Rachel is thinking...</p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 p-4">
          <div className="max-w-4xl mx-auto flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about diabetes..."
                rows={3}
                maxLength={500}
                disabled={isSending || questionsRemaining <= 0}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  {inputMessage.length} / 500 characters
                </p>
                {questionsRemaining <= 5 && (
                  <p className="text-xs text-orange-600 font-medium">
                    {questionsRemaining} questions remaining today
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isSending || questionsRemaining <= 0}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 h-[60px]"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
