/**
 * Patient Detail Modal - Diabetes Education
 * Comprehensive patient management with tabs for:
 * - Overview (demographics + medical data)
 * - Documents (CCD file management)
 * - Clinical Notes (free text + focus areas)
 * - Call History
 * Created: 2025-12-26
 */

import React, { useState } from 'react';
import { X, User, FileText, MessageSquare, Phone, Upload, Download, Trash2, Save, Plus } from 'lucide-react';
import type { DiabetesEducationPatient, DiabetesEducationCall } from '../../services/diabetesEducation.service';
import {
  updateDiabetesEducationPatient,
  formatPhoneDisplay,
  formatCallDateTime,
  formatDuration,
} from '../../services/diabetesEducation.service';

interface PatientDetailModalProps {
  patient: DiabetesEducationPatient;
  calls: DiabetesEducationCall[];
  onClose: () => void;
  onUpdate: () => void;
}

type TabView = 'overview' | 'documents' | 'notes' | 'calls';

// Predefined focus area tags
const FOCUS_AREA_TAGS = [
  'Weight Loss',
  'Insulin Technique',
  'Carb Counting',
  'Blood Sugar Monitoring',
  'Medication Adherence',
  'Diet & Nutrition',
  'Exercise & Activity',
  'Foot Care',
  'A1C Management',
  'Hypoglycemia Prevention',
  'Sick Day Management',
];

export default function PatientDetailModal({ patient, calls, onClose, onUpdate }: PatientDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [clinicalNotes, setClinicalNotes] = useState(patient.clinical_notes || '');
  const [focusAreas, setFocusAreas] = useState<string[]>(
    Array.isArray(patient.focus_areas) ? patient.focus_areas : []
  );
  const [customFocusArea, setCustomFocusArea] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const addCustomFocusArea = () => {
    if (customFocusArea.trim() && !focusAreas.includes(customFocusArea.trim())) {
      setFocusAreas([...focusAreas, customFocusArea.trim()]);
      setCustomFocusArea('');
    }
  };

  const removeFocusArea = (area: string) => {
    setFocusAreas(focusAreas.filter((a) => a !== area));
  };

  const handleSaveNotes = async () => {
    try {
      setSaving(true);
      setError('');

      await updateDiabetesEducationPatient(patient.id, {
        clinical_notes: clinicalNotes,
        focus_areas: focusAreas,
      });

      onUpdate();
      alert('Notes saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDocument(true);
      setError('');

      // TODO: Implement document upload/replacement API
      // This will upload the file and re-extract medical data
      alert('Document upload functionality coming in next update!');

    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const renderTab Button = (tab: TabView, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
        activeTab === tab
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const renderOverviewTab = () => (
    <div className="p-6 space-y-6">
      {/* Demographics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="text-gray-500">Full Name</label>
            <div className="font-medium text-gray-900">
              {patient.first_name} {patient.last_name}
            </div>
          </div>
          <div>
            <label className="text-gray-500">Phone Number</label>
            <div className="font-medium text-gray-900">{formatPhoneDisplay(patient.phone_number)}</div>
          </div>
          <div>
            <label className="text-gray-500">Date of Birth</label>
            <div className="font-medium text-gray-900">
              {new Date(patient.date_of_birth).toLocaleDateString()}
            </div>
          </div>
          <div>
            <label className="text-gray-500">Preferred Language</label>
            <div className="font-medium text-gray-900">{patient.preferred_language.toUpperCase()}</div>
          </div>
          <div>
            <label className="text-gray-500">Enrolled</label>
            <div className="font-medium text-gray-900">
              {new Date(patient.created_at).toLocaleDateString()}
            </div>
          </div>
          <div>
            <label className="text-gray-500">Total Calls</label>
            <div className="font-medium text-gray-900">{calls.length}</div>
          </div>
        </div>
      </div>

      {/* Medical Data */}
      {patient.medical_data && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Information</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {patient.medical_data.medications && patient.medical_data.medications.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Medications</h4>
                <ul className="space-y-1">
                  {patient.medical_data.medications.map((med, i) => (
                    <li key={i} className="text-sm text-gray-600">
                      • {med.name} {med.dose} - {med.frequency}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patient.medical_data.labs && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Lab Values</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(patient.medical_data.labs).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-gray-500">{key}:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {value.value} {value.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patient.medical_data.diagnoses && patient.medical_data.diagnoses.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Diagnoses</h4>
                <ul className="space-y-1">
                  {patient.medical_data.diagnoses.map((dx, i) => (
                    <li key={i} className="text-sm text-gray-600">
                      • {dx}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patient.medical_data.allergies && patient.medical_data.allergies.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2">Allergies</h4>
                <ul className="space-y-1">
                  {patient.medical_data.allergies.map((allergy, i) => (
                    <li key={i} className="text-sm text-red-600">
                      • {allergy}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patient.medical_data.notes && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Clinical Notes</h4>
                <p className="text-sm text-gray-600">{patient.medical_data.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderDocumentsTab = () => (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Documents (CCD Files)</h3>

        {patient.medical_document_url ? (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Current CCD File</div>
                  <div className="text-xs text-gray-500">
                    Uploaded: {new Date(patient.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={patient.medical_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">No medical document uploaded yet</p>
          </div>
        )}

        {/* Upload New Document */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900 mb-2">
              {patient.medical_document_url ? 'Replace CCD File' : 'Upload CCD File'}
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              PDF, JPG, or PNG • AI will extract medications, labs, and diagnoses
            </p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleDocumentUpload}
              className="hidden"
              id="document-upload"
              disabled={uploadingDocument}
            />
            <label
              htmlFor="document-upload"
              className={`inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
                uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-5 h-5" />
              {uploadingDocument ? 'Uploading...' : 'Choose File'}
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotesTab = () => (
    <div className="p-6 space-y-6">
      {/* Free-form Clinical Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Clinical Notes & Instructions
        </label>
        <textarea
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Add any special instructions or notes for the AI diabetes educator...

Examples:
- Focus on weight loss strategies
- Emphasize proper insulin injection technique
- Patient struggles with carb counting
- Recently started on insulin pump"
        />
        <p className="text-xs text-gray-500 mt-1">
          These notes will be passed to the AI during phone calls to personalize the conversation
        </p>
      </div>

      {/* Focus Areas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Focus Areas (Select all that apply)
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          {FOCUS_AREA_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleFocusArea(tag)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                focusAreas.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Custom Focus Area */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customFocusArea}
            onChange={(e) => setCustomFocusArea(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomFocusArea()}
            placeholder="Add custom focus area..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addCustomFocusArea}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Selected Focus Areas (including custom) */}
        {focusAreas.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Selected Focus Areas:</p>
            <div className="flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <div
                  key={area}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {area}
                  <button
                    onClick={() => removeFocusArea(area)}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleSaveNotes}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
            saving ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Notes & Focus Areas'}
        </button>
      </div>
    </div>
  );

  const renderCallsTab = () => (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call History</h3>
      {calls.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Phone className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>No calls yet</p>
          <p className="text-sm mt-1">Patient can call 832-400-3930 to speak with AI diabetes educator</p>
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => (
            <div key={call.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900">
                    {formatCallDateTime(call.call_started_at)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Duration: {formatDuration(call.duration_seconds)}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    call.call_status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : call.call_status === 'in-progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {call.call_status}
                </span>
              </div>

              {call.summary && (
                <div className="mt-3 mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">AI Summary:</div>
                  <div className="text-sm text-gray-600">{call.summary}</div>
                </div>
              )}

              {call.transcript && (
                <details className="mt-3">
                  <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-700">
                    View Full Transcript
                  </summary>
                  <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {call.transcript}
                  </div>
                </details>
              )}

              {call.topics_discussed && call.topics_discussed.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {call.topics_discussed.map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-lg">
                {patient.first_name[0]}{patient.last_name[0]}
              </div>
              {patient.first_name} {patient.last_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatPhoneDisplay(patient.phone_number)} • {calls.length} calls
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6">
          {renderTabButton('overview', <User className="w-5 h-5" />, 'Overview')}
          {renderTabButton('documents', <FileText className="w-5 h-5" />, 'Documents')}
          {renderTabButton('notes', <MessageSquare className="w-5 h-5" />, 'Clinical Notes')}
          {renderTabButton('calls', <Phone className="w-5 h-5" />, `Calls (${calls.length})`)}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'documents' && renderDocumentsTab()}
          {activeTab === 'notes' && renderNotesTab()}
          {activeTab === 'calls' && renderCallsTab()}
        </div>
      </div>
    </div>
  );
}
