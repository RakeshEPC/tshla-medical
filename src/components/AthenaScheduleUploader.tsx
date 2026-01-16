import { useState, useRef } from 'react';
import { athenaScheduleParserService } from '../services/athenaScheduleParser.service';
import type { ParsedAthenaAppointment, ImportError } from '../types/schedule.types';

interface AthenaScheduleUploaderProps {
  onImportSuccess: (appointments: ParsedAthenaAppointment[], mode: 'replace', scheduleDate: string) => void;
  onImportError: (errors: ImportError[]) => void;
}

export function AthenaScheduleUploader({ onImportSuccess, onImportError }: AthenaScheduleUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const importMode = 'replace'; // Always use replace mode for daily uploads
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<{
    appointments: ParsedAthenaAppointment[];
    errors: ImportError[];
    warnings: string[];
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'text/tab-separated-values',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    const validExtensions = ['.csv', '.tsv', '.txt', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setMessage({
        type: 'error',
        text: 'Invalid file type. Please upload a CSV, TSV, or Excel file.',
      });
      return;
    }

    setSelectedFile(file);
    setMessage(null);
    setParsedData(null);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Parse the file
  const handleParseFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      // Read file content
      const content = await selectedFile.text();

      // Parse with Athena parser
      const result = await athenaScheduleParserService.parseScheduleFile(content);

      setParsedData(result);

      if (result.appointments.length === 0) {
        setMessage({
          type: 'error',
          text: 'No valid appointments found in file. Please check the format.',
        });
      } else {
        setMessage({
          type: 'success',
          text: `Successfully parsed ${result.appointments.length} appointments! Review and click Import.`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to parse file',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Import parsed appointments
  const handleImport = () => {
    if (!parsedData || parsedData.appointments.length === 0) return;

    // Auto-detect date from appointments
    const detectedDate = parsedData.appointments[0]?.date || scheduleDate;

    onImportSuccess(parsedData.appointments, importMode, detectedDate);
  };

  // Group appointments by provider
  const getProviderSummary = () => {
    if (!parsedData) return {};

    const summary: Record<string, { count: number; provider: string }> = {};

    parsedData.appointments.forEach(apt => {
      const key = apt.providerId || apt.providerName;
      if (!summary[key]) {
        summary[key] = { count: 0, provider: apt.providerName };
      }
      summary[key].count++;
    });

    return summary;
  };

  return (
    <div className="space-y-6">
      {/* Import Mode Info */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">🔄</div>
          <div className="flex-1">
            <div className="font-semibold text-blue-900 mb-1">
              Replace Mode (Daily Upload)
            </div>
            <div className="text-sm text-gray-700">
              This will clear all existing appointments for the selected date and import fresh data from Athena.
              Perfect for your twice-daily schedule updates.
            </div>
          </div>
        </div>
      </div>

      {/* Date Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Schedule Date *
        </label>
        <input
          type="date"
          value={scheduleDate}
          onChange={e => setScheduleDate(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Athena Schedule File *
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xls,.xlsx"
            onChange={e => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-2">
              <div className="text-4xl">📄</div>
              <div className="font-medium text-green-700">{selectedFile.name}</div>
              <div className="text-sm text-gray-600">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setParsedData(null);
                }}
                className="text-sm text-red-600 hover:text-red-700 underline"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">📁</div>
              <div className="font-medium text-gray-700">
                Drop Athena schedule file here
              </div>
              <div className="text-sm text-gray-500">
                or click to browse
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Accepts: CSV, TSV, XLS, XLSX
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parse Button */}
      {selectedFile && !parsedData && (
        <button
          onClick={handleParseFile}
          disabled={isProcessing}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Parsing file...
            </span>
          ) : (
            'Parse Schedule File'
          )}
        </button>
      )}

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : message.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Parsed Data Preview */}
      {parsedData && parsedData.appointments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">
              Parsed {parsedData.appointments.length} Appointments
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Review the summary below and click Import to add to database
            </p>
          </div>

          {/* Provider Summary */}
          <div className="p-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-2">By Provider:</h4>
            {Object.entries(getProviderSummary()).map(([key, { count, provider }]) => (
              <div
                key={key}
                className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded"
              >
                <span className="font-medium text-gray-900">{provider}</span>
                <span className="text-sm text-blue-600">{count} appointments</span>
              </div>
            ))}
          </div>

          {/* Errors (if any) */}
          {parsedData.errors.length > 0 && (
            <div className="p-4 bg-yellow-50 border-t border-yellow-200">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                ⚠️ {parsedData.errors.length} Rows with Errors (will be skipped):
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parsedData.errors.slice(0, 10).map((error, idx) => (
                  <div key={idx} className="text-xs text-yellow-700">
                    Row {error.row}: {error.message}
                  </div>
                ))}
                {parsedData.errors.length > 10 && (
                  <div className="text-xs text-yellow-600 italic">
                    ... and {parsedData.errors.length - 10} more errors
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sample Preview */}
          <div className="p-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Appointments:</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedData.appointments.slice(0, 5).map((apt, idx) => (
                <div key={idx} className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="font-medium">
                    {apt.time} - {apt.providerName}
                  </div>
                  <div className="text-gray-600">
                    {apt.patientFirstName} {apt.patientLastName}
                    {apt.patientAge && `, ${apt.patientAge}yo`}
                    {apt.patientGender && `, ${apt.patientGender}`}
                  </div>
                  {apt.diagnosis && (
                    <div className="text-gray-500">DX: {apt.diagnosis}</div>
                  )}
                </div>
              ))}
              {parsedData.appointments.length > 5 && (
                <div className="text-xs text-gray-500 italic">
                  ... and {parsedData.appointments.length - 5} more appointments
                </div>
              )}
            </div>
          </div>

          {/* Import Button */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleImport}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Import {parsedData.appointments.length} Appointments to Database
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
