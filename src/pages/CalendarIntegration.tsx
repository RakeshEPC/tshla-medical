import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';

export default function CalendarIntegration() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const doctorName = currentUser?.name || user?.name || 'Dr. Smith';

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('week');

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const currentDay = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  };

  const formatDateDisplay = (date: Date) => {
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      isCurrentMonth: date.getMonth() === new Date(selectedDate).getMonth(),
      isToday: date.toDateString() === new Date().toDateString(),
    };
  };

  const days = generateCalendarDays();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">📅 Calendar Integration</h1>
              <p className="text-gray-600 mt-1">Manage appointments and schedule integration</p>
              <p className="text-sm text-blue-600 mt-1">Welcome, {doctorName}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/staff-dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={() => navigate('/quick-note')}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                📝 Quick Note
              </button>
              <button
                onClick={() => logout()}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const date = new Date(selectedDate);
                  date.setMonth(date.getMonth() - 1);
                  setSelectedDate(date.toISOString().split('T')[0]);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                ← Previous
              </button>

              <h2 className="text-xl font-semibold">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>

              <button
                onClick={() => {
                  const date = new Date(selectedDate);
                  date.setMonth(date.getMonth() + 1);
                  setSelectedDate(date.toISOString().split('T')[0]);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                Next →
              </button>
            </div>

            <div className="flex gap-2">
              {(['month', 'week', 'day'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setCalendarView(view)}
                  className={`px-3 py-1 rounded text-sm ${
                    calendarView === view
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {calendarView === 'month' && (
            <>
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  const dateInfo = formatDateDisplay(day);
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day.toISOString().split('T')[0])}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded hover:bg-blue-50
                        ${!dateInfo.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${dateInfo.isToday ? 'bg-blue-600 text-white font-bold' : ''}
                        ${selectedDate === day.toISOString().split('T')[0] && !dateInfo.isToday ? 'bg-blue-100 text-blue-700' : ''}
                      `}
                    >
                      {dateInfo.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {calendarView === 'week' && (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-4">Week View</h3>
              <p className="text-gray-600 mb-4">Weekly calendar view coming soon...</p>
              <button
                onClick={() => navigate('/staff-dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Return to Daily Schedule
              </button>
            </div>
          )}

          {calendarView === 'day' && (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-4">Day View</h3>
              <p className="text-gray-600 mb-4">Day view available in main dashboard</p>
              <button
                onClick={() => navigate('/staff-dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Daily Schedule
              </button>
            </div>
          )}
        </div>

        {/* Integration Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Calendar Integration Status</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span>Voice Assistant Calendar Booking: Active</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span>Internal Appointment System: Connected</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              <span>External Calendar Sync: Development</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span>Patient Notifications: Configured</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800">Calendar Integration Features:</h4>
            <ul className="mt-2 text-sm text-blue-700 space-y-1">
              <li>• Voice appointment booking through phone system</li>
              <li>• Real-time appointment creation from calls</li>
              <li>• Patient information collection and verification</li>
              <li>• Automatic time slot management</li>
              <li>• Integration with existing medical records</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
