import { useState } from 'react';
import { AthenaScheduleUploader } from '../components/AthenaScheduleUploader';
import { scheduleService } from '../services/scheduleService';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import type { ParsedAthenaAppointment, ImportError } from '../types/schedule.types';

export default function ScheduleUploadPage() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportSuccess = async (
    appointments: ParsedAthenaAppointment[],
    mode: 'merge' | 'replace',
    scheduleDate: string
  ) => {
    setIsImporting(true);
    setMessage(null);

    try {
      // Get current user email for audit trail
      const result = await supabaseAuthService.getCurrentUser();
      const userEmail = result.user?.email || 'admin@tshla.ai';

      // Import to database
      const importResult = await scheduleService.importAthenaSchedule(
        appointments,
        scheduleDate,
        userEmail,
        mode
      );

      // Count status breakdown
      const statusCounts = appointments.reduce((acc, apt) => {
        acc[apt.status || 'scheduled'] = (acc[apt.status || 'scheduled'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setMessage({
        type: 'success',
        text: `Successfully imported ${importResult.summary.successful} appointments for ${scheduleDate}!

Status Breakdown:
- Scheduled: ${statusCounts.scheduled || 0}
- Checked In: ${statusCounts['checked-in'] || 0}
- In Progress: ${statusCounts['in-progress'] || 0}
- Completed: ${statusCounts.completed || 0}
- Cancelled: ${statusCounts.cancelled || 0}

${mode === 'replace' ? '✓ Cleared and replaced all appointments for this date' : '✓ Merged with existing appointments'}`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportError = (errors: ImportError[]) => {
    setMessage({
      type: 'error',
      text: `Failed to parse file: ${errors.map(e => e.message).join(', ')}`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📅 Upload Daily Schedule from Athena
          </h1>
          <p className="text-gray-600">
            Import your schedule from Athena Health to keep tshla.ai in sync
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-blue-900 mb-3 text-lg">
            📋 Daily Upload Instructions
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Log into Athena Health</li>
            <li>Run saved report: <strong>"Tshla schedule"</strong> for <strong>TODAY only</strong></li>
            <li>Export to CSV file (downloads to your computer)</li>
            <li>Drag the CSV file into the upload area below</li>
            <li>Click "Parse Schedule File" to preview</li>
            <li>Review the appointments and click "Import to Database"</li>
            <li>Done! Takes about 30 seconds total</li>
          </ol>

          <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> Upload twice daily for best results:
            </p>
            <ul className="list-disc list-inside text-xs text-blue-800 mt-2 ml-2">
              <li><strong>7:30 AM</strong> - Morning upload before clinic starts</li>
              <li><strong>12:30 PM</strong> - Afternoon upload to catch changes</li>
            </ul>
          </div>
        </div>

        {/* Uploader Component */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <AthenaScheduleUploader
            onImportSuccess={handleImportSuccess}
            onImportError={handleImportError}
          />

          {/* Import Status */}
          {isImporting && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 font-medium">Importing appointments to database...</span>
              </div>
            </div>
          )}

          {/* Success/Error Message */}
          {message && (
            <div
              className={`mt-4 p-4 rounded-lg whitespace-pre-line ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Help Footer */}
        <div className="mt-6 bg-gray-100 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your administrator or check the{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 underline">
              schedule upload guide
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
