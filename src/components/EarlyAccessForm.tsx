import React, { useState } from 'react';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface FormData {
  name: string;
  email: string;
  title: string;
  specialty: string;
  applications: {
    pumpDrive: boolean;
    dictationScribe: boolean;
    diabetesEducation: boolean;
    other: boolean;
    otherText: string;
  };
  whyInterested: string;
}

interface EarlyAccessFormProps {
  onClose?: () => void;
}

const EarlyAccessForm: React.FC<EarlyAccessFormProps> = ({ onClose }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    title: '',
    specialty: '',
    applications: {
      pumpDrive: false,
      dictationScribe: false,
      diabetesEducation: false,
      other: false,
      otherText: '',
    },
    whyInterested: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate at least one application is selected
    const { pumpDrive, dictationScribe, diabetesEducation, other } = formData.applications;
    if (!pumpDrive && !dictationScribe && !diabetesEducation && !other) {
      setError('Please select at least one application you are interested in.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Format applications for submission
      const selectedApplications = [];
      if (formData.applications.pumpDrive)
        selectedApplications.push('PumpDrive - Insulin Pump Selection Tool');
      if (formData.applications.dictationScribe)
        selectedApplications.push('Dictation/Scribe - Medical Documentation Assistant');
      if (formData.applications.diabetesEducation)
        selectedApplications.push('Diabetes Education - Patient Education Resources');
      if (formData.applications.other && formData.applications.otherText) {
        selectedApplications.push(`Other: ${formData.applications.otherText}`);
      }

      const submissionData = {
        name: formData.name,
        email: formData.email,
        title: formData.title,
        specialty: formData.specialty || 'Not specified',
        applications: selectedApplications.join(', '),
        whyInterested: formData.whyInterested,
        submittedAt: new Date().toISOString(),
        source: 'Facebook Landing Page',
      };

      // For now, store in localStorage as backup and show success
      // (Production backend API not yet deployed)
      // Get API URL from environment
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.tshla.ai';

      try {
        // Submit to backend API
        const response = await fetch(`${apiUrl}/api/early-access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        });

        if (!response.ok) {
          throw new Error('Backend not available');
        }

        const result = await response.json();
        logDebug('EarlyAccessForm', 'Debug message', {});

        // Also save to localStorage as backup
        const existingApplications = JSON.parse(
          localStorage.getItem('earlyAccessApplications') || '[]'
        );
        existingApplications.push(submissionData);
        localStorage.setItem('earlyAccessApplications', JSON.stringify(existingApplications));
      } catch (err) {
        logError('EarlyAccessForm', 'Error message', {});
        // Fallback to localStorage only
        const existingApplications = JSON.parse(
          localStorage.getItem('earlyAccessApplications') || '[]'
        );
        existingApplications.push(submissionData);
        localStorage.setItem('earlyAccessApplications', JSON.stringify(existingApplications));

        // Send email notification using Formspree (easier setup)
        try {
          // Formspree endpoint - you need to create an account at formspree.io
          // and get your form endpoint (it's free for 50 submissions/month)
          const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'; // Replace with your Formspree form ID

          const emailData = {
            _replyto: submissionData.email,
            _subject: `New Early Access Application: ${submissionData.name}`,
            name: submissionData.name,
            email: submissionData.email,
            title: submissionData.title,
            specialty: submissionData.specialty,
            applications: submissionData.applications,
            whyInterested: submissionData.whyInterested,
            submittedAt: new Date(submissionData.submittedAt).toLocaleString(),
            _template: 'table', // Uses a nice table format
          };

          // Send to Formspree which will forward to rakesh@tshla.ai
          const emailResponse = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData),
          });

          if (!emailResponse.ok) {
            logError('EarlyAccessForm', 'Error message', {});
          }
        } catch (emailError) {
          logError('EarlyAccessForm', 'Error message', {});
          // Don't fail the whole submission if email fails
        }

        logDebug('EarlyAccessForm', 'Debug message', {});
      }

      // Show success message
      setShowSuccess(true);

      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          title: '',
          specialty: '',
          applications: {
            pumpDrive: false,
            dictationScribe: false,
            diabetesEducation: false,
            other: false,
            otherText: '',
          },
          whyInterested: '',
        });
        setShowSuccess(false);
        if (onClose) onClose();
      }, 3000);
    } catch (err) {
      logError('EarlyAccessForm', 'Error message', {});
      setError('Failed to submit form. Please try again or email us at hello@tshla.ai');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h2>
          <p className="text-gray-700 mb-4">
            Welcome to the TSHLA early adopter community! We'll review your application and reach
            out within 24-48 hours.
          </p>
          <p className="text-sm text-gray-500">Check your email for next steps.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Apply for Early Access</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        <p className="text-gray-600 mb-6">
          Join our exclusive group of early adopters and help shape the future of medical
          technology.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter your full name"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="e.g., Endocrinologist, Patient, Diabetes Educator"
            />
          </div>

          {/* Specialty */}
          <div>
            <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
              Specialty (if applicable)
            </label>
            <input
              type="text"
              id="specialty"
              value={formData.specialty}
              onChange={e => setFormData({ ...formData, specialty: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="e.g., Endocrinology, Internal Medicine, Pediatrics"
            />
          </div>

          {/* Applications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Which applications are you interested in? (Check all that apply) *
            </label>
            <div className="space-y-2">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.applications.pumpDrive}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      applications: { ...formData.applications, pumpDrive: e.target.checked },
                    })
                  }
                  className="mt-1 mr-3 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">
                  <strong>PumpDrive</strong> - Insulin Pump Selection Tool
                </span>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.applications.dictationScribe}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      applications: { ...formData.applications, dictationScribe: e.target.checked },
                    })
                  }
                  className="mt-1 mr-3 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">
                  <strong>Dictation/Scribe</strong> - Medical Documentation Assistant
                </span>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.applications.diabetesEducation}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      applications: {
                        ...formData.applications,
                        diabetesEducation: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 mr-3 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">
                  <strong>Diabetes Education</strong> - Patient Education Resources
                </span>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.applications.other}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      applications: { ...formData.applications, other: e.target.checked },
                    })
                  }
                  className="mt-1 mr-3 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Other (please specify)</span>
              </label>

              {formData.applications.other && (
                <input
                  type="text"
                  value={formData.applications.otherText}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      applications: { ...formData.applications, otherText: e.target.value },
                    })
                  }
                  className="ml-7 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Please specify other applications you're interested in"
                />
              )}
            </div>
          </div>

          {/* Why Interested */}
          <div>
            <label htmlFor="whyInterested" className="block text-sm font-medium text-gray-700 mb-1">
              Why are you interested in becoming an early adopter? *
            </label>
            <textarea
              id="whyInterested"
              required
              rows={4}
              value={formData.whyInterested}
              onChange={e => setFormData({ ...formData, whyInterested: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Tell us what problems you hope these tools will solve, how they could help your practice or patients, and what excites you about being part of our early adopter community."
            />
          </div>

          {/* Error Message */}
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-colors ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center pt-2">
            By submitting, you agree to receive updates about TSHLA products and services.
          </p>
        </form>
      </div>
    </div>
  );
};

export default EarlyAccessForm;
