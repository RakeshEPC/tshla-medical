/**
 * Pre-Visit Demo Page
 * Demonstrates all pre-visit components with mock data
 * Created: January 2025
 */

import { useState } from 'react';
import PreVisitSummaryCard from '../components/previsit/PreVisitSummaryCard';
import PreVisitModal from '../components/previsit/PreVisitModal';
import type { PreVisitData } from '../components/previsit/PreVisitSummaryCard';

// Mock data for demonstration
const mockPreVisitData: PreVisitData = {
  id: 'demo-123',
  patient_id: 'P-2025-0001',
  call_completed: true,
  call_status: 'completed',
  call_date: new Date().toISOString(),
  current_medications: [
    'Metformin 500mg twice daily',
    'Lisinopril 10mg once daily',
    'Atorvastatin 20mg at bedtime',
    'Aspirin 81mg once daily'
  ],
  chief_concerns: [
    'Blood pressure has been running high (150/90)',
    'Experiencing occasional dizziness in the morning',
    'Recent weight gain of 8 pounds over last month'
  ],
  questions_for_provider: [
    'Should I continue my current blood pressure medication?',
    'Is the dizziness related to my blood pressure?',
    'What diet changes would you recommend for weight loss?'
  ],
  lab_status: 'Completed labs at Quest Diagnostics on Jan 10, 2025. Has results with them.',
  requires_urgent_callback: false,
  risk_flags: ['uncontrolled-hypertension', 'recent-weight-gain'],
  urgency_level: 'medium',
  ai_summary: 'Patient reports increased blood pressure readings at home (150/90) with morning dizziness. Currently taking all medications as prescribed. Recent 8-pound weight gain noted. Labs completed and patient has results. No chest pain or shortness of breath. Patient is concerned about hypertension and wants to discuss medication adjustment.',
  full_transcript: `AI Agent: Hi John, this is Sarah from TSHLA Medical. I'm calling about your appointment with Dr. Johnson tomorrow at 10 AM. This will only take a few minutes. Is now a good time?

Patient: Yes, sure. I have time now.

AI Agent: Great! Let's start with your current medications. What medications are you currently taking?

Patient: I'm taking Metformin 500 milligrams twice a day, Lisinopril 10 milligrams once a day, Atorvastatin 20 milligrams at bedtime, and Aspirin 81 milligrams once daily.

AI Agent: Thank you. Are you taking any over-the-counter medications or supplements?

Patient: No, just those prescription medications.

AI Agent: Perfect. What are the main health concerns you'd like to discuss at your appointment?

Patient: Well, my blood pressure has been running pretty high lately. I've been checking it at home and it's been around 150 over 90. Also, I've been experiencing some dizziness, especially in the morning. And I've gained about 8 pounds in the last month, which is concerning.

AI Agent: I understand. That's definitely something important to discuss. Have you had any chest pain or shortness of breath?

Patient: No, no chest pain or breathing problems. Just the dizziness and the high blood pressure readings.

AI Agent: Good to know. Have you had any recent lab work done?

Patient: Yes, I went to Quest Diagnostics on January 10th and had labs done. I have the results with me.

AI Agent: Excellent. What questions do you have for Dr. Johnson?

Patient: I want to know if I should continue my current blood pressure medication or if we need to adjust it. I'm also wondering if the dizziness is related to my blood pressure. And I'd like to know what diet changes you would recommend to help me lose some weight.

AI Agent: Those are great questions. I've noted all of that information. Is there anything else you'd like to add before your appointment?

Patient: No, I think that covers everything.

AI Agent: Perfect. Thank you so much, John. This information will help Dr. Johnson prepare for your visit tomorrow at 10 AM. If anything urgent comes up before then, please call our office immediately. Otherwise, we'll see you tomorrow!

Patient: Thank you, sounds good.

AI Agent: Have a great day!`
};

const mockPendingData: PreVisitData = {
  id: 'demo-456',
  patient_id: 'P-2025-0002',
  call_completed: false,
  call_status: 'pending',
  current_medications: [],
  chief_concerns: [],
  questions_for_provider: [],
  requires_urgent_callback: false,
  risk_flags: [],
  urgency_level: 'low'
};

const mockUrgentData: PreVisitData = {
  id: 'demo-789',
  patient_id: 'P-2025-0003',
  call_completed: true,
  call_status: 'completed',
  call_date: new Date().toISOString(),
  current_medications: [
    'Warfarin 5mg daily',
    'Metoprolol 50mg twice daily'
  ],
  chief_concerns: [
    'Experiencing chest tightness when climbing stairs',
    'Shortness of breath at rest',
    'Legs have been swelling significantly'
  ],
  questions_for_provider: [
    'Should I go to the emergency room?',
    'Is this related to my heart condition?'
  ],
  lab_status: 'No recent labs',
  requires_urgent_callback: true,
  risk_flags: ['chest-pain', 'shortness-of-breath', 'acute-symptoms'],
  urgency_level: 'critical',
  ai_summary: '⚠️ URGENT: Patient reports chest tightness with exertion, shortness of breath at rest, and significant bilateral leg swelling. Currently on Warfarin and Metoprolol. Symptoms are concerning for cardiac decompensation. RECOMMEND URGENT CALLBACK BEFORE APPOINTMENT.',
  full_transcript: '[Truncated for demo]'
};

export default function PreVisitDemo() {
  const [selectedDemo, setSelectedDemo] = useState<'completed' | 'pending' | 'urgent'>('completed');
  const [showModal, setShowModal] = useState(false);

  const getCurrentData = () => {
    switch (selectedDemo) {
      case 'completed':
        return mockPreVisitData;
      case 'pending':
        return mockPendingData;
      case 'urgent':
        return mockUrgentData;
      default:
        return mockPreVisitData;
    }
  };

  const currentData = getCurrentData();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pre-Visit System Demo
          </h1>
          <p className="text-gray-600">
            Demonstration of pre-visit components with mock data
          </p>
        </div>

        {/* Demo Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Select Demo Scenario:
          </h2>
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedDemo('completed')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                selectedDemo === 'completed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✅ Completed Call
            </button>
            <button
              onClick={() => setSelectedDemo('pending')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                selectedDemo === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ⏳ Pending Call
            </button>
            <button
              onClick={() => setSelectedDemo('urgent')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                selectedDemo === 'urgent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🚨 Urgent Callback
            </button>
          </div>
        </div>

        {/* Demo Description */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Scenario: {selectedDemo === 'completed' && 'Routine Follow-up'}
            {selectedDemo === 'pending' && 'Call Scheduled'}
            {selectedDemo === 'urgent' && 'Urgent Cardiac Symptoms'}
          </h3>
          <p className="text-sm text-blue-800">
            {selectedDemo === 'completed' &&
              'Patient completed pre-visit call. Routine hypertension follow-up with some concerns about blood pressure control and recent weight gain.'}
            {selectedDemo === 'pending' &&
              'Pre-visit call has been scheduled but not yet completed. Patient will be contacted soon.'}
            {selectedDemo === 'urgent' &&
              'Patient reported concerning cardiac symptoms during pre-visit call. Requires immediate provider callback before scheduled appointment.'}
          </p>
        </div>

        {/* Compact Card */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Compact Summary Card
          </h2>
          <PreVisitSummaryCard
            preVisitData={currentData.call_completed ? currentData : null}
            onViewDetails={() => setShowModal(true)}
            compact={true}
          />
        </div>

        {/* Full Card */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Full Summary Card
          </h2>
          <PreVisitSummaryCard
            preVisitData={currentData.call_completed ? currentData : null}
            onViewDetails={() => setShowModal(true)}
            compact={false}
          />
        </div>

        {/* Info Box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">
            ✅ Demo Complete
          </h3>
          <p className="text-green-800 mb-4">
            These components are fully functional and ready to integrate into your dashboard.
          </p>
          <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
            <li>PreVisitSummaryCard - Shows key information at a glance</li>
            <li>PreVisitModal - Full-screen detail view with transcript</li>
            <li>DictationWithPreVisit - Auto-populate dictation (not shown in demo)</li>
            <li>PreVisitAnalyticsDashboard - ROI tracking (separate route)</li>
          </ul>
          <div className="mt-4 pt-4 border-t border-green-300">
            <p className="text-sm text-green-700">
              <strong>Next Steps:</strong> Deploy SQL schema to Supabase, then test with real data!
            </p>
          </div>
        </div>

        {/* Modal */}
        {showModal && currentData.call_completed && (
          <PreVisitModal
            preVisitData={currentData}
            patientName="John Smith"
            appointmentDate={new Date().toISOString()}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>
    </div>
  );
}
