import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { paymentRequestService } from '../services/paymentRequest.service';
import type { PaymentRequest, PaymentType } from '../types/payment.types';

// Get API URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AppointmentInfo {
  id: number;
  patient_name: string;
  patient_phone: string;
  scheduled_date: string;
  start_time: string;
  provider_name: string;
  internal_id?: string;
  tsh_id?: string;
  old_emr_number?: string;  // MRN from Athena/old system
}

export default function StaffPreVisitPrep() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Form data
  const [previousNotes, setPreviousNotes] = useState('');
  const [medications, setMedications] = useState('');
  const [labResults, setLabResults] = useState('');
  const [vitals, setVitals] = useState({
    bp: '',
    hr: '',
    temp: '',
    weight: '',
    height: '',
    bmi: ''
  });
  const [questionnaire, setQuestionnaire] = useState('');
  const [insuranceNotes, setInsuranceNotes] = useState('');
  const [otherDocs, setOtherDocs] = useState('');
  const [billing, setBilling] = useState({
    emCode: '',
    copayAmount: '',
    amountCharged: '',
    patientPaid: false,
    paymentMethod: '',
    billingNotes: ''
  });

  // Payment Request States
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('copay');
  const [paymentLink, setPaymentLink] = useState('');
  const [activePaymentRequest, setActivePaymentRequest] = useState<PaymentRequest | null>(null);
  const [generatingPayment, setGeneratingPayment] = useState(false);
  const [shareLinkId, setShareLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId) {
      loadAppointmentData();
      loadExistingPreVisit();
      loadShareLinkAndPayment();
    }
  }, [appointmentId]);

  // Currency formatting helper
  const formatCurrency = (value: string) => {
    // Remove non-numeric characters except decimal
    const numericValue = value.replace(/[^0-9.]/g, '');
    // Limit to 2 decimal places
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts[1]?.length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    return numericValue;
  };

  const loadAppointmentData = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_schedules')
        .select(`
          *,
          unified_patients!unified_patient_id (
            patient_id,
            tshla_id,
            phone_primary,
            mrn
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      const patient = data.unified_patients;
      setAppointment({
        id: data.id,
        patient_name: data.patient_name || 'Unknown',
        patient_phone: data.patient_phone || patient?.phone_primary || 'N/A',
        scheduled_date: data.scheduled_date,
        start_time: data.start_time,
        provider_name: data.provider_name || data.provider_id,
        internal_id: patient?.patient_id,
        tsh_id: patient?.tshla_id,
        old_emr_number: patient?.mrn
      });
    } catch (error) {
      console.error('Error loading appointment:', error);
      alert('Failed to load appointment data');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPreVisit = async () => {
    try {
      const { data, error } = await supabase
        .from('previsit_data')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single();

      if (data) {
        setPreviousNotes(data.previous_notes || '');
        setMedications(data.medications_list || '');
        setLabResults(data.lab_results || '');
        setVitals(data.vitals || {});
        setQuestionnaire(data.patient_questionnaire || '');
        setInsuranceNotes(data.insurance_notes || '');
        setOtherDocs(data.other_documents || '');
        setBilling({
          emCode: data.em_code || '',
          copayAmount: data.copay_amount?.toString() || '',
          amountCharged: data.amount_charged?.toString() || '',
          patientPaid: data.patient_paid || false,
          paymentMethod: data.payment_method || '',
          billingNotes: data.billing_notes || ''
        });
      }
    } catch (error) {
      // No existing data, that's fine
      console.log('No existing pre-visit data found');
    }
  };

  const loadShareLinkAndPayment = async () => {
    try {
      // Get share_link_id from patient_audio_summaries for this appointment
      const { data: summaryData } = await supabase
        .from('patient_audio_summaries')
        .select('share_link_id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (summaryData?.share_link_id) {
        setShareLinkId(summaryData.share_link_id);

        // Load active payment request if exists
        const { data: previsitData } = await supabase
          .from('previsit_data')
          .select('active_payment_request_id')
          .eq('appointment_id', appointmentId)
          .maybeSingle();

        if (previsitData?.active_payment_request_id) {
          const { data: paymentData } = await supabase
            .from('patient_payment_requests')
            .select('*')
            .eq('id', previsitData.active_payment_request_id)
            .single();

          if (paymentData) {
            setActivePaymentRequest(paymentData);
            setPaymentLink(`${window.location.origin}/patient-summary/${summaryData.share_link_id}`);

            // If payment is paid, update the billing state
            if (paymentData.payment_status === 'paid') {
              setBilling(prev => ({
                ...prev,
                patientPaid: true,
                paymentMethod: 'Credit Card (Stripe)'
              }));
            }
          }
        }
      }
    } catch (error) {
      console.log('No share link or payment request found');
    }
  };

  const handleGeneratePaymentRequest = async () => {
    if (!paymentAmount || !appointment || !shareLinkId) {
      alert('Please ensure patient has a summary link and enter a payment amount');
      return;
    }

    const amountCents = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setGeneratingPayment(true);
    try {
      const staffData = sessionStorage.getItem('tshla_medical_user');
      const staffId = staffData ? JSON.parse(staffData).id : null;

      const response = await paymentRequestService.createPaymentRequest({
        previsit_id: appointmentId,
        appointment_id: appointmentId,
        tshla_id: appointment.tsh_id || '',
        share_link_id: shareLinkId,
        patient_name: appointment.patient_name,
        patient_phone: appointment.patient_phone,
        athena_mrn: appointment.old_emr_number,
        amount_cents: amountCents,
        payment_type: paymentType,
        em_code: billing.emCode,
        provider_name: appointment.provider_name,
        visit_date: appointment.scheduled_date,
        notes: `Payment request generated from pre-visit prep`
      });

      if (response.success) {
        setActivePaymentRequest(response.paymentRequest);
        setPaymentLink(response.paymentLink);

        // Update previsit_data with active payment request ID
        await supabase
          .from('previsit_data')
          .update({ active_payment_request_id: response.paymentRequest.id })
          .eq('appointment_id', appointmentId);

        alert('Payment request generated! Copy the link to send to patient via Klara.');
      }
    } catch (error) {
      console.error('Error generating payment request:', error);
      alert('Failed to generate payment request');
    } finally {
      setGeneratingPayment(false);
    }
  };

  const handleCopyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLink);
    alert('Payment link copied to clipboard!');
  };

  const handleSaveDraft = async () => {
    if (!appointmentId) return;

    setSaving(true);
    try {
      const previsitData = {
        appointment_id: appointmentId,
        previous_notes: previousNotes,
        medications_list: medications,
        lab_results: labResults,
        vitals: vitals,
        patient_questionnaire: questionnaire,
        insurance_notes: insuranceNotes,
        other_documents: otherDocs,
        em_code: billing.emCode || null,
        copay_amount: billing.copayAmount ? parseFloat(billing.copayAmount) : null,
        amount_charged: billing.amountCharged ? parseFloat(billing.amountCharged) : null,
        patient_paid: billing.patientPaid,
        payment_method: billing.paymentMethod || null,
        billing_notes: billing.billingNotes || null,
        billing_updated_at: new Date().toISOString(),
        completed: false
      };

      const { error } = await supabase
        .from('previsit_data')
        .upsert(previsitData, { onConflict: 'appointment_id' });

      if (error) throw error;

      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!appointmentId) return;

    setAiProcessing(true);
    try {
      // First save the data
      await handleSaveDraft();

      // Call AI service to generate summary via Azure Container App
      const response = await fetch(`${API_URL}/api/ai/generate-previsit-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          previousNotes,
          medications,
          labResults,
          vitals,
          questionnaire
        })
      });

      if (!response.ok) throw new Error('AI processing failed');

      const { summary, chiefComplaint, medicationChanges, abnormalLabs } = await response.json();

      // Save AI-generated summary
      const { error } = await supabase
        .from('previsit_data')
        .update({
          ai_summary: summary,
          chief_complaint: chiefComplaint,
          medication_changes: medicationChanges,
          abnormal_labs: abnormalLabs,
          ai_summary_generated_at: new Date().toISOString(),
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId);

      if (error) throw error;

      // Mark appointment as pre-visit complete
      await supabase
        .from('provider_schedules')
        .update({
          pre_visit_complete: true,
          pre_visit_completed_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      alert('Pre-visit summary generated successfully!');
      navigate('/staff-previsit-workflow');
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate AI summary. Draft has been saved.');
    } finally {
      setAiProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Appointment Not Found</h2>
          <button
            onClick={() => navigate('/staff-previsit-workflow')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Pre-Visit Workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/staff-previsit-workflow')}
              className="text-purple-100 hover:text-white"
            >
              ← Back to Pre-Visit Workflow
            </button>
            <button
              onClick={() => navigate('/staff-dashboard')}
              className="px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-purple-50 font-medium transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
          <h1 className="text-3xl font-bold">Pre-Visit Preparation</h1>
          <p className="text-purple-100 mt-1">Prepare patient information before provider visit</p>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Appointment Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Patient</p>
              <p className="font-semibold">{appointment.patient_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Old EMR # (Athena)</p>
              <p className="font-mono font-semibold text-orange-600 text-lg">{appointment.old_emr_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Internal ID</p>
              <p className="font-mono font-semibold text-blue-600">{appointment.internal_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">TSH ID</p>
              <p className="font-mono font-semibold text-purple-600">{appointment.tsh_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Provider</p>
              <p className="font-semibold">{appointment.provider_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-semibold">{new Date(appointment.scheduled_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Time</p>
              <p className="font-semibold">{appointment.start_time}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{appointment.patient_phone}</p>
            </div>
          </div>
        </div>

        {/* Data Entry Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Previous Notes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📝 Previous Visit Notes</h3>
            <p className="text-sm text-gray-600 mb-3">Copy/paste from old EMR</p>
            <textarea
              value={previousNotes}
              onChange={(e) => setPreviousNotes(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder="Paste previous visit notes here..."
            />
          </div>

          {/* Medications */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">💊 Current Medications</h3>
            <p className="text-sm text-gray-600 mb-3">List all current medications</p>
            <textarea
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder="e.g., Metformin 1000mg BID&#10;Lisinopril 10mg daily"
            />
          </div>

          {/* Lab Results */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🧪 Recent Lab Results</h3>
            <p className="text-sm text-gray-600 mb-3">Paste lab results with dates</p>
            <textarea
              value={labResults}
              onChange={(e) => setLabResults(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder="e.g., A1C: 7.2% (12/15/2025)&#10;Creatinine: 1.1 (12/15/2025)"
            />
          </div>

          {/* Vitals */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🩺 Vitals (Today)</h3>
            <p className="text-sm text-gray-600 mb-3">Enter today's vital signs</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                <input
                  type="text"
                  value={vitals.bp}
                  onChange={(e) => setVitals({...vitals, bp: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="120/80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate</label>
                <input
                  type="text"
                  value={vitals.hr}
                  onChange={(e) => setVitals({...vitals, hr: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="72"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°F)</label>
                <input
                  type="text"
                  value={vitals.temp}
                  onChange={(e) => setVitals({...vitals, temp: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="98.6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                <input
                  type="text"
                  value={vitals.weight}
                  onChange={(e) => setVitals({...vitals, weight: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                <input
                  type="text"
                  value={vitals.height}
                  onChange={(e) => setVitals({...vitals, height: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="65"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BMI</label>
                <input
                  type="text"
                  value={vitals.bmi}
                  onChange={(e) => setVitals({...vitals, bmi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="25.0"
                />
              </div>
            </div>
          </div>

          {/* Questionnaire */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📋 Patient Questionnaire</h3>
            <p className="text-sm text-gray-600 mb-3">Patient responses, concerns, goals</p>
            <textarea
              value={questionnaire}
              onChange={(e) => setQuestionnaire(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Patient concerns, questions, goals for visit..."
            />
          </div>

          {/* Billing & Payment */}
          <div className={`bg-white rounded-lg shadow-md p-6 transition-all ${
            billing.patientPaid ? 'border-2 border-green-500' : 'border-2 border-yellow-400'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <h3 className="text-lg font-bold text-gray-900">Billing & Payment</h3>
              </div>
              {billing.patientPaid && (
                <span className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                  <span className="text-xl">✓</span>
                  Paid
                </span>
              )}
              {!billing.patientPaid && billing.amountCharged && (
                <span className="flex items-center gap-1 text-yellow-600 font-semibold text-sm">
                  <span className="text-xl">⚠</span>
                  Unpaid
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">E/M code, copay, and payment tracking</p>

            <div className="grid grid-cols-2 gap-4">
              {/* E/M Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E/M Code</label>
                <select
                  value={billing.emCode}
                  onChange={(e) => setBilling({...billing, emCode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select code...</option>
                  <option value="99211">99211 - Minimal (5 min)</option>
                  <option value="99212">99212 - Low (10 min)</option>
                  <option value="99213">99213 - Moderate (15 min)</option>
                  <option value="99214">99214 - Moderate-High (25 min)</option>
                  <option value="99215">99215 - High (40 min)</option>
                  <option value="99381">99381 - New Preventive (Infant)</option>
                  <option value="99382">99382 - New Preventive (1-4 yr)</option>
                  <option value="99383">99383 - New Preventive (5-11 yr)</option>
                  <option value="99384">99384 - New Preventive (12-17 yr)</option>
                  <option value="99385">99385 - New Preventive (18-39 yr)</option>
                  <option value="99386">99386 - New Preventive (40-64 yr)</option>
                  <option value="99387">99387 - New Preventive (65+ yr)</option>
                  <option value="99391">99391 - Est Preventive (Infant)</option>
                  <option value="99392">99392 - Est Preventive (1-4 yr)</option>
                  <option value="99393">99393 - Est Preventive (5-11 yr)</option>
                  <option value="99394">99394 - Est Preventive (12-17 yr)</option>
                  <option value="99395">99395 - Est Preventive (18-39 yr)</option>
                  <option value="99396">99396 - Est Preventive (40-64 yr)</option>
                  <option value="99397">99397 - Est Preventive (65+ yr)</option>
                </select>
              </div>

              {/* Copay/Deductible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copay/Deductible</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={billing.copayAmount}
                    onChange={(e) => setBilling({...billing, copayAmount: formatCurrency(e.target.value)})}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Amount Charged */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Charged</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={billing.amountCharged}
                    onChange={(e) => setBilling({...billing, amountCharged: formatCurrency(e.target.value)})}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={billing.paymentMethod}
                  onChange={(e) => setBilling({...billing, paymentMethod: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select method...</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Check">Check</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Payment Plan">Payment Plan</option>
                  <option value="Not Paid">Not Paid</option>
                </select>
              </div>

              {/* Patient Paid Checkbox */}
              <div className="col-span-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  billing.patientPaid
                    ? 'bg-green-50 border-2 border-green-500'
                    : 'bg-gray-50 border-2 border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="checkbox"
                    checked={billing.patientPaid}
                    onChange={(e) => setBilling({...billing, patientPaid: e.target.checked})}
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className={`font-semibold ${
                    billing.patientPaid ? 'text-green-700' : 'text-gray-700'
                  }`}>
                    {billing.patientPaid ? '✓ Patient Paid' : 'Patient Paid'}
                  </span>
                </label>
              </div>

              {/* Billing Notes */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Notes</label>
                <textarea
                  value={billing.billingNotes}
                  onChange={(e) => setBilling({...billing, billingNotes: e.target.value})}
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder="Payment plan details, insurance pending, waived copay, etc..."
                />
              </div>
            </div>
          </div>

          {/* Online Payment Request */}
          <div className={`bg-white rounded-lg shadow-md p-6 transition-all ${
            activePaymentRequest?.payment_status === 'paid'
              ? 'border-2 border-green-500'
              : activePaymentRequest
                ? 'border-2 border-blue-500'
                : 'border-2 border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💳</span>
                <h3 className="text-lg font-bold text-gray-900">Online Payment Request</h3>
              </div>
              {activePaymentRequest?.payment_status === 'paid' && (
                <span className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                  <span className="text-xl">✓</span>
                  Patient Paid Online
                </span>
              )}
              {activePaymentRequest?.payment_status === 'pending' && (
                <span className="flex items-center gap-1 text-blue-600 font-semibold text-sm">
                  <span className="text-xl">⏳</span>
                  Payment Pending
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">Send payment link to patient via Klara</p>

            {!shareLinkId && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠ Patient needs an audio summary created first to generate payment link
                </p>
              </div>
            )}

            {!activePaymentRequest ? (
              <div className="grid grid-cols-3 gap-4">
                {/* Payment Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(formatCurrency(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      disabled={!shareLinkId}
                    />
                  </div>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!shareLinkId}
                  >
                    <option value="copay">Copay</option>
                    <option value="deductible">Deductible</option>
                    <option value="balance">Balance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Generate Button */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                  <button
                    onClick={handleGeneratePaymentRequest}
                    disabled={generatingPayment || !shareLinkId || !paymentAmount}
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingPayment ? '🔄 Generating...' : '📨 Generate Payment Link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment Status */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(activePaymentRequest.amount_cents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">
                      {activePaymentRequest.payment_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className={`text-lg font-semibold capitalize ${
                      activePaymentRequest.payment_status === 'paid' ? 'text-green-600' :
                      activePaymentRequest.payment_status === 'pending' ? 'text-blue-600' :
                      'text-gray-600'
                    }`}>
                      {activePaymentRequest.payment_status}
                    </p>
                  </div>
                </div>

                {/* Payment Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Link (Send via Klara)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={paymentLink}
                      readOnly
                      className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-lg bg-blue-50 font-mono text-sm"
                    />
                    <button
                      onClick={handleCopyPaymentLink}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all"
                    >
                      📋 Copy Link
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Copy this link and send to patient via Klara. Patient will see payment option on their summary page.
                  </p>
                </div>

                {activePaymentRequest.payment_status === 'paid' && activePaymentRequest.paid_at && (
                  <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                    <p className="text-sm text-green-800 font-semibold">
                      ✓ Patient paid ${(activePaymentRequest.amount_cents / 100).toFixed(2)} on{' '}
                      {new Date(activePaymentRequest.paid_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Insurance Notes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🏥 Insurance / Authorization</h3>
            <p className="text-sm text-gray-600 mb-3">Insurance status, prior auth needed</p>
            <textarea
              value={insuranceNotes}
              onChange={(e) => setInsuranceNotes(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Insurance active, deductible met, prior auth for XYZ..."
            />
          </div>

          {/* Other Documents */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📄 Other Documents / Notes</h3>
            <p className="text-sm text-gray-600 mb-3">Any additional information</p>
            <textarea
              value={otherDocs}
              onChange={(e) => setOtherDocs(e.target.value)}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Additional notes, documents, context..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 justify-end">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save Draft'}
          </button>
          <button
            onClick={handleGenerateSummary}
            disabled={aiProcessing || saving}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50"
          >
            {aiProcessing ? '🤖 AI Processing...' : '✨ Generate Summary & Complete'}
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>💡 Tip: Save drafts frequently. Click "Generate Summary" when all data is entered to create AI summary for provider.</p>
        </div>
      </div>
    </div>
  );
}
