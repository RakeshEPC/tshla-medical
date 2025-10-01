'use client';
import React, { useState, useEffect } from 'react';

export default function HIPAAComplianceWarning() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has acknowledged the warning in this session
    const ack = sessionStorage.getItem('hipaa_warning_acknowledged');
    if (ack === 'true') {
      setAcknowledged(true);
    }
  }, []);

  const handleAcknowledge = () => {
    sessionStorage.setItem('hipaa_warning_acknowledged', 'true');
    setAcknowledged(true);
  };

  if (acknowledged) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="ml-4 text-2xl font-bold text-gray-900">
              HIPAA Compliance Status: NOT COMPLIANT
            </h2>
          </div>

          {/* Critical Warning */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ CRITICAL WARNING</h3>
            <p className="text-red-800 mb-3">
              This system is currently <strong>NOT HIPAA compliant</strong> and should{' '}
              <strong>NOT be used with real patient data</strong>.
            </p>
            <p className="text-sm text-red-700">
              Using this system with actual Protected Health Information (PHI) may result in:
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
              <li>HIPAA violations with fines from $100 to $50,000 per violation</li>
              <li>Annual maximum penalties up to $1.5 million</li>
              <li>Criminal charges for willful neglect</li>
              <li>Loss of medical license</li>
              <li>Civil lawsuits from affected patients</li>
            </ul>
          </div>

          {/* Current Issues */}
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center text-gray-700 hover:text-gray-900 font-medium"
            >
              <svg
                className={`w-4 h-4 mr-2 transform transition-transform ${showDetails ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              {showDetails ? 'Hide' : 'Show'} Compliance Issues
            </button>

            {showDetails && (
              <div className="mt-4 space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold text-red-600 mb-2">Critical Security Issues:</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">✗</span>
                      <span>
                        <strong>No Encryption:</strong> Patient data stored in plain text in browser
                        localStorage
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">✗</span>
                      <span>
                        <strong>Weak Authentication:</strong> Simple password codes instead of
                        secure authentication
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">✗</span>
                      <span>
                        <strong>No Audit Logging:</strong> No tracking of who accesses patient data
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">✗</span>
                      <span>
                        <strong>No Session Management:</strong> No automatic logout or session
                        timeout
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">✗</span>
                      <span>
                        <strong>Public Hosting:</strong> Hosted on Vercel without Business Associate
                        Agreement
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold text-orange-600 mb-2">Administrative Issues:</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="text-orange-500 mr-2">✗</span>
                      <span>No Business Associate Agreements (BAAs) with third-party services</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-500 mr-2">✗</span>
                      <span>No documented security policies and procedures</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-500 mr-2">✗</span>
                      <span>No employee training program</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-500 mr-2">✗</span>
                      <span>No incident response plan</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-500 mr-2">✗</span>
                      <span>No risk assessment documentation</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Test Data Only Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              For Testing and Development Only
            </h3>
            <p className="text-blue-800">This system should only be used with:</p>
            <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
              <li>Synthetic test data</li>
              <li>Fictional patient information</li>
              <li>Demo scenarios</li>
              <li>Development and training purposes</li>
            </ul>
          </div>

          {/* Legal Disclaimer */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">Legal Disclaimer:</h4>
            <p className="text-xs text-gray-600">
              By using this system, you acknowledge that it is not HIPAA compliant and agree not to
              enter, store, or process any real Protected Health Information (PHI). The system
              owners and developers assume no liability for any HIPAA violations resulting from
              misuse of this system. You are solely responsible for ensuring compliance with all
              applicable healthcare privacy laws and regulations.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <a
              href="/HIPAA_COMPLIANCE_CHECKLIST.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View Compliance Checklist →
            </a>

            <div className="flex gap-4">
              <button
                onClick={() => (window.location.href = '/')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Exit System
              </button>
              <button
                onClick={handleAcknowledge}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                I Understand - Continue with Test Data Only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
