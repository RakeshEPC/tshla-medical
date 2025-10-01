'use client';
import React, { useState, useEffect, useRef } from 'react';
import { templateStorage } from '@/lib/templateStorage';
import ContinuousDictation from './ContinuousDictation';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface EnhancedDictationProps {
  patient: any;
  visitDate: string;
  initialText: string;
  onSave: (text: string, soapNote: any) => void;
}

export default function EnhancedDictation({
  patient,
  visitDate,
  initialText,
  onSave,
}: EnhancedDictationProps) {
  const [dictationText, setDictationText] = useState(initialText);
  const [soapNote, setSoapNote] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [autoProcess, setAutoProcess] = useState(false);
  const lastProcessedLength = useRef(0);

  // Auto-process when text changes significantly (every 100 words)
  useEffect(() => {
    if (autoProcess && dictationText) {
      const wordCount = dictationText.split(' ').filter(w => w).length;
      const lastWordCount = lastProcessedLength.current;

      // Process every 100 new words
      if (wordCount - lastWordCount >= 100) {
        logDebug('EnhancedDictation', 'Debug message', {});
        processWithAI();
        lastProcessedLength.current = wordCount;
      }
    }
  }, [dictationText, autoProcess]);

  const handleTextChange = (newText: string) => {
    setDictationText(newText);
  };

  const processWithAI = async () => {
    if (isProcessing) return; // Prevent multiple simultaneous processes

    setIsProcessing(true);

    try {
      // Process the dictation with AI to generate SOAP note
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: dictationText,
          meta: {
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            visitDate,
            conditions: patient.conditions,
            medications: patient.medications,
            labs: patient.labs,
            lastVisit: patient.visitHistory?.[0],
          },
          template: selectedTemplate,
          mergeHistory: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSoapNote(result.soap);
        logInfo('EnhancedDictation', 'Info message', {});
      } else {
        logError('EnhancedDictation', 'Error message', {});
      }
    } catch (error) {
      logError('EnhancedDictation', 'Error message', {});
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSOAPNote = (soap: any) => {
    if (!soap) return '';

    let formatted = `DATE OF SERVICE: ${visitDate}\n`;
    formatted += `PATIENT: ${patient.firstName} ${patient.lastName} (${patient.id})\n\n`;

    formatted += `SUBJECTIVE:\n${soap.subjective || soap.S || ''}\n\n`;
    formatted += `OBJECTIVE:\n${soap.objective || soap.O || ''}\n\n`;
    formatted += `ASSESSMENT:\n${soap.assessment || soap.A || ''}\n\n`;
    formatted += `PLAN:\n${soap.plan || soap.P || ''}\n`;

    return formatted;
  };

  const generatePatientSummary = () => {
    let summary = `PATIENT SUMMARY\n`;
    summary += `================\n\n`;
    summary += `Name: ${patient.firstName} ${patient.lastName}\n`;
    summary += `ID: ${patient.id} | AVA: ${patient.avaId}\n`;
    summary += `DOB: ${patient.dob}\n\n`;

    summary += `ACTIVE CONDITIONS:\n`;
    patient.conditions
      ?.filter((c: any) => c.status !== 'resolved')
      .forEach((c: any) => {
        summary += `• ${c.name} (${c.icd10}) - Since ${c.diagnosisDate}\n`;
        if (c.notes) summary += `  Notes: ${c.notes}\n`;
      });

    summary += `\nCURRENT MEDICATIONS:\n`;
    patient.medications
      ?.filter((m: any) => m.status === 'active')
      .forEach((m: any) => {
        summary += `• ${m.name} ${m.dosage} ${m.frequency}\n`;
        summary += `  Started: ${m.startDate}, Effectiveness: ${m.effectiveness || 'Not assessed'}\n`;
      });

    summary += `\nRECENT LABS:\n`;
    patient.labs?.slice(0, 5).forEach((l: any) => {
      const flag = l.abnormal ? ` [${l.abnormal}]` : '';
      summary += `• ${l.name}: ${l.value} ${l.unit}${flag} (${l.date})\n`;
    });

    return summary;
  };

  const printDocument = (type: 'progress' | 'summary' | 'soap' | 'combined') => {
    let content = '';

    switch (type) {
      case 'progress':
        content = dictationText;
        break;
      case 'summary':
        content = generatePatientSummary();
        break;
      case 'soap':
        content = soapNote ? formatSOAPNote(soapNote) : 'No SOAP note generated yet';
        break;
      case 'combined':
        content =
          generatePatientSummary() +
          '\n\n' +
          '=== DICTATION ===\n\n' +
          dictationText +
          '\n\n' +
          (soapNote ? '=== SOAP NOTE ===\n\n' + formatSOAPNote(soapNote) : '');
        break;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${patient.firstName} ${patient.lastName} - ${type.toUpperCase()}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              pre { white-space: pre-wrap; font-family: 'Courier New', monospace; }
              .header { margin-bottom: 20px; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${type === 'progress' ? 'Progress Note' : type === 'summary' ? 'Patient Summary' : type === 'soap' ? 'SOAP Note' : 'Complete Visit Documentation'}</h1>
              <p><strong>Patient:</strong> ${patient.firstName} ${patient.lastName} (${patient.id})</p>
              <p><strong>Date:</strong> ${visitDate}</p>
              <p><strong>Provider:</strong> Dr. Musk</p>
            </div>
            <pre>${content}</pre>
            <div class="footer">
              <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Patient Info Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-sm text-gray-600">
              Visit Date: {visitDate} | ID: {patient.id}
            </p>
          </div>
          <button
            onClick={() => printDocument('summary')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            View Patient Summary
          </button>
        </div>
      </div>

      {/* Continuous Dictation Component */}
      <ContinuousDictation
        initialText={dictationText}
        onTextChange={handleTextChange}
        maxDuration={30}
      />

      {/* AI Processing Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">AI Processing</h3>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoProcess}
                onChange={e => setAutoProcess(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm">Auto-process every 100 words</span>
            </label>

            <select
              value={selectedTemplate?.id || ''}
              onChange={e => {
                const template = templateStorage.getTemplate(e.target.value);
                setSelectedTemplate(template);
              }}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="">Default Template</option>
              {templateStorage.getTemplates().map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={processWithAI}
              disabled={isProcessing || !dictationText}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  Process with AI
                </>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowPrintMenu(!showPrintMenu)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print
              </button>

              {showPrintMenu && (
                <div className="absolute right-0 top-12 bg-white border rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                  <button
                    onClick={() => {
                      printDocument('progress');
                      setShowPrintMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                  >
                    Print Dictation
                  </button>
                  <button
                    onClick={() => {
                      printDocument('summary');
                      setShowPrintMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                  >
                    Print Patient Summary
                  </button>
                  <button
                    onClick={() => {
                      printDocument('soap');
                      setShowPrintMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                  >
                    Print SOAP Note
                  </button>
                  <button
                    onClick={() => {
                      printDocument('combined');
                      setShowPrintMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded text-blue-600 font-medium"
                  >
                    Print Complete Visit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Processing dictation with AI...</p>
          </div>
        )}
      </div>

      {/* AI Processed SOAP Note */}
      {soapNote && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-green-900">AI Generated SOAP Note</h3>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="bg-white rounded p-4 font-mono text-sm border border-green-200">
            <pre className="whitespace-pre-wrap">{formatSOAPNote(soapNote)}</pre>
          </div>
        </div>
      )}

      {/* Combined View - Dictation + SOAP */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="text-lg font-semibold mb-3">Complete Visit Note</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Raw Dictation */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Raw Dictation</h4>
            <div className="h-64 overflow-y-auto p-3 bg-gray-50 rounded-lg border text-sm">
              <pre className="whitespace-pre-wrap font-sans">
                {dictationText || 'No dictation yet...'}
              </pre>
            </div>
          </div>

          {/* Formatted SOAP */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Formatted SOAP</h4>
            <div className="h-64 overflow-y-auto p-3 bg-blue-50 rounded-lg border text-sm">
              <pre className="whitespace-pre-wrap font-sans">
                {soapNote
                  ? formatSOAPNote(soapNote)
                  : 'Click "Process with AI" to generate SOAP note'}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => onSave(dictationText, soapNote)}
          disabled={!dictationText}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Save & Complete Visit
        </button>
      </div>
    </div>
  );
}
