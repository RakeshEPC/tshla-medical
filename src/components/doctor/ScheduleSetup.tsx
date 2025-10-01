'use client';
import { scheduleStorage } from '@/lib/schedule-storage';

export default function ScheduleSetup({ onComplete }: { onComplete: () => void }) {
  const initializeWithDemoData = () => {
    scheduleStorage.initializeDemoData();
    alert('Demo schedule created! You can now see sample appointments.');
    onComplete();
  };

  const startFresh = () => {
    scheduleStorage.clearAll();
    alert('Starting with a clean schedule.');
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Welcome to Doctor Schedule</h2>
        <p className="text-gray-600 mb-6">
          This is your first time using the schedule. Would you like to:
        </p>

        <div className="space-y-4">
          <button
            onClick={initializeWithDemoData}
            className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <div className="font-semibold">Load Demo Schedule</div>
            <div className="text-sm mt-1">See sample appointments to understand the system</div>
          </button>

          <button
            onClick={startFresh}
            className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <div className="font-semibold">Start Fresh</div>
            <div className="text-sm mt-1">Begin with an empty schedule</div>
          </button>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Your schedule data is stored locally in your browser. Use the
            Export button to save backups.
          </p>
        </div>
      </div>
    </div>
  );
}
