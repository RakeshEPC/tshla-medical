/**
 * PCM Patient Setup/Enrollment Page
 * For providers/staff to enroll patients in PCM program and set goals
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  X,
  Search,
  User,
  Activity,
  Heart,
  Weight,
  Droplet,
  Target,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileText
} from 'lucide-react';
import { pcmService } from '../services/pcm.service';
import type { PCMPatient } from '../components/pcm/PatientRiskCard';
import { pcmDataExtractionService, type PCMExtractionResult } from '../services/pcmDataExtraction.service';
import { patientAccessGenerator } from '../services/patientAccessGenerator.service';

export default function PCMPatientSetup() {
  const navigate = useNavigate();
  const { patientId } = useParams();

  const [step, setStep] = useState<'search' | 'setup' | 'confirm'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-extracted PCM data from dictation
  const [extractedPCMData, setExtractedPCMData] = useState<PCMExtractionResult | null>(null);
  const [autoPopulatedFields, setAutoPopulatedFields] = useState<Set<string>>(new Set());

  // Patient portal access
  const [sendPatientAccess, setSendPatientAccess] = useState(true); // Default to true
  const [patientAccessResult, setPatientAccessResult] = useState<string>('');

  // PCM enrollment data
  const [pcmData, setPcmData] = useState({
    // Patient identification
    patientId: '',
    patientName: '',
    age: 0,
    phone: '',
    email: '',

    // Enrollment details
    enrollmentDate: new Date().toISOString().split('T')[0],
    primaryProvider: '',

    // Current/Baseline values
    currentA1C: '',
    currentBP: '',
    currentWeight: '',

    // Target goals
    targetA1C: '7.0',
    targetBP: '130/80',
    targetWeight: '',

    // Additional metrics
    ldlCholesterol: '',
    hdlCholesterol: '',
    triglycerides: '',
    eGFR: '',

    // Medications
    currentMedications: '',

    // Risk assessment
    riskLevel: 'medium' as 'high' | 'medium' | 'low',

    // Notes
    clinicalNotes: ''
  });

  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    }

    // Check if coming from dictation with pre-filled data
    const params = new URLSearchParams(window.location.search);
    const fromDictation = params.get('fromDictation');

    if (fromDictation === 'true') {
      const name = params.get('name') || '';
      const phone = params.get('phone') || '';
      const email = params.get('email') || '';
      const mrn = params.get('mrn') || '';
      const age = params.get('age') || '';
      const hasOrders = params.get('hasOrders') === 'true';
      const medicationCount = parseInt(params.get('medicationCount') || '0');
      const labCount = parseInt(params.get('labCount') || '0');

      // NEW: Extract PCM data from clinical note if provided
      const clinicalNoteParam = params.get('clinicalNote');
      let pcmExtracted: PCMExtractionResult | null = null;
      const autoFields = new Set<string>();

      if (clinicalNoteParam) {
        try {
          const decodedNote = decodeURIComponent(clinicalNoteParam);
          pcmExtracted = pcmDataExtractionService.extractPCMData(decodedNote);
          setExtractedPCMData(pcmExtracted);

          console.log('🔍 Extracted PCM Data from Dictation:', pcmExtracted);
        } catch (error) {
          console.error('Error extracting PCM data:', error);
        }
      }

      // Pre-fill patient data
      const initialData: any = {
        patientId: mrn || 'patient-' + Date.now(),
        patientName: name,
        age: parseInt(age) || 0,
        phone: phone,
        email: email,
        clinicalNotes: hasOrders
          ? `Patient referred from dictation.\n${medicationCount} medication order(s) and ${labCount} lab order(s) were extracted from clinical note.\n\nReview extracted orders in the Orders section.`
          : 'Patient referred from dictation for PCM enrollment.'
      };

      // Auto-populate baseline values from extracted PCM data
      if (pcmExtracted) {
        if (pcmExtracted.a1c?.currentValue) {
          initialData.currentA1C = String(pcmExtracted.a1c.currentValue);
          autoFields.add('currentA1C');
        }
        if (pcmExtracted.a1c?.targetValue) {
          initialData.targetA1C = String(pcmExtracted.a1c.targetValue);
          autoFields.add('targetA1C');
        }

        if (pcmExtracted.bloodPressure?.currentValue) {
          initialData.currentBP = String(pcmExtracted.bloodPressure.currentValue);
          autoFields.add('currentBP');
        }
        if (pcmExtracted.bloodPressure?.targetValue) {
          initialData.targetBP = String(pcmExtracted.bloodPressure.targetValue);
          autoFields.add('targetBP');
        }

        if (pcmExtracted.weight?.currentValue) {
          initialData.currentWeight = String(pcmExtracted.weight.currentValue);
          autoFields.add('currentWeight');
        }
        if (pcmExtracted.weight?.targetValue) {
          initialData.targetWeight = String(pcmExtracted.weight.targetValue);
          autoFields.add('targetWeight');
        }

        if (pcmExtracted.ldl?.currentValue) {
          initialData.ldlCholesterol = String(pcmExtracted.ldl.currentValue);
          autoFields.add('ldlCholesterol');
        }
        if (pcmExtracted.hdl?.currentValue) {
          initialData.hdlCholesterol = String(pcmExtracted.hdl.currentValue);
          autoFields.add('hdlCholesterol');
        }
        if (pcmExtracted.triglycerides?.currentValue) {
          initialData.triglycerides = String(pcmExtracted.triglycerides.currentValue);
          autoFields.add('triglycerides');
        }
        if (pcmExtracted.egfr?.currentValue) {
          initialData.eGFR = String(pcmExtracted.egfr.currentValue);
          autoFields.add('eGFR');
        }

        // Add current medications
        if (pcmExtracted.currentMedications.length > 0) {
          initialData.currentMedications = pcmExtracted.currentMedications.join(', ');
          autoFields.add('currentMedications');
        }

        // Add note about auto-extraction
        const extractionSummary = pcmDataExtractionService.formatForDisplay(pcmExtracted);
        if (extractionSummary) {
          initialData.clinicalNotes += `\n\n📊 Auto-Extracted PCM Data:\n${extractionSummary}`;
        }
      }

      setPcmData(prev => ({ ...prev, ...initialData }));
      setAutoPopulatedFields(autoFields);

      // Set selected patient
      setSelectedPatient({
        id: mrn || 'patient-' + Date.now(),
        name: name,
        age: parseInt(age) || 65,
        phone: phone,
        email: email
      });

      // Skip search step, go directly to setup
      setStep('setup');
    }
  }, [patientId]);

  const loadPatientData = async (id: string) => {
    // In production, load from Supabase
    // For now, show setup form
    setStep('setup');
  };

  const handlePatientSearch = async () => {
    // In production, search Supabase patients table
    // For demo, simulate search
    if (searchQuery.trim()) {
      setSelectedPatient({
        id: 'patient-' + Date.now(),
        name: searchQuery,
        age: 65,
        phone: '(555) 123-4567',
        email: 'patient@email.com'
      });

      setPcmData(prev => ({
        ...prev,
        patientId: 'patient-' + Date.now(),
        patientName: searchQuery
      }));

      setStep('setup');
    }
  };

  const calculateBMI = () => {
    if (!pcmData.currentWeight || !selectedPatient?.height) return null;
    const weight = parseFloat(pcmData.currentWeight);
    const height = 70; // assume 70 inches for demo
    const bmi = (weight / (height * height)) * 703;
    return bmi.toFixed(1);
  };

  // Helper: Render auto-extraction badge if field was auto-populated
  const AutoExtractedBadge = ({ fieldName }: { fieldName: string }) => {
    if (!autoPopulatedFields.has(fieldName)) return null;

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-300">
        <span className="text-blue-500">✨</span>
        Auto-extracted
      </span>
    );
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Validate required fields
      if (!pcmData.patientName || !pcmData.currentA1C || !pcmData.targetA1C) {
        alert('Please fill in patient name and A1C values');
        setIsSaving(false);
        return;
      }

      // Create PCM patient record
      const pcmPatient: Partial<PCMPatient> = {
        id: pcmData.patientId,
        name: pcmData.patientName,
        age: pcmData.age || 0,
        phone: pcmData.phone || '',
        email: pcmData.email || '',

        lastContact: new Date().toISOString(),
        nextContactDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now

        riskLevel: pcmData.riskLevel,

        currentA1C: parseFloat(pcmData.currentA1C),
        targetA1C: parseFloat(pcmData.targetA1C),

        currentBP: pcmData.currentBP,
        targetBP: pcmData.targetBP,

        currentWeight: pcmData.currentWeight ? parseFloat(pcmData.currentWeight) : undefined,
        targetWeight: pcmData.targetWeight ? parseFloat(pcmData.targetWeight) : undefined,

        medicationAdherence: 85, // Default starting value
        missedAppointments: 0,
        monthlyMinutesLogged: 0
      };

      // In production: Save to Supabase
      // For now: Save to demo data
      console.log('Saving PCM enrollment:', pcmPatient);

      // NEW: Send patient portal access if requested
      if (sendPatientAccess && pcmData.email) {
        console.log('📧 Sending patient portal access...');

        const accessResult = await patientAccessGenerator.createPatientAccess({
          email: pcmData.email,
          patientName: pcmData.patientName,
          phone: pcmData.phone,
          mrn: pcmData.patientId,
          pcmEnrollmentId: pcmData.patientId
        });

        if (accessResult.success) {
          setPatientAccessResult(
            `✅ Patient portal access sent to ${pcmData.email}\n` +
            `Temporary password: ${accessResult.temporaryPassword}\n` +
            `Consent form: ${accessResult.consentFormUrl}`
          );
          console.log('✅ Patient access created successfully:', accessResult);
        } else {
          setPatientAccessResult(
            `⚠️ Failed to send patient access: ${accessResult.error}\n` +
            `Please create access manually or use password reset.`
          );
          console.error('❌ Failed to create patient access:', accessResult.error);
        }
      }

      // Check if this enrollment came from dictation with extracted orders
      const params = new URLSearchParams(window.location.search);
      const extractedOrdersJSON = params.get('extractedOrders');

      if (extractedOrdersJSON) {
        try {
          const extractedOrders = JSON.parse(decodeURIComponent(extractedOrdersJSON));

          // Create PCM lab orders from extracted dictation orders
          const result = await pcmService.createLabOrdersFromExtraction(
            extractedOrders,
            pcmData.patientId,
            pcmData.patientName,
            'provider-001', // TODO: Get from auth context
            'Dr. Provider' // TODO: Get from auth context
          );

          console.log(`Created ${result.created} PCM orders from dictation extraction`);

          // Update clinical notes to include order creation
          pcmData.clinicalNotes += `\n\nAuto-created ${result.created} orders from dictation extraction.`;
        } catch (orderError) {
          console.error('Error creating orders from extraction:', orderError);
          // Don't fail enrollment if order creation fails
        }
      }

      // Show success
      setStep('confirm');

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/pcm/provider');
      }, 2000);

    } catch (error) {
      console.error('Error saving PCM enrollment:', error);
      alert('Failed to save PCM enrollment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Step 1: Patient Search
  if (step === 'search') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Enroll Patient in PCM</h1>
              <p className="text-gray-600">Principal Care Management for Diabetes</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search for Patient
              </label>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handlePatientSearch()}
                    placeholder="Enter patient name, ID, or phone..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <button
                  onClick={handlePatientSearch}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Search
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Search by patient name, ID, phone number, or email
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => navigate('/pcm/provider')}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Setup Form
  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-6">
              <h1 className="text-2xl font-bold mb-2">PCM Enrollment Form</h1>
              <p className="text-red-100">Set baseline values and target goals for diabetes management</p>
            </div>

            <div className="p-8 space-y-8">
              {/* Patient Information */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Patient Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Patient Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={pcmData.patientName}
                      onChange={(e) => setPcmData({ ...pcmData, patientName: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
                    <input
                      type="number"
                      value={pcmData.age || ''}
                      onChange={(e) => setPcmData({ ...pcmData, age: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      placeholder="65"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={pcmData.phone}
                      onChange={(e) => setPcmData({ ...pcmData, phone: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={pcmData.email}
                      onChange={(e) => setPcmData({ ...pcmData, email: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      placeholder="patient@email.com"
                    />
                  </div>
                </div>
              </div>

              {/* A1C Values */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-red-600" />
                  Hemoglobin A1C
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                      Current A1C <span className="text-red-600">*</span>
                      <AutoExtractedBadge fieldName="currentA1C" />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={pcmData.currentA1C}
                        onChange={(e) => setPcmData({ ...pcmData, currentA1C: e.target.value })}
                        className="flex-1 px-4 py-3 text-2xl font-bold border-2 border-red-300 rounded-lg focus:border-red-500"
                        placeholder="8.5"
                      />
                      <span className="text-lg text-gray-600">%</span>
                    </div>
                    <p className="text-xs text-red-700 mt-2">Latest lab value</p>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                      Target A1C <span className="text-red-600">*</span>
                      <AutoExtractedBadge fieldName="targetA1C" />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={pcmData.targetA1C}
                        onChange={(e) => setPcmData({ ...pcmData, targetA1C: e.target.value })}
                        className="flex-1 px-4 py-3 text-2xl font-bold border-2 border-green-300 rounded-lg focus:border-green-500"
                        placeholder="7.0"
                      />
                      <span className="text-lg text-gray-600">%</span>
                    </div>
                    <p className="text-xs text-green-700 mt-2">Goal: typically &lt;7%</p>
                  </div>
                </div>
              </div>

              {/* Blood Pressure */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-orange-600" />
                  Blood Pressure
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-orange-900 mb-2 flex items-center gap-2">
                      Current Blood Pressure
                      <AutoExtractedBadge fieldName="currentBP" />
                    </label>
                    <input
                      type="text"
                      value={pcmData.currentBP}
                      onChange={(e) => setPcmData({ ...pcmData, currentBP: e.target.value })}
                      className="w-full px-4 py-3 text-2xl font-bold border-2 border-orange-300 rounded-lg focus:border-orange-500"
                      placeholder="140/90"
                    />
                    <p className="text-xs text-orange-700 mt-2">Format: systolic/diastolic</p>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                      Target Blood Pressure
                      <AutoExtractedBadge fieldName="targetBP" />
                    </label>
                    <input
                      type="text"
                      value={pcmData.targetBP}
                      onChange={(e) => setPcmData({ ...pcmData, targetBP: e.target.value })}
                      className="w-full px-4 py-3 text-2xl font-bold border-2 border-green-300 rounded-lg focus:border-green-500"
                      placeholder="130/80"
                    />
                    <p className="text-xs text-green-700 mt-2">Goal: &lt;130/80 mmHg</p>
                  </div>
                </div>
              </div>

              {/* Weight */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Weight className="w-5 h-5 text-purple-600" />
                  Weight Management
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                      Current Weight
                      <AutoExtractedBadge fieldName="currentWeight" />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={pcmData.currentWeight}
                        onChange={(e) => setPcmData({ ...pcmData, currentWeight: e.target.value })}
                        className="flex-1 px-4 py-3 text-2xl font-bold border-2 border-purple-300 rounded-lg focus:border-purple-500"
                        placeholder="200"
                      />
                      <span className="text-lg text-gray-600">lbs</span>
                    </div>
                    {pcmData.currentWeight && (
                      <p className="text-xs text-purple-700 mt-2">BMI: {calculateBMI() || 'N/A'}</p>
                    )}
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                      Target Weight
                      <AutoExtractedBadge fieldName="targetWeight" />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={pcmData.targetWeight}
                        onChange={(e) => setPcmData({ ...pcmData, targetWeight: e.target.value })}
                        className="flex-1 px-4 py-3 text-2xl font-bold border-2 border-green-300 rounded-lg focus:border-green-500"
                        placeholder="180"
                      />
                      <span className="text-lg text-gray-600">lbs</span>
                    </div>
                    <p className="text-xs text-green-700 mt-2">5-10% loss improves control</p>
                  </div>
                </div>
              </div>

              {/* Additional Labs (Optional) */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Additional Labs (Optional)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      LDL
                      <AutoExtractedBadge fieldName="ldlCholesterol" />
                    </label>
                    <input
                      type="number"
                      value={pcmData.ldlCholesterol}
                      onChange={(e) => setPcmData({ ...pcmData, ldlCholesterol: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      placeholder="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">mg/dL</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      HDL
                      <AutoExtractedBadge fieldName="hdlCholesterol" />
                    </label>
                    <input
                      type="number"
                      value={pcmData.hdlCholesterol}
                      onChange={(e) => setPcmData({ ...pcmData, hdlCholesterol: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      placeholder="50"
                    />
                    <p className="text-xs text-gray-500 mt-1">mg/dL</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      Triglycerides
                      <AutoExtractedBadge fieldName="triglycerides" />
                    </label>
                    <input
                      type="number"
                      value={pcmData.triglycerides}
                      onChange={(e) => setPcmData({ ...pcmData, triglycerides: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      placeholder="150"
                    />
                    <p className="text-xs text-gray-500 mt-1">mg/dL</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      eGFR
                      <AutoExtractedBadge fieldName="eGFR" />
                    </label>
                    <input
                      type="number"
                      value={pcmData.eGFR}
                      onChange={(e) => setPcmData({ ...pcmData, eGFR: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      placeholder="80"
                    />
                    <p className="text-xs text-gray-500 mt-1">Kidney</p>
                  </div>
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-yellow-600" />
                  Risk Assessment
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'low', label: 'Low Risk', color: 'green', desc: 'Well controlled, compliant' },
                    { value: 'medium', label: 'Medium Risk', color: 'yellow', desc: 'Needs monitoring' },
                    { value: 'high', label: 'High Risk', color: 'red', desc: 'Urgent attention needed' }
                  ].map((risk) => (
                    <button
                      key={risk.value}
                      onClick={() => setPcmData({ ...pcmData, riskLevel: risk.value as any })}
                      className={`p-4 border-2 rounded-lg transition ${
                        pcmData.riskLevel === risk.value
                          ? `border-${risk.color}-500 bg-${risk.color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`text-lg font-bold text-${risk.color}-600 mb-1`}>{risk.label}</div>
                      <div className="text-xs text-gray-600">{risk.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical Notes */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  Clinical Notes
                </h2>
                <textarea
                  value={pcmData.clinicalNotes}
                  onChange={(e) => setPcmData({ ...pcmData, clinicalNotes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 resize-none"
                  rows={4}
                  placeholder="Enter any relevant clinical notes, comorbidities, special considerations..."
                />
              </div>

              {/* Patient Portal Access */}
              {pcmData.email && (
                <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendPatientAccess}
                      onChange={(e) => setSendPatientAccess(e.target.checked)}
                      className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        Send Patient Portal Access
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        Automatically create patient portal login and send invitation email to{' '}
                        <span className="font-semibold text-blue-700">{pcmData.email}</span>
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        ✅ Includes: Temporary password, login link, and consent form
                      </p>
                    </div>
                  </label>

                  {patientAccessResult && (
                    <div className="mt-4 p-3 bg-white border-2 border-blue-300 rounded-lg">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                        {patientAccessResult}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {!pcmData.email && (
                <div className="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <p className="text-sm text-yellow-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Patient email required to send portal access</span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={() => navigate('/pcm/provider')}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !pcmData.patientName || !pcmData.currentA1C}
                  className={`flex-1 py-3 font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                    isSaving || !pcmData.patientName || !pcmData.currentA1C
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Save className="w-5 h-5" />
                  {isSaving ? 'Enrolling...' : 'Enroll in PCM Program'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Confirmation
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enrollment Complete!</h2>
        <p className="text-gray-600 mb-6">
          {pcmData.patientName} has been successfully enrolled in the PCM program.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>Next Steps:</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 text-left">
            <li>• Patient will appear in PCM dashboard</li>
            <li>• First contact due in 30 days</li>
            <li>• Monthly time tracking starts now</li>
          </ul>
        </div>
        <button
          onClick={() => navigate('/pcm/provider')}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          Go to PCM Dashboard
        </button>
      </div>
    </div>
  );
}
