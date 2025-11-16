/**
 * PCM (Principal Care Management) Consent Form
 * Specifically designed for diabetes patients
 * Includes clinical goals tracking and billing consent
 * Created: 2025-01-16
 */

import { useState } from 'react';
import { X, Check, FileText, DollarSign, Shield, Activity, AlertCircle } from 'lucide-react';
import type { PCMConsentData } from '../types/pcm.types';

interface PCMConsentFormProps {
  patientName: string;
  patientId: string;
  onSubmit: (consentData: PCMConsentData) => Promise<void>;
  onCancel: () => void;
}

export default function PCMConsentForm({
  patientName,
  patientId,
  onSubmit,
  onCancel
}: PCMConsentFormProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'services' | 'goals' | 'billing' | 'consent'>('overview');
  const [signature, setSignature] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToBilling, setAgreedToBilling] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Diabetes goals
  const [initialA1C, setInitialA1C] = useState<number>();
  const [targetA1C, setTargetA1C] = useState<number>(7.0);
  const [initialBP, setInitialBP] = useState('');
  const [targetBP, setTargetBP] = useState('130/80');
  const [initialWeight, setInitialWeight] = useState<number>();
  const [targetWeight, setTargetWeight] = useState<number>();

  const handleSubmit = async () => {
    if (!signature || !agreedToTerms || !agreedToBilling || !agreedToPrivacy) {
      alert('Please complete all required fields and checkboxes');
      return;
    }

    if (signature.trim().toLowerCase() !== patientName.trim().toLowerCase()) {
      alert('Signature must match your full name');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        signature,
        agreedToTerms,
        agreedToBilling,
        agreedToPrivacy,
        consentDate: new Date().toISOString(),
        initialA1C,
        initialBloodPressure: initialBP,
        initialWeight,
        targetA1C,
        targetBloodPressure: targetBP,
        targetWeight
      });
    } catch (error) {
      console.error('Error submitting consent:', error);
      alert('Failed to submit consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = signature && agreedToTerms && agreedToBilling && agreedToPrivacy;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Principal Care Management</h2>
              <p className="text-indigo-100">Diabetes Care Program - Enrollment & Consent</p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Progress Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'services', label: 'Services', icon: Activity },
              { id: 'goals', label: 'Diabetes Goals', icon: Activity },
              { id: 'billing', label: 'Billing', icon: DollarSign },
              { id: 'consent', label: 'Sign', icon: Shield }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap border-b-2 transition ${
                  activeSection === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">What is PCM for Diabetes?</h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-700 leading-relaxed">
                  Principal Care Management (PCM) is a Medicare-approved program designed to help you better manage your diabetes
                  through coordinated care, regular monitoring, and support from our healthcare team.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Dedicated Care Coordination</p>
                    <p className="text-gray-600 text-sm">Monthly check-ins to monitor your diabetes management and adjust your care plan</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">24/7 Access to Care Team</p>
                    <p className="text-gray-600 text-sm">Reach our team anytime for questions about your diabetes management</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Goal Tracking & Support</p>
                    <p className="text-gray-600 text-sm">Monitor A1C, blood pressure, weight, and other key diabetes metrics</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Medication Management</p>
                    <p className="text-gray-600 text-sm">Help managing your diabetes medications and preventing complications</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900 mb-1">Voluntary Program</p>
                    <p className="text-amber-800 text-sm">
                      Enrollment in PCM is completely voluntary. You may decline enrollment or revoke your consent at any time
                      without affecting your regular medical care.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Services Section */}
          {activeSection === 'services' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Included Services</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Care Coordination</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Monthly care team check-ins</li>
                    <li>• Coordination between specialists</li>
                    <li>• Lab test tracking & follow-up</li>
                    <li>• Medication refill reminders</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Clinical Monitoring</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• A1C tracking (target: {'<'}7.0%)</li>
                    <li>• Blood pressure monitoring</li>
                    <li>• Weight management support</li>
                    <li>• Blood glucose pattern review</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Education & Support</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Diabetes self-management education</li>
                    <li>• Nutrition counseling</li>
                    <li>• Exercise recommendations</li>
                    <li>• Complication prevention</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">24/7 Access</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• After-hours care team access</li>
                    <li>• Patient portal messaging</li>
                    <li>• Emergency guidance</li>
                    <li>• Care plan adjustments</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Time Commitment Required</h4>
                <p className="text-gray-700 text-sm">
                  PCM requires at least <strong>30 minutes of clinical staff time per calendar month</strong>. This includes:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 ml-4">
                  <li>• Phone check-ins and care coordination</li>
                  <li>• Reviewing test results and updating care plans</li>
                  <li>• Communication with your care team</li>
                  <li>• Medication management and refill coordination</li>
                </ul>
              </div>
            </div>
          )}

          {/* Diabetes Goals Section */}
          {activeSection === 'goals' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Your Diabetes Management Goals</h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-gray-700 text-sm">
                  Setting clear, measurable goals helps us track your progress and adjust your care plan.
                  These initial values will be reviewed and updated during your first PCM visit.
                </p>
              </div>

              <div className="space-y-6">
                {/* A1C Goals */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-600" />
                    Hemoglobin A1C (Blood Sugar Control)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current A1C (if known) %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="4"
                        max="15"
                        value={initialA1C || ''}
                        onChange={(e) => setInitialA1C(parseFloat(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., 8.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target A1C %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="4"
                        max="10"
                        value={targetA1C}
                        onChange={(e) => setTargetA1C(parseFloat(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Standard target: {'<'}7.0% for most adults. Your provider may set a different target based on your individual needs.
                  </p>
                </div>

                {/* Blood Pressure Goals */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-600" />
                    Blood Pressure
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current BP (if known)
                      </label>
                      <input
                        type="text"
                        value={initialBP}
                        onChange={(e) => setInitialBP(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., 145/90"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target BP
                      </label>
                      <input
                        type="text"
                        value={targetBP}
                        onChange={(e) => setTargetBP(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Standard target: {'<'}130/80 mmHg for people with diabetes
                  </p>
                </div>

                {/* Weight Goals */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Weight Management
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Weight (lbs)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={initialWeight || ''}
                        onChange={(e) => setInitialWeight(parseFloat(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., 185"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Weight (lbs)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={targetWeight || ''}
                        onChange={(e) => setTargetWeight(parseFloat(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., 170"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Even modest weight loss (5-10% of body weight) can significantly improve diabetes control
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> These goals are initial estimates. Your care team will review and adjust them based on
                  your complete medical history, current medications, and individual circumstances during your first PCM visit.
                </p>
              </div>
            </div>
          )}

          {/* Billing Section */}
          {activeSection === 'billing' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Billing Information</h3>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Medicare Coverage</h4>
                <p className="text-green-800 text-sm">
                  Principal Care Management is covered by Medicare Part B and most Medicare Advantage plans when you have
                  a single high-risk chronic condition requiring intensive care coordination.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Billing Codes & Costs</h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-900">CPT Code</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-900">Service Time</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-900">Medicare Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-2 font-mono">99424</td>
                        <td className="px-4 py-2">30-44 minutes</td>
                        <td className="px-4 py-2">~$68/month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono">99425</td>
                        <td className="px-4 py-2">45-59 minutes</td>
                        <td className="px-4 py-2">~$95/month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono">99426</td>
                        <td className="px-4 py-2">60-74 minutes</td>
                        <td className="px-4 py-2">~$123/month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono">99427</td>
                        <td className="px-4 py-2">Each additional 30 min</td>
                        <td className="px-4 py-2">~$55/month</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-gray-500 italic">
                  * Rates are approximate and may vary. Actual charges depend on time spent on care coordination each month.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Your Cost-Sharing Responsibility</h4>
                <ul className="space-y-2 text-blue-800 text-sm">
                  <li>• <strong>Medicare Part B Deductible:</strong> If not yet met for the year</li>
                  <li>• <strong>20% Coinsurance:</strong> Standard Medicare Part B coinsurance applies</li>
                  <li>• <strong>Example:</strong> For $68 service, your cost would be approximately $13.60 (after deductible)</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Billing Cycle & Process</h4>
                <ul className="space-y-2 text-gray-700 text-sm ml-4">
                  <li>• PCM services are billed <strong>once per calendar month</strong></li>
                  <li>• Billing occurs only if at least 30 minutes of qualifying care coordination time is provided</li>
                  <li>• You will receive a statement showing the specific services provided that month</li>
                  <li>• PCM billing is separate from office visit charges</li>
                  <li>• You may receive PCM services in the same month as an office visit</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Important Billing Information
                </h4>
                <ul className="space-y-2 text-amber-800 text-sm">
                  <li>• <strong>Not a subscription:</strong> You are only billed for months when services are provided</li>
                  <li>• <strong>Private insurance:</strong> Coverage varies by plan; contact your insurer for details</li>
                  <li>• <strong>Financial hardship:</strong> If you have difficulty paying, please contact our billing department</li>
                  <li>• <strong>Right to decline:</strong> You may decline PCM services at any time without penalty</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Questions About Billing?</h4>
                <p className="text-gray-700 text-sm">
                  Contact our billing department at <strong>(555) 123-4567</strong> or email <strong>billing@tshla.ai</strong>
                </p>
              </div>
            </div>
          )}

          {/* Consent Section */}
          {activeSection === 'consent' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Consent & Signature</h3>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">By signing below, I acknowledge and agree that:</h4>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      I have read and understand the PCM program description, including the services provided and time commitment required.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToBilling}
                      onChange={(e) => setAgreedToBilling(e.target.checked)}
                      className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      I understand the billing process and my cost-sharing responsibilities (deductible and coinsurance) for PCM services,
                      and I consent to monthly billing when qualifying services are provided.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                      className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      I consent to the use and disclosure of my protected health information (PHI) for care coordination purposes,
                      in accordance with HIPAA privacy regulations.
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Your Rights</h4>
                <ul className="space-y-2 text-blue-800 text-sm">
                  <li>• You may <strong>revoke this consent</strong> at any time by contacting your care team</li>
                  <li>• Revoking consent will not affect any services already provided and billed</li>
                  <li>• Your regular medical care will continue regardless of PCM enrollment status</li>
                  <li>• You have the right to receive a copy of this signed consent form</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Electronic Signature (Type your full name) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-serif text-lg"
                  placeholder="Type your full name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Expected: {patientName}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Patient ID:</span>
                    <span className="ml-2 text-gray-900">{patientId}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Date:</span>
                    <span className="ml-2 text-gray-900">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition"
            >
              Decline
            </button>

            <div className="flex items-center gap-3">
              {activeSection !== 'overview' && (
                <button
                  onClick={() => {
                    const sections = ['overview', 'services', 'goals', 'billing', 'consent'];
                    const currentIndex = sections.indexOf(activeSection);
                    setActiveSection(sections[currentIndex - 1] as any);
                  }}
                  className="px-6 py-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-600 rounded-lg transition"
                >
                  Previous
                </button>
              )}

              {activeSection !== 'consent' ? (
                <button
                  onClick={() => {
                    const sections = ['overview', 'services', 'goals', 'billing', 'consent'];
                    const currentIndex = sections.indexOf(activeSection);
                    setActiveSection(sections[currentIndex + 1] as any);
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed || isSubmitting}
                  className={`px-8 py-2 rounded-lg transition flex items-center gap-2 ${
                    canProceed && !isSubmitting
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  {isSubmitting ? 'Submitting...' : 'Sign & Enroll'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
