import React, { useState } from 'react';
import { scheduleImportService } from '../services/scheduleImport.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ScheduleImportModal({ 
  isOpen, 
  onClose, 
  onImportComplete 
}: ScheduleImportModalProps) {
  const [fileContent, setFileContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showSample, setShowSample] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  
  if (!isOpen) return null;
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileContent(content);
      };
      reader.readAsText(file);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
      };
      reader.readAsText(file);
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Prevent default to avoid double handling
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    logInfo('ScheduleImportModal', `Pasted ${pastedText.split('\n').length} lines of data`);
    setFileContent(pastedText);
  };
  
  const handleImport = async () => {
    if (!fileContent) {
      alert('Please upload or paste schedule data');
      return;
    }
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const currentUser = unifiedAuthService.getCurrentUser();
      
      // Use AI-powered import for flexible parsing
      logDebug('ScheduleImportModal', 'Debug message', {});
      const result = await scheduleImportService.importAppointmentsWithAI(
        fileContent,
        currentUser?.email || 'system',
        clearExisting
      );
      
      setImportResult(result);
      
      if (result.success) {
        setTimeout(() => {
          onImportComplete();
          handleClose();
        }, 3000);
      }
    } catch (error) {
      logError('ScheduleImportModal', 'Error message', {});
      
      // Fall back to regular import if AI fails
      try {
        logDebug('ScheduleImportModal', 'Debug message', {});
        const result = await scheduleImportService.importAppointments(
          fileContent,
          unifiedAuthService.getCurrentUser()?.email || 'system'
        );
        setImportResult(result);
        
        if (result.success) {
          setTimeout(() => {
            onImportComplete();
            handleClose();
          }, 3000);
        }
      } catch (fallbackError) {
        setImportResult({
          success: false,
          imported: 0,
          failed: 0,
          errors: [error instanceof Error ? error.message : 'Import failed' ]
        });
      }
    } finally {
      setIsImporting(false);
    }
  };
  
  const handleClose = () => {
    setFileContent('');
    setImportResult(null);
    setShowSample(false);
    onClose();
  };
  
  const providerMapping = scheduleImportService.getProviderMapping();
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Import Schedule</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        {/* Import Results */}
        {importResult && (
          <div className={`mb-4 p-4 rounded-lg ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              importResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {importResult.success ? '✓ Import Successful' : '✗ Import Failed'}
            </h3>
            <div className="text-sm">
              <p className="font-medium text-green-700 mb-2">
                Imported: {importResult.imported} appointments
              </p>
              
              {/* Show preview of imported appointments */}
              {importResult.appointments && importResult.appointments.length > 0 && (
                <div className="bg-white rounded border border-green-200 p-3 mb-2">
                  <h4 className="font-semibold text-gray-700 mb-2">✅ Successfully Imported:</h4>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left border-b">Date</th>
                          <th className="px-2 py-1 text-left border-b">Time</th>
                          <th className="px-2 py-1 text-left border-b">Patient</th>
                          <th className="px-2 py-1 text-left border-b">ID</th>
                          <th className="px-2 py-1 text-left border-b">Provider</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.appointments.slice(0, 20).map((appt: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-2 py-1">{appt.date}</td>
                            <td className="px-2 py-1 font-medium">{appt.time}</td>
                            <td className="px-2 py-1">{appt.patientName}</td>
                            <td className="px-2 py-1 text-gray-500">{appt.patientId}</td>
                            <td className="px-2 py-1">{appt.doctorName || appt.provider}</td>
                          </tr>
                        ))}
                        {importResult.appointments.length > 20 && (
                          <tr>
                            <td colSpan={5} className="px-2 py-2 text-center text-gray-500 font-medium">
                              ✅ Plus {importResult.appointments.length - 20} more appointments imported successfully
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Summary by provider */}
                  <div className="mt-3 pt-3 border-t">
                    <h5 className="font-medium text-gray-600 mb-1">Summary by Provider:</h5>
                    <div className="text-xs space-y-1">
                      {Object.entries(
                        importResult.appointments.reduce((acc: any, appt: any) => {
                          const provider = appt.doctorName || appt.provider || 'Unknown';
                          acc[provider] = (acc[provider] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([provider, count]) => (
                        <div key={provider} className="flex justify-between">
                          <span>{provider}:</span>
                          <span className="font-medium">{count as number} appointments</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {importResult.failed > 0 && (
                <p className="text-red-600">Failed: {importResult.failed} appointments</p>
              )}
              
              {importResult.duplicates > 0 && (
                <p className="text-yellow-600">⚠️ Skipped {importResult.duplicates} duplicate appointments</p>
              )}
              
              {importResult.errors?.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside text-red-600">
                    {importResult.errors.slice(0, 5).map((error: string, idx: number) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>... and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* File Upload and Paste Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import schedule data:
          </label>
          
          {/* Two-column layout for upload and paste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload Section */}
            <div
              className={`border-2 border-dashed rounded-lg p-4 ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center">
                <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-1 text-sm text-gray-600">
                  <span className="font-semibold">Upload file</span>
                </p>
                <p className="text-xs text-gray-500 mb-3">or drag and drop</p>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 text-sm"
                >
                  Choose File
                </label>
                <p className="text-xs text-gray-500 mt-2">CSV, TSV, or TXT</p>
              </div>
            </div>
            
            {/* Paste Section */}
            <div>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                onPaste={handlePaste}
                className="w-full h-full min-h-[160px] p-3 border border-gray-300 rounded-lg font-mono text-xs"
                placeholder="Or paste your schedule data here..."
              />
            </div>
          </div>
        </div>
        
        {/* Import Options */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Clear existing appointments before import</span>
          </label>
          <p className="text-xs text-gray-600 mt-1 ml-6">
            {clearExisting 
              ? '⚠️ All existing appointments will be replaced with the imported data'
              : '✓ New appointments will be added to existing ones'}
          </p>
        </div>
        
        {/* Sample Format */}
        <div className="mb-4">
          <button
            onClick={() => setShowSample(!showSample)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {showSample ? 'Hide' : 'Show'} Sample Format
          </button>
          {showSample && (
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
              {scheduleImportService.getSampleFormat()}
            </pre>
          )}
        </div>
        
        {/* Provider Mapping */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Provider Code Mapping:</h3>
          <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded">
            {Object.entries(providerMapping).map(([code, info]) => (
              <div key={code} className="flex justify-between">
                <span className="font-mono text-gray-600">{code}</span>
                <span className="text-gray-800">→ {info.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Preview */}
        {fileContent && !importResult && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
            <div className="bg-gray-50 p-3 rounded overflow-x-auto">
              <pre className="text-xs">
                {fileContent.split('\n').slice(0, 5).join('\n')}
                {fileContent.split('\n').length > 5 && '\n...'}
              </pre>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {(() => {
                const lines = fileContent.split('\n').filter(line => line.trim());
                const delimiter = fileContent.includes('\t') ? '\t' : ',';
                let appointmentCount = 0;
                let hasHeader = false;
                
                // Check if first line looks like a header
                if (lines.length > 0) {
                  const firstLine = lines[0].toLowerCase();
                  hasHeader = firstLine.includes('date') || firstLine.includes('patient') || 
                             firstLine.includes('appt') || firstLine.includes('provider');
                }
                
                // Count valid appointment rows (with date and provider)
                const startIdx = hasHeader ? 1 : 0;
                for (let i = startIdx; i < lines.length; i++) {
                  const parts = lines[i].split(delimiter).map(p => p.trim());
                  // Check if row has a date (usually first column) and provider info
                  if (parts.length >= 3 && parts[0] && parts[0] !== '-') {
                    // Simple date check - contains forward slash
                    if (parts[0].includes('/')) {
                      appointmentCount++;
                    }
                  }
                }
                
                return `${appointmentCount} appointments detected (${lines.length} total lines)`;
              })()}
            </p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!fileContent || isImporting}
            className={`px-4 py-2 rounded-lg text-white ${
              !fileContent || isImporting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isImporting ? 'Importing...' : 'Import Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
