/**
 * DictationWithPreVisit Component
 * Dictation interface with pre-visit data auto-population
 * Created: January 2025
 */

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, FileText, Sparkles, Copy, CheckCircle } from 'lucide-react';
import PreVisitSummaryCard from './PreVisitSummaryCard';
import PreVisitModal from './PreVisitModal';
import { usePreVisitData } from '../../hooks/usePreVisitData';
import type { PreVisitData } from './PreVisitSummaryCard';

interface DictationWithPreVisitProps {
  patientId: string;
  patientName: string;
  appointmentDate: string;
  onSaveDictation?: (text: string) => void;
  initialText?: string;
}

export default function DictationWithPreVisit({
  patientId,
  patientName,
  appointmentDate,
  onSaveDictation,
  initialText = '',
}: DictationWithPreVisitProps) {
  const [dictationText, setDictationText] = useState(initialText);
  const [isRecording, setIsRecording] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [autoPopulated, setAutoPopulated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch pre-visit data
  const { data: preVisitData, isLoading } = usePreVisitData({
    patientId,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // Auto-populate dictation when pre-visit data becomes available
  useEffect(() => {
    if (preVisitData && preVisitData.call_completed && !autoPopulated && !dictationText) {
      handleAutoPopulate(preVisitData);
      setAutoPopulated(true);
    }
  }, [preVisitData, autoPopulated, dictationText]);

  const handleAutoPopulate = (data: PreVisitData) => {
    const template = generateDictationTemplate(data);
    setDictationText(template);

    // Show notification
    showNotification('Pre-visit information auto-populated into dictation');
  };

  const handleInsertPreVisit = (insertText: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const before = dictationText.substring(0, start);
      const after = dictationText.substring(end);

      setDictationText(before + '\n\n' + insertText + '\n\n' + after);

      // Move cursor after inserted text
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = start + insertText.length + 4;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      // If no textarea focus, append at end
      setDictationText(prev => prev + '\n\n' + insertText);
    }

    setShowModal(false);
    showNotification('Pre-visit information inserted');
  };

  const generateDictationTemplate = (data: PreVisitData): string => {
    let text = `PATIENT: ${patientName}\nDATE: ${new Date().toLocaleDateString()}\n\n`;

    text += `--- PRE-VISIT INTERVIEW (Auto-populated) ---\n\n`;

    if (data.ai_summary) {
      text += `${data.ai_summary}\n\n`;
    }

    if (data.current_medications && data.current_medications.length > 0) {
      text += `CURRENT MEDICATIONS:\n`;
      data.current_medications.forEach(med => {
        text += `- ${med}\n`;
      });
      text += `\n`;
    }

    if (data.chief_concerns && data.chief_concerns.length > 0) {
      text += `CHIEF CONCERNS:\n`;
      data.chief_concerns.forEach(concern => {
        text += `- ${concern}\n`;
      });
      text += `\n`;
    }

    if (data.questions_for_provider && data.questions_for_provider.length > 0) {
      text += `PATIENT QUESTIONS:\n`;
      data.questions_for_provider.forEach(question => {
        text += `- ${question}\n`;
      });
      text += `\n`;
    }

    if (data.lab_status) {
      text += `LAB STATUS: ${data.lab_status}\n\n`;
    }

    if (data.risk_flags && data.risk_flags.length > 0) {
      text += `⚠️ RISK FLAGS: ${data.risk_flags.join(', ')}\n\n`;
    }

    text += `--- END PRE-VISIT INTERVIEW ---\n\n`;
    text += `SUBJECTIVE:\n\n`;
    text += `OBJECTIVE:\n\n`;
    text += `ASSESSMENT:\n\n`;
    text += `PLAN:\n\n`;

    return text;
  };

  const showNotification = (message: string) => {
    // Simple notification - you can replace with toast library
    console.log('Notification:', message);
  };

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Integrate with actual speech recognition
  };

  const handleSave = () => {
    if (onSaveDictation) {
      onSaveDictation(dictationText);
      showNotification('Dictation saved successfully');
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(dictationText);
    showNotification('Dictation copied to clipboard');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Pre-Visit Summary Card */}
      {!isLoading && (
        <div className="mb-4">
          <PreVisitSummaryCard
            preVisitData={preVisitData}
            onViewDetails={() => setShowModal(true)}
            compact={false}
          />
        </div>
      )}

      {/* Dictation Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleToggleRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isRecording
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Recording
            </>
          )}
        </button>

        {preVisitData && preVisitData.call_completed && !autoPopulated && (
          <button
            onClick={() => handleAutoPopulate(preVisitData)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Sparkles className="w-5 h-5" />
            Auto-Populate Pre-Visit
          </button>
        )}

        <button
          onClick={handleCopyAll}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          <Copy className="w-5 h-5" />
          Copy All
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium ml-auto"
        >
          <FileText className="w-5 h-5" />
          Save Dictation
        </button>
      </div>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="text-red-700 font-medium">Recording in progress...</span>
          </div>
          <span className="text-sm text-red-600">Speak clearly into your microphone</span>
        </div>
      )}

      {/* Dictation Text Area */}
      <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
          <h3 className="font-semibold text-gray-700">Clinical Dictation</h3>
        </div>
        <textarea
          ref={textareaRef}
          value={dictationText}
          onChange={(e) => setDictationText(e.target.value)}
          className="flex-1 p-4 resize-none focus:outline-none font-mono text-sm"
          placeholder="Start dictating or click 'Auto-Populate Pre-Visit' to insert pre-visit interview data..."
        />
      </div>

      {/* Character Count */}
      <div className="mt-2 text-sm text-gray-500 text-right">
        {dictationText.length} characters
      </div>

      {/* Pre-Visit Modal */}
      {showModal && preVisitData && (
        <PreVisitModal
          preVisitData={preVisitData}
          patientName={patientName}
          appointmentDate={appointmentDate}
          onClose={() => setShowModal(false)}
          onInsertIntoDictation={handleInsertPreVisit}
        />
      )}
    </div>
  );
}
