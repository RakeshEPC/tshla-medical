/**
 * Patient Data Import Page
 * Upload progress note PDFs to extract patient profiles for adaptive pre-visit questioning
 */

import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, User, Calendar, Phone, Pill, Activity, Link as LinkIcon } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface ExtractedData {
  patient_name: string | null;
  patient_dob: string | null;
  patient_phone: string | null;
  patient_mrn: string | null;
  patient_email: string | null;
  conditions: string[];
  medications: Array<{
    name: string;
    dose: string | null;
    frequency: string | null;
  }>;
  allergies: string[];
  provider_name: string | null;
}

interface LinkedAppointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  provider_name: string;
  matched_on: string;
}

interface LinkingInfo {
  linked_appointments: number;
  details: LinkedAppointment[];
}

export default function PatientDataImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [linkingInfo, setLinkingInfo] = useState<LinkingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(f => f.type === 'application/pdf');

    if (pdfFile) {
      await uploadPDF(pdfFile);
    } else {
      setError('Please upload a PDF file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPDF(file);
    }
  };

  const uploadPDF = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(false);
    setExtractedData(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_BASE_URL}/api/patient-profile/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (data.success) {
        setExtractedData(data.data);
        setLinkingInfo(data.linking);
        setSuccess(true);
      } else {
        throw new Error(data.error || 'Extraction failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setExtractedData(null);
    setLinkingInfo(null);
    setSuccess(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Patient Data Import
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload progress note PDFs to automatically extract patient profiles.
            This data powers condition-adaptive pre-visit questioning.
          </p>
        </div>

        {/* Upload Area */}
        {!extractedData && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div
              className={`
                border-3 border-dashed rounded-xl p-12 text-center transition-all
                ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
                ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {uploading ? (
                <div className="space-y-4">
                  <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Processing PDF...</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Extracting patient data with AI
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Drop PDF here or click to upload
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Progress notes from Athena, EPIC, or any EMR system
                    </p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Upload Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success & Extracted Data Display */}
        {extractedData && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-green-900">Data Extracted Successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  Patient profile has been saved and is ready for pre-visit calls
                </p>
              </div>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition"
              >
                Upload Another
              </button>
            </div>

            {/* Patient Demographics Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Information
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-semibold text-gray-900">{extractedData.patient_name || 'Not found'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date of Birth</p>
                  <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {extractedData.patient_dob || 'Not found'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    {extractedData.patient_phone || 'Not found'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">MRN</p>
                  <p className="text-lg font-semibold text-gray-900">{extractedData.patient_mrn || 'Not found'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Provider</p>
                  <p className="text-lg font-semibold text-gray-900">{extractedData.provider_name || 'Not found'}</p>
                </div>
              </div>
            </div>

            {/* Conditions Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Endocrine Conditions
                  <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                    {extractedData.conditions.length}
                  </span>
                </h2>
              </div>
              <div className="p-6">
                {extractedData.conditions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {extractedData.conditions.map((condition, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                        <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                        <span className="text-gray-900 font-medium">{condition}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No endocrine conditions extracted</p>
                )}
              </div>
            </div>

            {/* Medications Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Pill className="w-5 h-5" />
                  Current Medications
                  <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                    {extractedData.medications.length}
                  </span>
                </h2>
              </div>
              <div className="p-6">
                {extractedData.medications.length > 0 ? (
                  <div className="space-y-3">
                    {extractedData.medications.slice(0, 10).map((med, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <Pill className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{med.name}</p>
                          {med.dose && med.frequency && (
                            <p className="text-sm text-gray-600 mt-1">
                              {med.dose} {med.frequency}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {extractedData.medications.length > 10 && (
                      <p className="text-sm text-gray-500 text-center mt-4">
                        + {extractedData.medications.length - 10} more medications
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No medications extracted</p>
                )}
              </div>
            </div>

            {/* Linked Appointments Card */}
            {linkingInfo && linkingInfo.linked_appointments > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" />
                    Linked Appointments
                    <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                      {linkingInfo.linked_appointments}
                    </span>
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {linkingInfo.details.map((appt, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                        <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {new Date(appt.appointment_date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {appt.appointment_time} • {appt.provider_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Auto-linked
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
                    <p className="text-sm text-indigo-900">
                      <span className="font-semibold">🔗 Auto-linking successful!</span> Patient profile was automatically linked to {linkingInfo.linked_appointments} upcoming appointment{linkingInfo.linked_appointments > 1 ? 's' : ''} by matching phone number.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No Appointments Warning */}
            {linkingInfo && linkingInfo.linked_appointments === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-2">No Appointments Found</h3>
                    <p className="text-sm text-amber-800">
                      This patient profile was saved successfully, but no upcoming appointments were found to link to.
                      Appointments will be automatically linked when you import the schedule CSV or when they're added manually.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3">✅ Next Steps</h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li>1. Patient profile has been saved to the database</li>
                {linkingInfo && linkingInfo.linked_appointments > 0 && (
                  <li>2. ✅ Auto-linked to {linkingInfo.linked_appointments} upcoming appointment{linkingInfo.linked_appointments > 1 ? 's' : ''}</li>
                )}
                <li>{linkingInfo && linkingInfo.linked_appointments > 0 ? '3' : '2'}. When patient calls <span className="font-mono font-semibold">(832) 402-7671</span>, system will recognize them</li>
                <li>{linkingInfo && linkingInfo.linked_appointments > 0 ? '4' : '3'}. Pre-visit questions will adapt based on their conditions: {extractedData.conditions.join(', ')}</li>
                <li>{linkingInfo && linkingInfo.linked_appointments > 0 ? '5' : '4'}. Captured data will appear on the appointment schedule</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
