/**
 * PatientMessagesInbox
 * Staff inbox for viewing and responding to patient messages
 * Messages come from patient_messages table (patient portal MESSAGES screen)
 * Created: 2026-02-06
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Phone,
  Pill,
  AlertTriangle,
  HelpCircle,
  PlusCircle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  User,
  RefreshCw,
  ChevronRight,
  X,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Message {
  id: string;
  unified_patient_id: string;
  sender: 'patient' | 'staff' | 'system';
  content: string;
  category?: string;
  status: 'unread' | 'read' | 'resolved' | 'pending';
  created_at: string;
  read_at?: string;
  resolved_at?: string;
  ai_priority?: string;
  ai_suggested_action?: string;
}

interface MessageThread {
  thread_id: string;
  unified_patient_id: string;
  tshla_id: string;
  patient_name: string;
  category: string;
  message_count: number;
  last_message_at: string;
  first_message: string;
  has_unread: boolean;
  has_pending: boolean;
}

interface PatientInfo {
  tshla_id: string;
  full_name: string;
  phone_display: string;
}

const CATEGORY_CONFIG = {
  refill: {
    icon: Pill,
    label: 'Refill Request',
    color: 'bg-blue-100 text-blue-800',
  },
  side_effect: {
    icon: AlertTriangle,
    label: 'Side Effect',
    color: 'bg-yellow-100 text-yellow-800',
  },
  clarification: {
    icon: HelpCircle,
    label: 'Question',
    color: 'bg-purple-100 text-purple-800',
  },
  new_symptom: {
    icon: PlusCircle,
    label: 'New Symptom',
    color: 'bg-red-100 text-red-800',
  },
};

export default function PatientMessagesInbox() {
  const navigate = useNavigate();
  const [view, setView] = useState<'inbox' | 'thread'>('inbox');
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('unread');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads();
  }, [filterCategory, filterStatus]);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.thread_id, selectedThread.unified_patient_id);
    }
  }, [selectedThread]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/staff/message-threads?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to load threads');
      }

      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Failed to load message threads:', error);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string, patientId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/staff/messages/${patientId}?thread_id=${threadId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setPatientInfo(data.patient || null);

      // Mark as read
      await fetch(
        `${API_BASE_URL}/api/patient-portal/staff/messages/${patientId}/mark-read`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thread_id: threadId }),
        }
      );
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    setSending(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/staff/messages/${selectedThread.unified_patient_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newMessage.trim(),
            thread_id: selectedThread.thread_id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setNewMessage('');
      // Reload messages
      await loadMessages(selectedThread.thread_id, selectedThread.unified_patient_id);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedThread) return;

    try {
      await fetch(
        `${API_BASE_URL}/api/patient-portal/staff/messages/${selectedThread.unified_patient_id}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thread_id: selectedThread.thread_id }),
        }
      );

      // Go back to inbox and refresh
      setView('inbox');
      setSelectedThread(null);
      loadThreads();
    } catch (error) {
      console.error('Failed to resolve thread:', error);
    }
  };

  const handleSelectThread = (thread: MessageThread) => {
    setSelectedThread(thread);
    setView('thread');
  };

  const handleBackToInbox = () => {
    setView('inbox');
    setSelectedThread(null);
    setMessages([]);
    loadThreads();
  };

  const filteredThreads = threads.filter((thread) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        thread.patient_name.toLowerCase().includes(query) ||
        thread.tshla_id.toLowerCase().includes(query) ||
        thread.first_message.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const msgDate = new Date(date);
    const diff = now.getTime() - msgDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return msgDate.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <MessageCircle className="w-8 h-8 text-indigo-600" />
                Patient Messages
              </h1>
              <p className="text-gray-600 mt-1">
                {filterStatus === 'unread'
                  ? `${threads.filter((t) => t.has_unread).length} unread messages`
                  : `${threads.length} message threads`}
              </p>
            </div>

            <button
              onClick={loadThreads}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {view === 'inbox' ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by patient name, ID, or message..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    <option value="refill">Refill Requests</option>
                    <option value="side_effect">Side Effects</option>
                    <option value="clarification">Questions</option>
                    <option value="new_symptom">New Symptoms</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="unread">Unread</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Thread List */}
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">Loading messages...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No messages found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Patient messages will appear here when they send a message from the portal.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredThreads.map((thread) => {
                  const categoryConfig =
                    CATEGORY_CONFIG[thread.category as keyof typeof CATEGORY_CONFIG];
                  const CategoryIcon = categoryConfig?.icon || MessageCircle;

                  return (
                    <div
                      key={thread.thread_id}
                      onClick={() => handleSelectThread(thread)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        thread.has_unread ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-full ${
                            categoryConfig?.color || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <CategoryIcon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">
                                {thread.patient_name}
                              </span>
                              <span className="text-xs text-gray-500 font-mono">
                                {thread.tshla_id}
                              </span>
                              {thread.has_unread && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(thread.last_message_at)}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 truncate">
                            {thread.first_message}
                          </p>

                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                categoryConfig?.color || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {categoryConfig?.label || thread.category}
                            </span>
                            <span className="text-xs text-gray-400">
                              {thread.message_count} message
                              {thread.message_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Thread View */
          <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
            {/* Thread Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleBackToInbox}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        {patientInfo?.full_name || selectedThread?.patient_name}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="font-mono">
                          {patientInfo?.tshla_id || selectedThread?.tshla_id}
                        </span>
                        {patientInfo?.phone_display && (
                          <>
                            <span>•</span>
                            <Phone className="w-3 h-3" />
                            <span>{patientInfo.phone_display}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/patient-chart?tshla_id=${
                          patientInfo?.tshla_id || selectedThread?.tshla_id
                        }`
                      )
                    }
                    className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    View Chart
                  </button>
                  <button
                    onClick={handleResolve}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Resolved
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === 'patient' ? 'justify-start' : 'justify-end'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.sender === 'patient'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {message.category && message.sender === 'patient' && (
                      <div className="mb-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            CATEGORY_CONFIG[message.category as keyof typeof CATEGORY_CONFIG]
                              ?.color || 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {CATEGORY_CONFIG[message.category as keyof typeof CATEGORY_CONFIG]
                            ?.label || message.category}
                        </span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p
                      className={`text-xs mt-2 ${
                        message.sender === 'patient' ? 'text-gray-500' : 'text-indigo-200'
                      }`}
                    >
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your response..."
                  rows={2}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    newMessage.trim() && !sending
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
