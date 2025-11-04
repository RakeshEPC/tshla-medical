/**
 * EXAMPLE: Dictation Component with Patient Summary Generation
 *
 * This example shows how to integrate patient summary generation
 * into an existing dictation workflow.
 *
 * Copy this pattern into your actual dictation components:
 * - EnhancedDictation.tsx
 * - SimplifiedDictation.tsx
 * - DictationWithSchedule.tsx
 */

import React, { useState } from 'react';
import { usePatientSummary } from '../../hooks/usePatientSummary';
import { patientSummaryGenerator } from '../../services/patientSummaryGenerator.service';

interface ExampleProps {
  patient: any;
  visitId: string;
  providerId: string;
}

export default function DictationWithPatientSummaryExample({ patient, visitId, providerId }: ExampleProps) {
  const [dictationText, setDictationText] = useState('');
  const [soapNote, setSoapNote] = useState<any>(null);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);

  // Patient summary hook
  const { summary, loading: summaryLoading, generateSummary, saveSummary } = usePatientSummary();

  /**
   * STEP 1: After SOAP note is generated, automatically create patient summary
   */
  async function handleSoapGenerated(generatedSoap: any) {
    setSoapNote(generatedSoap);

    // Generate patient-friendly summary
    console.log('🔄 Generating patient summary...');

    const patientSummary = await generateSummary({
      plan: generatedSoap.sections?.plan || generatedSoap.plan,
      assessment: generatedSoap.sections?.assessment || generatedSoap.assessment,
      medications: generatedSoap.sections?.medications || generatedSoap.medications,
      orders: generatedSoap.extractedOrders
    });

    if (patientSummary) {
      console.log('✅ Patient summary generated:', {
        wordCount: patientSummary.word_count,
        readTime: patientSummary.estimated_read_time_seconds,
        actions: Object.values(patientSummary.key_actions).flat().length
      });

      // Validate quality
      const validation = patientSummaryGenerator.validateSummary(patientSummary);
      if (!validation.valid) {
        console.warn('⚠️ Summary quality issues:', validation.issues);
        // Still allow saving, but warn provider
      }
    }
  }

  /**
   * STEP 2: Save note with patient summary
   */
  async function handleSaveNote() {
    if (!soapNote) return;

    try {
      // 1. Save SOAP note (existing code)
      console.log('💾 Saving SOAP note...');
      // await saveSOAPNote(soapNote); // Your existing save logic

      // 2. Save patient summary to database (NEW)
      if (summary) {
        console.log('💾 Saving patient summary...');
        const saved = await saveSummary(visitId, patient.id, providerId);

        if (saved) {
          console.log('✅ Patient summary saved successfully!');
          alert('Note saved! Patient summary will be available in the patient portal.');
        } else {
          console.error('❌ Failed to save patient summary');
          alert('Note saved, but patient summary failed. Check logs.');
        }
      }

    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save note');
    }
  }

  /**
   * STEP 3: Show preview of patient summary to provider
   */
  function renderSummaryPreview() {
    if (!summary) return null;

    return (
      <div className="mt-6 border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            📋 Patient Summary Preview
          </h3>
          <span className="text-sm text-gray-500">
            {summary.estimated_read_time_seconds}s read • {summary.word_count} words
          </span>
        </div>

        {/* Beta notice for provider */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Beta Feature:</strong> This summary will be shown to the patient.
            Review for accuracy before saving.
          </p>
        </div>

        {/* Summary content */}
        <div className="bg-gray-50 rounded-lg p-6 mb-4">
          <div className="prose prose-sm max-w-none">
            {summary.summary_text.split('\n').map((line, i) => {
              if (line.match(/^\*\*.*\*\*$/)) {
                return <h4 key={i} className="font-bold text-gray-900 mt-3 mb-1">{line.replace(/\*\*/g, '')}</h4>;
              }
              return <p key={i} className="text-gray-700 mb-2">{line}</p>;
            })}
          </div>
        </div>

        {/* Action items breakdown */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Patient Action Items:</h4>
          <div className="space-y-2 text-sm">
            {summary.key_actions.medications.length > 0 && (
              <div>
                <span className="font-medium">💊 Medications:</span>
                <ul className="ml-6 list-disc">
                  {summary.key_actions.medications.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.key_actions.labs.length > 0 && (
              <div>
                <span className="font-medium">🔬 Labs:</span>
                <ul className="ml-6 list-disc">
                  {summary.key_actions.labs.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.key_actions.appointments.length > 0 && (
              <div>
                <span className="font-medium">📅 Appointments:</span>
                <ul className="ml-6 list-disc">
                  {summary.key_actions.appointments.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.key_actions.lifestyle.length > 0 && (
              <div>
                <span className="font-medium">🏃 Lifestyle:</span>
                <ul className="ml-6 list-disc">
                  {summary.key_actions.lifestyle.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Quality warnings */}
        {(() => {
          const validation = patientSummaryGenerator.validateSummary(summary);
          if (!validation.valid) {
            return (
              <div className="mt-4 bg-orange-50 border-l-4 border-orange-400 p-3">
                <p className="text-sm font-semibold text-orange-900 mb-1">Quality Issues:</p>
                <ul className="text-sm text-orange-800 list-disc ml-5">
                  {validation.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
                <p className="text-sm text-orange-700 mt-2">
                  You can still save this summary, but consider regenerating or editing it.
                </p>
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Medical Dictation</h2>

      {/* Dictation interface (your existing UI) */}
      <div className="mb-6">
        <textarea
          value={dictationText}
          onChange={(e) => setDictationText(e.target.value)}
          className="w-full border rounded-lg p-4 h-48"
          placeholder="Start dictating or type your note..."
        />
      </div>

      {/* Process with AI button */}
      <button
        onClick={async () => {
          // Simulate SOAP generation (replace with your actual AI processing)
          const mockSoap = {
            sections: {
              assessment: 'Type 2 Diabetes, poorly controlled',
              plan: 'Increase Lantus to 25 units. Order HbA1c. Follow up in 3 months.',
              medications: 'Lantus 20 units qhs'
            }
          };
          await handleSoapGenerated(mockSoap);
          setShowSummaryPreview(true);
        }}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-4"
      >
        Process with AI
      </button>

      {/* SOAP Note Display */}
      {soapNote && (
        <div className="mb-6 bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">SOAP Note</h3>
          <div className="space-y-2 text-sm">
            <div><strong>Assessment:</strong> {soapNote.sections?.assessment}</div>
            <div><strong>Plan:</strong> {soapNote.sections?.plan}</div>
          </div>
        </div>
      )}

      {/* Patient Summary Preview (NEW) */}
      {showSummaryPreview && renderSummaryPreview()}

      {/* Save button */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={handleSaveNote}
          disabled={!soapNote || summaryLoading}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {summaryLoading ? 'Saving...' : 'Save Note & Patient Summary'}
        </button>

        {summary && (
          <button
            onClick={() => setShowSummaryPreview(!showSummaryPreview)}
            className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
          >
            {showSummaryPreview ? 'Hide' : 'Show'} Patient Summary
          </button>
        )}
      </div>

      {/* Success message */}
      {summary && !summaryLoading && (
        <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-3">
          <p className="text-green-800">
            ✅ Patient summary will be available in the patient portal after saving.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * INTEGRATION CHECKLIST:
 *
 * To add this to your existing dictation component:
 *
 * 1. Import the hook:
 *    import { usePatientSummary } from '../../hooks/usePatientSummary';
 *
 * 2. Add to your component:
 *    const { summary, generateSummary, saveSummary } = usePatientSummary();
 *
 * 3. After AI processes SOAP note:
 *    await generateSummary({ plan, assessment, medications });
 *
 * 4. When saving note:
 *    await saveSummary(visitId, patientId, providerId);
 *
 * 5. Optionally show preview:
 *    {summary && renderSummaryPreview()}
 *
 * That's it! The patient summary will be generated and saved automatically.
 */
