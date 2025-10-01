/**
 * ScheduleNavigation Component
 * Date navigation controls for the doctor dashboard
 * Created: September 16, 2025
 */

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  Home,
  Clock,
  Grid,
  List,
} from 'lucide-react';

interface ScheduleNavigationProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange?: (view: 'day' | 'week' | 'month') => void;
  currentView?: 'day' | 'week' | 'month';
  showViewToggle?: boolean;
}

export default function ScheduleNavigation({
  selectedDate,
  onDateChange,
  onViewChange,
  currentView = 'day',
  showViewToggle = true,
}: ScheduleNavigationProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Navigate to previous day
  const goToPrevious = () => {
    const previousDate = new Date(selectedDate);
    if (currentView === 'day') {
      previousDate.setDate(selectedDate.getDate() - 1);
    } else if (currentView === 'week') {
      previousDate.setDate(selectedDate.getDate() - 7);
    } else {
      previousDate.setMonth(selectedDate.getMonth() - 1);
    }
    onDateChange(previousDate);
  };

  // Navigate to next day
  const goToNext = () => {
    const nextDate = new Date(selectedDate);
    if (currentView === 'day') {
      nextDate.setDate(selectedDate.getDate() + 1);
    } else if (currentView === 'week') {
      nextDate.setDate(selectedDate.getDate() + 7);
    } else {
      nextDate.setMonth(selectedDate.getMonth() + 1);
    }
    onDateChange(nextDate);
  };

  // Go to today
  const goToToday = () => {
    onDateChange(new Date());
  };

  // Quick date navigation buttons
  const getQuickNavigationDates = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    return { today, yesterday, tomorrow, nextWeek, lastWeek };
  };

  const { today, yesterday, tomorrow, nextWeek, lastWeek } = getQuickNavigationDates();

  const formatDisplayDate = () => {
    const isToday = selectedDate.toDateString() === today.toDateString();
    const isTomorrow = selectedDate.toDateString() === tomorrow.toDateString();
    const isYesterday = selectedDate.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    if (isYesterday) return 'Yesterday';

    if (currentView === 'week') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    if (currentView === 'month') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isToday = selectedDate.toDateString() === today.toDateString();

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        {/* Left side - Navigation controls */}
        <div className="flex items-center space-x-4">
          {/* Previous/Next buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={`Previous ${currentView}`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={`Next ${currentView}`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Today button */}
          <button
            onClick={goToToday}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              isToday
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'
            } border`}
          >
            <div className="flex items-center space-x-2">
              <Home className="w-4 h-4" />
              <span>Today</span>
            </div>
          </button>

          {/* Current date display */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">{formatDisplayDate()}</h2>
          </div>
        </div>

        {/* Right side - View controls and quick navigation */}
        <div className="flex items-center space-x-4">
          {/* Quick date navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDateChange(yesterday)}
              className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            >
              Yesterday
            </button>

            <button
              onClick={() => onDateChange(tomorrow)}
              className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            >
              Tomorrow
            </button>

            <button
              onClick={() => onDateChange(nextWeek)}
              className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            >
              Next Week
            </button>
          </div>

          {/* Date picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Select specific date"
            >
              <CalendarDays className="w-5 h-5" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={e => {
                    onDateChange(new Date(e.target.value + 'T12:00:00'));
                    setShowDatePicker(false);
                  }}
                  className="p-3 border-none outline-none rounded-lg"
                />
              </div>
            )}
          </div>

          {/* View toggle buttons */}
          {showViewToggle && onViewChange && (
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => onViewChange('day')}
                className={`p-2 transition-colors ${
                  currentView === 'day'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Day view"
              >
                <Clock className="w-4 h-4" />
              </button>

              <button
                onClick={() => onViewChange('week')}
                className={`p-2 transition-colors ${
                  currentView === 'week'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Week view"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                onClick={() => onViewChange('month')}
                className={`p-2 transition-colors ${
                  currentView === 'month'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Month view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Additional info bar */}
      <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <span>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span>15-minute slots • 9:00 AM - 5:30 PM</span>
        </div>
      </div>
    </div>
  );
}
