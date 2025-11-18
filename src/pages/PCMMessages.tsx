/**
 * PCM Messages Page
 * Two-way messaging between patients and their PCM care team
 * Created: 2025-01-18
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Phone,
  AlertCircle,
  FileText,
  Heart,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Filter
} from 'lucide-react';
import { pcmService } from '../services/pcm.service';

interface Message {
  id: string;
  threadId: string;
  from: 'patient' | 'staff';
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
  category?: 'question' | 'concern' | 'update' | 'urgent';
}

interface MessageThread {
  id: string;
  subject: string;
  category: 'question' | 'concern' | 'update' | 'urgent';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'resolved';
}

export default function PCMMessages() {
  const navigate = useNavigate();
  const [view, setView] = useState<'inbox' | 'thread' | 'new'>('inbox');
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newThreadSubject, setNewThreadSubject] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState<'question' | 'concern' | 'update' | 'urgent'>('question');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock patient data
  const patient = {
    id: 'demo-patient-001',
    name: 'Jane Smith'
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id);
    }
  }, [selectedThread]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreads = async () => {
    try {
      const data = await pcmService.getMessageThreads(patient.id);
      setThreads(data);
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const data = await pcmService.getMessages(threadId);
      setMessages(data);
      // Mark as read
      await pcmService.markThreadAsRead(threadId);
      await loadThreads();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      if (view === 'new') {
        // Create new thread
        const threadId = await pcmService.createMessageThread(patient.id, {
          subject: newThreadSubject || 'New Message',
          category: newThreadCategory,
          initialMessage: newMessage
        });
        setNewMessage('');
        setNewThreadSubject('');
        setView('inbox');
        await loadThreads();
      } else if (selectedThread) {
        // Reply to existing thread
        await pcmService.sendMessage(selectedThread.id, {
          from: 'patient',
          content: newMessage
        });
        setNewMessage('');
        await loadMessages(selectedThread.id);
        await loadThreads();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'concern':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'question':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'update':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'urgent':
        return <AlertCircle className="w-4 h-4" />;
      case 'concern':
        return <Heart className="w-4 h-4" />;
      case 'question':
        return <MessageCircle className="w-4 h-4" />;
      case 'update':
        return <FileText className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const quickTemplates = [
    "I have a question about my medication",
    "I need to reschedule my appointment",
    "I'm experiencing side effects",
    "I forgot to take my medication",
    "My blood sugar is higher than normal"
  ];

  const filteredThreads = threads.filter(thread =>
    thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (view === 'inbox') {
                    navigate('/pcm/patient');
                  } else {
                    setView('inbox');
                    setSelectedThread(null);
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {view === 'inbox' && 'Messages'}
                  {view === 'thread' && selectedThread?.subject}
                  {view === 'new' && 'New Message'}
                </h1>
                <p className="text-sm text-gray-600">
                  {view === 'inbox' && 'Communicate with your PCM care team'}
                  {view === 'thread' && 'Message conversation'}
                  {view === 'new' && 'Start a new conversation'}
                </p>
              </div>
            </div>
            {view === 'inbox' && (
              <button
                onClick={() => setView('new')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Message
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Inbox View */}
        {view === 'inbox' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Thread List */}
            <div className="space-y-3">
              {filteredThreads.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-gray-600 mb-6">Start a conversation with your care team</p>
                  <button
                    onClick={() => setView('new')}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Send Your First Message
                  </button>
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setSelectedThread(thread);
                      setView('thread');
                    }}
                    className={`bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition border-l-4 ${
                      thread.unreadCount > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`font-bold text-gray-900 ${thread.unreadCount > 0 ? 'text-purple-900' : ''}`}>
                            {thread.subject}
                          </h3>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${getCategoryColor(thread.category)} flex items-center gap-1`}>
                            {getCategoryIcon(thread.category)}
                            {thread.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{thread.lastMessage}</p>
                      </div>
                      {thread.unreadCount > 0 && (
                        <div className="ml-4 bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          {thread.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(thread.lastMessageTime).toLocaleString()}
                      </div>
                      {thread.status === 'resolved' && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Thread View */}
        {view === 'thread' && selectedThread && (
          <div className="bg-white rounded-xl shadow-sm flex flex-col" style={{ height: 'calc(100vh - 250px)' }}>
            {/* Thread Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${getCategoryColor(selectedThread.category)} flex items-center gap-1`}>
                    {getCategoryIcon(selectedThread.category)}
                    {selectedThread.category}
                  </span>
                </div>
                {selectedThread.status === 'active' && (
                  <button
                    onClick={async () => {
                      await pcmService.resolveThread(selectedThread.id);
                      await loadThreads();
                      setView('inbox');
                    }}
                    className="text-sm text-green-600 hover:text-green-700 font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as Resolved
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.from === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-4 ${
                      message.from === 'patient'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-xs font-semibold mb-1 opacity-75">
                      {message.senderName}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs mt-2 opacity-75">
                      {new Date(message.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message... (Press Enter to send)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !newMessage.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-fit"
                >
                  <Send className="w-5 h-5" />
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Message View */}
        {view === 'new' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                What's this about? *
              </label>
              <input
                type="text"
                value={newThreadSubject}
                onChange={(e) => setNewThreadSubject(e.target.value)}
                placeholder="Brief subject line"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Message Type *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['question', 'concern', 'update', 'urgent'] as const).map((category) => (
                  <button
                    key={category}
                    onClick={() => setNewThreadCategory(category)}
                    className={`p-4 rounded-lg border-2 transition ${
                      newThreadCategory === category
                        ? getCategoryColor(category) + ' border-current'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {getCategoryIcon(category)}
                      <span className="font-semibold capitalize">{category}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Message *
              </label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={6}
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Quick Templates:</div>
              <div className="flex flex-wrap gap-2">
                {quickTemplates.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNewMessage(template)}
                    className="text-xs px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setView('inbox')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isSending || !newMessage.trim() || !newThreadSubject.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                {isSending ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-blue-900">Response Time</div>
                  <div className="text-sm text-blue-700">
                    Our care team typically responds within 24 hours. For urgent medical issues, please call 911.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
