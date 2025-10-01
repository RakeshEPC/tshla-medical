import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './PumpDriveProviderSent.css';

interface LocationState {
  patientName: string;
  providerName: string;
  providerEmail: string;
  sentAt: string;
  testMode?: boolean;
}

export default function PumpDriveProviderSent() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  if (!state) {
    // Redirect if no state data
    navigate('/pumpdrive');
    return null;
  }

  const { patientName, providerName, providerEmail, sentAt, testMode } = state;
  const sentDate = new Date(sentAt).toLocaleDateString();
  const sentTime = new Date(sentAt).toLocaleTimeString();

  return (
    <div className="provider-sent-page">
      <div className="container">
        {/* Test Mode Banner */}
        {testMode && (
          <div
            style={{
              background: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              padding: '12px',
              margin: '0 0 20px 0',
              textAlign: 'center',
            }}
          >
            <strong>🧪 TEST MODE</strong> - This was a simulated delivery for testing purposes
          </div>
        )}

        {/* Success Header */}
        <div className="success-header">
          <div className="success-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#10b981" />
              <path
                d="m9 12 2 2 4-4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1>✅ Report Sent Successfully!</h1>
          <p className="success-subtitle">
            Your pump recommendation report has been securely delivered to your provider
          </p>
        </div>

        {/* Delivery Details */}
        <div className="delivery-details">
          <h2>Delivery Confirmation</h2>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Patient:</label>
              <span>{patientName}</span>
            </div>

            <div className="detail-item">
              <label>Sent to:</label>
              <span>{providerName}</span>
            </div>

            <div className="detail-item">
              <label>Provider Email:</label>
              <span>{providerEmail}</span>
            </div>

            <div className="detail-item">
              <label>Sent on:</label>
              <span>
                {sentDate} at {sentTime}
              </span>
            </div>
          </div>

          <div className="security-note">
            <div className="security-icon">🔒</div>
            <div>
              <strong>HIPAA Secure Delivery:</strong> Your report was sent via encrypted email and
              will be available to your provider for 30 days.
            </div>
          </div>

          {/* Quick Access to Report */}
          <div
            className="quick-access"
            style={{
              background: '#f8fafc',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              marginTop: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>Want to see your report?</h3>
            <p style={{ margin: '0 0 15px 0', color: '#64748b' }}>
              View the same detailed analysis that was sent to your provider
            </p>
            <button
              onClick={() => navigate('/pumpdrive/results?sent=true')}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              📄 View Your Report Now
            </button>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="next-steps">
          <h2>What Happens Next?</h2>

          <div className="steps-list">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Provider Receives Report</h3>
                <p>
                  Your healthcare provider will receive the report via secure email within minutes
                </p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Schedule Consultation</h3>
                <p>
                  Contact your provider to schedule a consultation to discuss the recommendations
                </p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Review Together</h3>
                <p>
                  Work with your provider to finalize your pump choice and begin the approval
                  process
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Report Contents */}
        <div className="report-contents">
          <h2>Your Report Includes:</h2>

          <div className="contents-grid">
            <div className="content-item">
              <span className="icon">🎯</span>
              <h3>Personalized Matching</h3>
              <p>AI analysis of your priorities across 23 pump dimensions</p>
            </div>

            <div className="content-item">
              <span className="icon">📊</span>
              <h3>Detailed Comparison</h3>
              <p>Side-by-side comparison of top pump recommendations</p>
            </div>

            <div className="content-item">
              <span className="icon">💡</span>
              <h3>Clear Reasoning</h3>
              <p>Specific reasons why each pump matches your needs</p>
            </div>

            <div className="content-item">
              <span className="icon">📋</span>
              <h3>Next Steps Guide</h3>
              <p>Insurance information and actionable recommendations</p>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="contact-section">
          <h2>Need Help?</h2>
          <p>
            If you have questions about your report or need assistance, contact us at{' '}
            <strong>support@tshla.ai</strong> or call <strong>(555) 123-4567</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            onClick={() => navigate('/pumpdrive/results?sent=true')}
            className="btn-primary"
            style={{ backgroundColor: '#2563eb', marginRight: '10px' }}
          >
            📄 View Your Report
          </button>

          <button onClick={() => navigate('/pumpdrive')} className="btn-secondary">
            Take Assessment Again
          </button>

          <button onClick={() => navigate('/')} className="btn-secondary">
            Return to Home
          </button>
        </div>

        {/* Footer Note */}
        <div className="footer-note">
          <p>
            <strong>Important:</strong> Your provider has 30 days to access this report. You can
            view your report anytime using the "View Your Report" button above. If you need help or
            have questions, please contact us.
          </p>
        </div>
      </div>
    </div>
  );
}
