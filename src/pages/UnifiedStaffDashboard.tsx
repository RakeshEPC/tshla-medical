/**
 * Unified Staff Dashboard
 * Single-pane-of-glass view for all PCM staff workflows
 * Replaces navigation between 6 different pages
 * Created: 2025-01-26
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  Phone,
  Beaker,
  BarChart3,
  Search,
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Activity
} from 'lucide-react';
import DoctorNavBar from '../components/layout/DoctorNavBar';
import StatsCards from '../components/staff/StatsCards';
import GlobalSearch from '../components/staff/GlobalSearch';
import PriorityQueueSidebar from '../components/staff/PriorityQueueSidebar';
import TodayScheduleTab from '../components/staff/tabs/TodayScheduleTab';
import PCMCallsTab from '../components/staff/tabs/PCMCallsTab';
import LabQueueTab from '../components/staff/tabs/LabQueueTab';
import ReportsTab from '../components/staff/tabs/ReportsTab';
import { usePCMEnrollment } from '../hooks/usePCMEnrollment';
import { usePCMRealtime } from '../hooks/usePCMRealtime';

type TabView = 'schedule' | 'calls' | 'labs' | 'reports';

export default function UnifiedStaffDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State
  const [currentTab, setCurrentTab] = useState<TabView>('schedule');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');

  // Load active enrollments for stats
  const { enrollments, isLoading } = usePCMEnrollment({
    filters: { is_active: true },
    autoLoad: true
  });

  // Real-time alerts
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  usePCMRealtime({
    onAbnormalVital: (vital) => {
      setRealtimeAlerts(prev => [...prev, {
        type: 'abnormal_vital',
        message: 'Abnormal vital signs detected',
        data: vital,
        timestamp: new Date()
      }]);
      // Show notification
      showNotification('⚠️ Abnormal Vital', 'Check priority queue for details');
    },
    onUrgentLab: (lab) => {
      setRealtimeAlerts(prev => [...prev, {
        type: 'urgent_lab',
        message: `${lab.priority.toUpperCase()} lab order created`,
        data: lab,
        timestamp: new Date()
      }]);
      showNotification('🚨 Urgent Lab', lab.tests_requested.join(', '));
    },
    enabled: true
  });

  // Calculate quick stats
  const stats = {
    totalPatients: enrollments.length,
    highRiskPatients: enrollments.filter(e => e.risk_level === 'high').length,
    pendingTasks: 0, // Will be calculated from priority queue
    todayAppointments: 0 // Will be calculated from schedule
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Numbers 1-4 for tabs
      if (e.key >= '1' && e.key <= '4') {
        const tabs: TabView[] = ['schedule', 'calls', 'labs', 'reports'];
        setCurrentTab(tabs[parseInt(e.key) - 1]);
      }
      // Escape to close search
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const showNotification = (title: string, message: string) => {
    // Use browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/tshla-icon.png',
        badge: '/tshla-icon.png'
      });
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'schedule' as TabView,
      name: "Today's Schedule",
      icon: Calendar,
      badge: stats.todayAppointments,
      shortcut: '1'
    },
    {
      id: 'calls' as TabView,
      name: 'PCM Calls',
      icon: Phone,
      badge: 0, // From PCM service
      shortcut: '2'
    },
    {
      id: 'labs' as TabView,
      name: 'Lab Queue',
      icon: Beaker,
      badge: stats.pendingTasks,
      shortcut: '3'
    },
    {
      id: 'reports' as TabView,
      name: 'Reports',
      icon: BarChart3,
      badge: 0,
      shortcut: '4'
    }
  ];

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <DoctorNavBar />

      {/* Main Container */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Section */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Staff Dashboard
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              {/* Search Button */}
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <Search className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">Search</span>
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Stats Cards */}
            <StatsCards
              stats={stats}
              isLoading={isLoading}
            />
          </div>

          {/* Tab Navigation */}
          <div className="bg-white border-b border-gray-200 px-6">
            <nav className="flex space-x-1" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentTab(tab.id)}
                    className={`
                      relative px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
                      ${isActive
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                      {tab.badge > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                          {tab.badge}
                        </span>
                      )}
                      <kbd className="hidden lg:inline-flex ml-2 px-1.5 py-0.5 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded">
                        {tab.shortcut}
                      </kbd>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-6">
            {currentTab === 'schedule' && (
              <TodayScheduleTab
                selectedDate={selectedDate}
                selectedProvider={selectedProvider}
                onDateChange={setSelectedDate}
                onProviderChange={setSelectedProvider}
              />
            )}

            {currentTab === 'calls' && (
              <PCMCallsTab enrollments={enrollments} />
            )}

            {currentTab === 'labs' && (
              <LabQueueTab />
            )}

            {currentTab === 'reports' && (
              <ReportsTab enrollments={enrollments} />
            )}
          </div>
        </div>

        {/* Right Sidebar - Priority Queue */}
        <PriorityQueueSidebar
          onTaskClick={(task) => {
            // Navigate to appropriate tab based on task type
            if (task.type === 'lab') {
              setCurrentTab('labs');
            } else if (task.type === 'call') {
              setCurrentTab('calls');
            }
          }}
          realtimeAlerts={realtimeAlerts}
          onAlertDismiss={(index) => {
            setRealtimeAlerts(prev => prev.filter((_, i) => i !== index));
          }}
        />
      </div>

      {/* Global Search Modal */}
      {showSearch && (
        <GlobalSearch
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onNavigate={(path) => {
            setShowSearch(false);
            navigate(path);
          }}
        />
      )}

      {/* Real-time Connection Indicator */}
      <div className="fixed bottom-4 left-4 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className={`w-2 h-2 rounded-full ${
          realtimeAlerts.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`} />
        <span className="text-xs text-gray-600">
          Real-time monitoring active
        </span>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-4 right-[320px] bg-white border border-gray-200 rounded-lg shadow-sm p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Keyboard Shortcuts</h4>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-600">Search</span>
            <kbd className="px-2 py-0.5 font-mono bg-gray-100 border border-gray-300 rounded">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-600">Switch tabs</span>
            <kbd className="px-2 py-0.5 font-mono bg-gray-100 border border-gray-300 rounded">1-4</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
