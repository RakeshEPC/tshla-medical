/**
 * Patient Comprehensive H&P View Page
 * Shows full medical chart with labs, trends, goals, and patient-editable sections
 * Created: 2026-01-23
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Save,
  X,
  Plus,
  TrendingUp,
  Activity,
  Heart,
  Target,
  Upload,
  Download
} from 'lucide-react';
import LabTrendTable from '../components/LabTrendTable';
import VitalSignsTrends from '../components/VitalSignsTrends';
import CurrentlyWorkingOn from '../components/CurrentlyWorkingOn';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
}

interface ComprehensiveHP {
  patient_phone: string;
  tshla_id: string;
  demographics: any;
  medications: Array<{
    name: string;
    dosage: string;  // Changed from 'dose' to match API
    frequency: string;
    started: string;  // Changed from 'start_date' to match API
    indication: string;  // Added to match API
  }>;
  diagnoses: Array<{
    condition: string;  // Changed from 'diagnosis' to match API
    icd10: string;
    status: string;
    diagnosed?: string;  // Changed from 'onset_date' to match API
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  family_history: Array<{
    relation: string;  // Changed from 'relationship' to match API
    condition: string;
    age_of_onset?: number;  // Added to match API
  }>;
  social_history: {
    smoking?: string;
    alcohol?: string;
    exercise?: string;
    diet?: string;
  };
  labs: {
    [testName: string]: Array<{
      value: number | string;
      date: string;
      unit: string;
    }>;
  };
  vitals: {
    [vitalName: string]: Array<{
      systolic?: number;
      diastolic?: number;
      value?: number;
      date: string;
      unit?: string;
    }>;
  };
  current_goals: Array<{
    category: string;
    goal: string;
    status: string;
    added_date: string;
  }>;
  external_documents: Array<{
    filename: string;
    upload_date: string;
    document_type: string;
    url: string;
  }>;
  full_hp_narrative: string;
  last_ai_generated: string;
  version: number;
  pending_staff_review: boolean;
}

export default function PatientHPView() {
  const navigate = useNavigate();

  // Session state
  const [session, setSession] = useState<PatientSession | null>(null);

  // H&P data
  const [hp, setHp] = useState<ComprehensiveHP | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['medications', 'diagnoses', 'labs', 'vitals'])
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Load session from storage
   */
  useEffect(() => {
    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession) {
      navigate('/patient-portal-login');
      return;
    }

    const sessionData: PatientSession = JSON.parse(savedSession);
    setSession(sessionData);
  }, [navigate]);

  /**
   * Load H&P data and merge with uploaded medical records
   */
  useEffect(() => {
    if (!session) return;

    const loadHP = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load main H&P data
        const hpResponse = await fetch(
          `${API_BASE_URL}/api/hp/patient/${session.tshlaId}`,
          {
            headers: {
              'x-session-id': session.sessionId,
            },
          }
        );

        const hpData = await hpResponse.json();

        if (!hpResponse.ok || !hpData.success) {
          throw new Error(hpData.error || 'Failed to load medical chart');
        }

        // Load uploaded medical records (labs from CCD uploads)
        const recordsResponse = await fetch(
          `${API_BASE_URL}/api/patient-portal/medical-records?tshlaId=${encodeURIComponent(session.tshlaId)}&sessionId=${encodeURIComponent(session.sessionId)}`
        );

        const recordsData = await recordsResponse.json();

        // Merge uploaded data with existing H&P
        let mergedHP = hpData.hp;

        if (recordsResponse.ok && recordsData.success) {
          console.log('📊 [PatientHPView] Merging uploaded medical records:', {
            labs: recordsData.total_labs,
            medications: recordsData.medications?.length || 0,
            allergies: recordsData.allergies?.length || 0
          });

          // Merge labs - combine existing and uploaded
          const mergedLabs = recordsData.labs ? {
            ...hpData.hp.labs,
            ...recordsData.labs
          } : hpData.hp.labs;

          // Merge medications - combine existing and uploaded, deduplicate
          const existingMeds = hpData.hp.medications || [];
          const uploadedMeds = recordsData.medications || [];
          const allMeds = [...existingMeds];

          // Add uploaded medications that don't already exist
          uploadedMeds.forEach(medName => {
            const exists = existingMeds.some(existing =>
              existing.name?.toLowerCase() === medName.toLowerCase()
            );
            if (!exists && medName !== 'AthenaHealth') {
              allMeds.push({
                name: medName,
                dosage: '',
                frequency: '',
                indication: 'From uploaded records'
              });
            }
          });

          // Merge allergies - combine and deduplicate
          const existingAllergies = hpData.hp.allergies || [];
          const uploadedAllergies = recordsData.allergies || [];
          const allAllergies = [...existingAllergies];

          uploadedAllergies.forEach(allergyName => {
            const exists = existingAllergies.some(existing =>
              existing.allergen?.toLowerCase() === allergyName.toLowerCase()
            );
            if (!exists) {
              allAllergies.push({
                allergen: allergyName,
                reaction: 'From uploaded records',
                severity: 'unknown'
              });
            }
          });

          mergedHP = {
            ...hpData.hp,
            labs: mergedLabs,
            medications: allMeds,
            allergies: allAllergies
          };
        }

        setHp(mergedHP);
      } catch (err: any) {
        console.error('Load H&P error:', err);
        setError(err.message || 'Unable to load medical chart');
      } finally {
        setIsLoading(false);
      }
    };

    loadHP();
  }, [session]);

  /**
   * Toggle section expansion
   */
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  /**
   * Start editing a section (only editable sections)
   */
  const startEditing = (section: string) => {
    const editableSections = ['allergies', 'family_history', 'social_history', 'current_goals'];
    if (!editableSections.includes(section)) return;

    setEditingSection(section);
    setEditData({});
  };

  /**
   * Cancel editing
   */
  const cancelEditing = () => {
    setEditingSection(null);
    setEditData({});
  };

  /**
   * Save patient edit
   */
  const saveEdit = async () => {
    if (!session || !editingSection) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/hp/patient/${session.tshlaId}/edit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': session.sessionId,
          },
          body: JSON.stringify({
            section: editingSection,
            data: editData,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save changes');
      }

      // Reload H&P
      window.location.reload();
    } catch (err: any) {
      console.error('Save edit error:', err);
      alert(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Render section header with expand/collapse
   */
  const renderSectionHeader = (
    section: string,
    title: string,
    icon: any,
    isEditable: boolean = false
  ) => {
    const isExpanded = expandedSections.has(section);
    const Icon = icon;

    return (
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-t-xl border-b border-gray-200">
        <button
          onClick={() => toggleSection(section)}
          className="flex items-center space-x-3 flex-1 text-left"
        >
          <Icon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {isEditable && isExpanded && (
          <button
            onClick={() => startEditing(section)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm text-blue-600 hover:bg-blue-50"
          >
            <Edit2 className="w-4 h-4" />
            <span>Add/Edit</span>
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your medical chart...</p>
        </div>
      </div>
    );
  }

  if (error || !hp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Unable to Load Chart
          </h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 pb-20">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  My Medical Chart
                </h1>
                <p className="text-sm text-gray-600">
                  {session?.patientName} • TSH ID: {session?.tshlaId}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/patient-portal-unified', { state: { session } })}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Back to Dashboard
            </button>
          </div>

          {hp.pending_staff_review && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">
                  Your recent changes are pending review
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Your doctor will review and approve your updates soon
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <p>Last updated: {new Date(hp.last_ai_generated).toLocaleDateString()}</p>
            <p>Version: {hp.version}</p>
          </div>
        </div>

        {/* 2x2 Grid Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Row 1, Col 1-2: Lab Results (takes 2/3 width) */}
          <div className="lg:col-span-2">
            <div className="h-full bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-green-50 p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Lab Results</h3>
                </div>
              </div>
              <div className="p-6 max-h-[600px] overflow-y-auto">
                <LabTrendTable labs={hp.labs} />
              </div>
            </div>
          </div>

          {/* Row 1, Col 3: Current Medications (takes 1/3 width) */}
          <div className="lg:col-span-1">
            <div className="h-full bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <Heart className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-900">Medications</h3>
                </div>
                <span className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full">
                  {hp.medications.length} active
                </span>
              </div>
              <div className="p-6 max-h-[600px] overflow-y-auto">
                {hp.medications.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No medications recorded</p>
                ) : (
                  <div className="space-y-3">
                    {hp.medications.map((med, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-xl p-3 hover:bg-green-50 transition-colors"
                      >
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                          <h4 className="font-semibold text-gray-900">{med.name}</h4>
                          <span className="text-sm text-gray-600">{med.dosage}</span>
                          <span className="text-sm text-gray-600">{med.frequency}</span>
                          {med.indication && (
                            <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              {med.indication}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2, Col 1-2: Tasks & Goals (takes 2/3 width) */}
          <div className="lg:col-span-2">
            <div className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
              <CurrentlyWorkingOn
                goals={hp.current_goals}
                session={session}
                onUpdate={() => window.location.reload()}
              />
            </div>
          </div>

          {/* Row 2, Col 3: Vital Signs (takes 1/3 width) */}
          <div className="lg:col-span-1">
            <div className="h-full bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50 p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <Heart className="w-6 h-6 text-red-600" />
                  <h3 className="text-xl font-bold text-gray-900">Vital Signs</h3>
                </div>
              </div>
              <div className="p-6 max-h-[600px] overflow-y-auto">
                <VitalSignsTrends vitals={hp.vitals} />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Sections (Collapsible) */}
        <div className="space-y-6">
          {/* Diagnoses Section */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {renderSectionHeader('diagnoses', 'Active Diagnoses', Activity, false)}
            {expandedSections.has('diagnoses') && (
              <div className="p-6">
                {hp.diagnoses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No diagnoses recorded</p>
                ) : (
                  <div className="space-y-3">
                    {hp.diagnoses
                      .filter((dx) => dx.status === 'active')
                      .map((dx, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900">{dx.condition}</h4>
                              {dx.icd10 && (
                                <p className="text-xs text-gray-500 mt-1">ICD-10: {dx.icd10}</p>
                              )}
                            </div>
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                              Active
                            </span>
                          </div>
                          {dx.diagnosed && (
                            <p className="text-xs text-gray-500 mt-2">
                              Since: {new Date(dx.diagnosed).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Allergies Section (Patient Editable) */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {renderSectionHeader('allergies', 'Allergies', AlertCircle, true)}
          {expandedSections.has('allergies') && (
            <div className="p-6">
              {editingSection === 'allergies' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allergen
                    </label>
                    <input
                      type="text"
                      value={editData.allergen || ''}
                      onChange={(e) => setEditData({ ...editData, allergen: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Penicillin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reaction
                    </label>
                    <input
                      type="text"
                      value={editData.reaction || ''}
                      onChange={(e) => setEditData({ ...editData, reaction: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Rash"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Severity
                    </label>
                    <select
                      value={editData.severity || 'mild'}
                      onChange={(e) => setEditData({ ...editData, severity: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={saveEdit}
                      disabled={isSaving || !editData.allergen || !editData.reaction}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : hp.allergies.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No allergies recorded</p>
                  <button
                    onClick={() => startEditing('allergies')}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Allergy</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {hp.allergies.map((allergy, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{allergy.allergen}</h4>
                          <p className="text-sm text-gray-600 mt-1">{allergy.reaction}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            allergy.severity === 'severe'
                              ? 'bg-red-50 text-red-600'
                              : allergy.severity === 'moderate'
                              ? 'bg-yellow-50 text-yellow-600'
                              : 'bg-green-50 text-green-600'
                          }`}
                        >
                          {allergy.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>

          {/* External Documents Section */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {renderSectionHeader('documents', 'Documents & Records', Upload, false)}
          {expandedSections.has('documents') && (
            <div className="p-6">
              {hp.external_documents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No documents uploaded</p>
              ) : (
                <div className="space-y-3">
                  {hp.external_documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-900">{doc.filename}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {doc.document_type} •{' '}
                          {new Date(doc.upload_date).toLocaleDateString()}
                        </p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
