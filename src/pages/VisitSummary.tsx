import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  User,
  Calendar,
  Stethoscope,
  Pill,
  AlertCircle,
  Activity,
  Printer,
  Download,
  Share2,
  ChevronRight,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react';

interface VisitSummaryData {
  visitId: string;
  patient: {
    name: string;
    mrn: string;
    dob: string;
    age: number;
    gender: string;
    phone: string;
    email: string;
    insurance: string;
  };
  visit: {
    date: string;
    time: string;
    type: string;
    duration: string;
    provider: string;
    location: string;
    status: 'completed' | 'in-progress' | 'cancelled';
  };
  vitals: {
    bloodPressure: string;
    pulse: string;
    temperature: string;
    respiration: string;
    oxygenSat: string;
    weight: string;
    height: string;
    bmi: string;
  };
  chiefComplaint: string;
  diagnoses: Array<{
    code: string;
    description: string;
    type: 'primary' | 'secondary';
  }>;
  procedures: Array<{
    code: string;
    description: string;
    status: string;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    route: string;
    startDate: string;
    status: 'active' | 'discontinued' | 'new';
  }>;
  labResults: Array<{
    test: string;
    result: string;
    reference: string;
    flag: 'normal' | 'high' | 'low' | 'critical';
    date: string;
  }>;
  allergies: string[];
  immunizations: Array<{
    vaccine: string;
    date: string;
    nextDue?: string;
  }>;
  socialHistory: {
    smoking: string;
    alcohol: string;
    exercise: string;
    diet: string;
  };
  familyHistory: string[];
  reviewOfSystems: {
    constitutional: string;
    cardiovascular: string;
    respiratory: string;
    gastrointestinal: string;
    neurological: string;
    musculoskeletal: string;
  };
  physicalExam: {
    general: string;
    heent: string;
    cardiovascular: string;
    respiratory: string;
    abdomen: string;
    extremities: string;
    neurological: string;
    skin: string;
  };
  assessment: string;
  plan: Array<{
    item: string;
    category: 'medication' | 'procedure' | 'referral' | 'education' | 'follow-up';
    status: 'pending' | 'completed' | 'ordered';
  }>;
  education: string[];
  followUp: {
    interval: string;
    reason: string;
    withProvider: string;
  };
  billing: {
    cptCodes: string[];
    icdCodes: string[];
    level: string;
  };
  pumpScore?: {
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    dimensions: Record<string, number>;
  };
}

export default function VisitSummary() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<VisitSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchVisitSummary();
  }, [visitId]);

  const fetchVisitSummary = async () => {
    // Mock data for demonstration
    const mockSummary: VisitSummaryData = {
      visitId: visitId || '1',
      patient: {
        name: 'John Smith',
        mrn: 'MRN001',
        dob: '1980-05-15',
        age: 44,
        gender: 'Male',
        phone: '(555) 123-4567',
        email: 'john.smith@email.com',
        insurance: 'Blue Cross Blue Shield',
      },
      visit: {
        date: '2025-01-24',
        time: '10:30 AM',
        type: 'Follow-up Visit',
        duration: '25 minutes',
        provider: 'Dr. Rakesh Patel',
        location: 'TSHLA Medical Center - Room 203',
        status: 'completed',
      },
      vitals: {
        bloodPressure: '128/78 mmHg',
        pulse: '72 bpm',
        temperature: '98.6°F',
        respiration: '16 breaths/min',
        oxygenSat: '98%',
        weight: '180 lbs',
        height: '5\'10"',
        bmi: '25.8',
      },
      chiefComplaint: 'Diabetes follow-up, medication refills',
      diagnoses: [
        {
          code: 'E11.9',
          description: 'Type 2 diabetes mellitus without complications',
          type: 'primary',
        },
        { code: 'I10', description: 'Essential hypertension', type: 'secondary' },
        { code: 'E78.5', description: 'Hyperlipidemia', type: 'secondary' },
      ],
      procedures: [
        { code: '82947', description: 'Glucose; quantitative, blood', status: 'completed' },
        { code: '83036', description: 'Hemoglobin A1c', status: 'completed' },
      ],
      medications: [
        {
          name: 'Metformin',
          dosage: '1000mg',
          frequency: 'Twice daily',
          route: 'Oral',
          startDate: '2023-01-15',
          status: 'active',
        },
        {
          name: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Once daily',
          route: 'Oral',
          startDate: '2023-01-15',
          status: 'active',
        },
        {
          name: 'Atorvastatin',
          dosage: '20mg',
          frequency: 'At bedtime',
          route: 'Oral',
          startDate: '2023-06-01',
          status: 'active',
        },
        {
          name: 'Aspirin',
          dosage: '81mg',
          frequency: 'Once daily',
          route: 'Oral',
          startDate: '2023-01-15',
          status: 'active',
        },
      ],
      labResults: [
        { test: 'HbA1c', result: '7.2%', reference: '<7.0%', flag: 'high', date: '2025-01-24' },
        {
          test: 'Glucose',
          result: '125 mg/dL',
          reference: '70-100 mg/dL',
          flag: 'high',
          date: '2025-01-24',
        },
        {
          test: 'Creatinine',
          result: '0.9 mg/dL',
          reference: '0.7-1.3 mg/dL',
          flag: 'normal',
          date: '2025-01-24',
        },
        {
          test: 'LDL Cholesterol',
          result: '110 mg/dL',
          reference: '<100 mg/dL',
          flag: 'high',
          date: '2025-01-24',
        },
      ],
      allergies: ['Penicillin - Rash', 'Sulfa drugs - Hives'],
      immunizations: [
        { vaccine: 'Influenza', date: '2024-10-15', nextDue: '2025-10-01' },
        { vaccine: 'COVID-19 Booster', date: '2024-09-01' },
        { vaccine: 'Pneumococcal', date: '2023-05-01' },
      ],
      socialHistory: {
        smoking: 'Never smoker',
        alcohol: 'Occasional, social only',
        exercise: '30 minutes walking, 3-4 times per week',
        diet: 'Following diabetic diet',
      },
      familyHistory: [
        'Father - Type 2 Diabetes, CAD',
        'Mother - Hypertension',
        'Sister - Type 2 Diabetes',
      ],
      reviewOfSystems: {
        constitutional: 'Denies fever, chills, weight loss',
        cardiovascular: 'Denies chest pain, palpitations',
        respiratory: 'Denies shortness of breath, cough',
        gastrointestinal: 'Denies nausea, vomiting, abdominal pain',
        neurological: 'Denies headaches, dizziness, numbness',
        musculoskeletal: 'Mild knee arthritis, otherwise negative',
      },
      physicalExam: {
        general: 'Well-appearing, no acute distress',
        heent: 'PERRLA, EOMI, TMs clear',
        cardiovascular: 'RRR, no murmurs',
        respiratory: 'Clear to auscultation bilaterally',
        abdomen: 'Soft, non-tender, no organomegaly',
        extremities: 'No edema, pulses intact',
        neurological: 'Alert and oriented x3, no focal deficits',
        skin: 'Warm and dry, no lesions',
      },
      assessment:
        'Type 2 diabetes with improving control. HbA1c decreased from 7.8% to 7.2%. Blood pressure at goal. Lipids near goal.',
      plan: [
        { item: 'Continue Metformin 1000mg BID', category: 'medication', status: 'completed' },
        { item: 'Continue Lisinopril 10mg daily', category: 'medication', status: 'completed' },
        { item: 'Continue Atorvastatin 20mg QHS', category: 'medication', status: 'completed' },
        { item: 'Diabetic eye exam referral', category: 'referral', status: 'ordered' },
        { item: 'Podiatry referral for preventive care', category: 'referral', status: 'ordered' },
        { item: 'Nutrition counseling', category: 'education', status: 'pending' },
        { item: 'HbA1c in 3 months', category: 'procedure', status: 'ordered' },
        { item: 'Follow-up in 3 months', category: 'follow-up', status: 'pending' },
      ],
      education: [
        'Reviewed importance of medication adherence',
        'Discussed blood sugar monitoring technique',
        'Provided diabetic diet handout',
        'Reviewed foot care guidelines',
      ],
      followUp: {
        interval: '3 months',
        reason: 'Diabetes management',
        withProvider: 'Dr. Rakesh Patel',
      },
      billing: {
        cptCodes: ['99214', '82947', '83036'],
        icdCodes: ['E11.9', 'I10', 'E78.5'],
        level: 'Level 4 - Established Patient',
      },
      pumpScore: {
        score: 85.5,
        trend: 'improving',
        dimensions: {
          glucose_control: 0.82,
          medication_adherence: 0.95,
          lifestyle_factors: 0.78,
          comorbidity_management: 0.88,
          preventive_care: 0.85,
        },
      },
    };

    setSummary(mockSummary);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Visit summary not found</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'clinical', label: 'Clinical Details', icon: Stethoscope },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'labs', label: 'Lab Results', icon: Activity },
    { id: 'plan', label: 'Plan & Follow-up', icon: Calendar },
    { id: 'pumpdrive', label: 'PumpDrive', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Visit Summary</h1>
              <p className="text-gray-600 mt-1">
                {summary.patient.name} • {summary.visit.date} • {summary.visit.type}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/print/${visitId}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="h-5 w-5" />
                Print
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export
              </button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Patient Info */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Patient Information</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{summary.patient.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">MRN</p>
                    <p className="font-medium">{summary.patient.mrn}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Age / Gender</p>
                    <p className="font-medium">
                      {summary.patient.age} years / {summary.patient.gender}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Insurance</p>
                    <p className="font-medium">{summary.patient.insurance}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Contact</p>
                    <p className="font-medium">{summary.patient.phone}</p>
                    <p className="text-sm">{summary.patient.email}</p>
                  </div>
                </div>
              </div>

              {/* Allergies */}
              <div className="bg-red-50 rounded-lg p-6 mt-6">
                <h3 className="text-lg font-semibold mb-3 text-red-700">
                  <AlertCircle className="inline h-5 w-5 mr-2" />
                  Allergies
                </h3>
                <ul className="space-y-1">
                  {summary.allergies.map((allergy, index) => (
                    <li key={index} className="text-red-700">
                      • {allergy}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Visit Details */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Visit Details</h2>

                {/* Visit Meta */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-medium">
                      {summary.visit.date} at {summary.visit.time}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Provider</p>
                    <p className="font-medium">{summary.visit.provider}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Visit Type</p>
                    <p className="font-medium">{summary.visit.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-medium">{summary.visit.duration}</p>
                  </div>
                </div>

                {/* Chief Complaint */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Chief Complaint</h3>
                  <p className="text-gray-700">{summary.chiefComplaint}</p>
                </div>

                {/* Vitals */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Vital Signs</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Blood Pressure</p>
                      <p className="font-semibold">{summary.vitals.bloodPressure}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Pulse</p>
                      <p className="font-semibold">{summary.vitals.pulse}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Temperature</p>
                      <p className="font-semibold">{summary.vitals.temperature}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500">O2 Sat</p>
                      <p className="font-semibold">{summary.vitals.oxygenSat}</p>
                    </div>
                  </div>
                </div>

                {/* Diagnoses */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Diagnoses</h3>
                  <div className="space-y-2">
                    {summary.diagnoses.map((dx, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            dx.type === 'primary'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {dx.type}
                        </span>
                        <div>
                          <p className="font-medium">{dx.description}</p>
                          <p className="text-sm text-gray-500">{dx.code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assessment */}
                <div>
                  <h3 className="font-semibold mb-2">Assessment</h3>
                  <p className="text-gray-700">{summary.assessment}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clinical' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Clinical Details</h2>

            {/* Review of Systems */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Review of Systems</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(summary.reviewOfSystems).map(([system, findings]) => (
                  <div key={system} className="border-l-4 border-blue-500 pl-4">
                    <p className="font-medium capitalize">{system}</p>
                    <p className="text-gray-600 text-sm">{findings}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Physical Exam */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Physical Examination</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(summary.physicalExam).map(([system, findings]) => (
                  <div key={system} className="border-l-4 border-green-500 pl-4">
                    <p className="font-medium capitalize">{system}</p>
                    <p className="text-gray-600 text-sm">{findings}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Medications</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">Medication</th>
                    <th className="text-left py-3 px-4">Dosage</th>
                    <th className="text-left py-3 px-4">Frequency</th>
                    <th className="text-left py-3 px-4">Route</th>
                    <th className="text-left py-3 px-4">Start Date</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.medications.map((med, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium">{med.name}</td>
                      <td className="py-3 px-4">{med.dosage}</td>
                      <td className="py-3 px-4">{med.frequency}</td>
                      <td className="py-3 px-4">{med.route}</td>
                      <td className="py-3 px-4">{med.startDate}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            med.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : med.status === 'new'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {med.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Laboratory Results</h2>
            <div className="space-y-4">
              {summary.labResults.map((lab, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{lab.test}</h4>
                      <p className="text-sm text-gray-500">Reference: {lab.reference}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          lab.flag === 'normal'
                            ? 'text-green-600'
                            : lab.flag === 'high'
                              ? 'text-orange-600'
                              : lab.flag === 'low'
                                ? 'text-blue-600'
                                : 'text-red-600'
                        }`}
                      >
                        {lab.result}
                      </p>
                      <p className="text-sm text-gray-500">{lab.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Treatment Plan & Follow-up</h2>

            {/* Action Items */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Action Items</h3>
              <div className="space-y-3">
                {summary.plan.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    {item.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : item.status === 'ordered' ? (
                      <Clock className="h-5 w-5 text-blue-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.item}</p>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        item.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'ordered'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient Education */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Patient Education Provided</h3>
              <ul className="space-y-2">
                {summary.education.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Follow-up */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Next Follow-up</h3>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">When:</span> {summary.followUp.interval}
                </p>
                <p>
                  <span className="font-medium">Reason:</span> {summary.followUp.reason}
                </p>
                <p>
                  <span className="font-medium">With:</span> {summary.followUp.withProvider}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pumpdrive' && summary.pumpScore && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">PumpDrive Analytics</h2>

            {/* Score Overview */}
            <div className="mb-8">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{summary.pumpScore.score}</p>
                  <p className="text-gray-600">Overall Score</p>
                </div>
                <div
                  className={`px-4 py-2 rounded-full ${
                    summary.pumpScore.trend === 'improving'
                      ? 'bg-green-100 text-green-700'
                      : summary.pumpScore.trend === 'stable'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {summary.pumpScore.trend === 'improving'
                    ? '↑'
                    : summary.pumpScore.trend === 'declining'
                      ? '↓'
                      : '→'}{' '}
                  {summary.pumpScore.trend}
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Score Dimensions</h3>
              <div className="space-y-3">
                {Object.entries(summary.pumpScore.dimensions).map(([dimension, score]) => (
                  <div key={dimension}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium capitalize">
                        {dimension.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm">{(score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
