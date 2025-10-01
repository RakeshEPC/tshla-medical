import React, { useState } from 'react';
import {
  noteSharingService,
  type ShareRequest,
  type ShareableNote,
} from '../services/noteSharing.service';
import './NoteSharing.css';

interface NoteSharingProps {
  note: ShareableNote;
  onClose: () => void;
  onShareComplete?: (shareLink: string) => void;
}

export const NoteSharing: React.FC<NoteSharingProps> = ({ note, onClose, onShareComplete }) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientType, setRecipientType] = useState<ShareRequest['recipientType']>('physician');
  const [shareMethod, setShareMethod] = useState<ShareRequest['shareMethod']>('email');
  const [message, setMessage] = useState('');
  const [expirationHours, setExpirationHours] = useState(72);
  const [permissions, setPermissions] = useState({
    canView: true,
    canDownload: false,
    canForward: false,
  });
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async () => {
    // Validate inputs
    if (!recipientEmail || !recipientName) {
      setError('Please provide recipient email and name');
      return;
    }

    if (!validateEmail(recipientEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSharing(true);
    setError('');

    try {
      const shareRequest: ShareRequest = {
        noteId: note.id,
        recipientEmail,
        recipientName,
        recipientType,
        shareMethod,
        message,
        expirationHours,
        requireAuth: recipientType === 'patient',
        permissions,
      };

      const shareRecord = await noteSharingService.shareNote(note, shareRequest);
      const link = await noteSharingService.generateShareLink(shareRecord);

      setShareLink(link);
      setShowSuccess(true);

      if (onShareComplete) {
        onShareComplete(link);
      }

      // Reset form after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to share note');
    } finally {
      setIsSharing(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Link copied to clipboard!');
  };

  if (showSuccess) {
    return (
      <div className="note-sharing-modal">
        <div className="sharing-content success">
          <div className="success-icon">✅</div>
          <h2>Note Shared Successfully!</h2>
          <p>The medical note has been securely shared with {recipientName}</p>

          <div className="share-link-display">
            <input type="text" value={shareLink} readOnly className="share-link-input" />
            <button onClick={copyLink} className="copy-btn">
              📋 Copy Link
            </button>
          </div>

          <p className="expires-text">Link expires in {expirationHours} hours</p>

          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="note-sharing-modal">
      <div className="sharing-content">
        <div className="sharing-header">
          <h2>🔒 Share Medical Note</h2>
          <button onClick={onClose} className="close-x">
            ×
          </button>
        </div>

        <div className="note-preview">
          <div className="preview-header">
            <strong>Patient:</strong> {note.patientName} |<strong> MRN:</strong> {note.patientMRN}
          </div>
          <div className="preview-meta">
            Note Type: {note.noteType} | Created: {new Date(note.createdAt).toLocaleDateString()}
          </div>
        </div>

        {error && <div className="error-message">⚠️ {error}</div>}

        <div className="sharing-form">
          <div className="form-section">
            <h3>Recipient Information</h3>

            <div className="form-row">
              <label>
                Recipient Email *
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="doctor@hospital.com"
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Recipient Name *
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Recipient Type
                <select
                  value={recipientType}
                  onChange={e => setRecipientType(e.target.value as ShareRequest['recipientType'])}
                >
                  <option value="physician">Physician</option>
                  <option value="specialist">Specialist</option>
                  <option value="hospital">Hospital</option>
                  <option value="patient">Patient</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Sharing Options</h3>

            <div className="form-row">
              <label>
                Share Method
                <select
                  value={shareMethod}
                  onChange={e => setShareMethod(e.target.value as ShareRequest['shareMethod'])}
                >
                  <option value="email">Secure Email</option>
                  <option value="secure-link">Generate Link Only</option>
                  <option value="fax" disabled>
                    Secure Fax (Coming Soon)
                  </option>
                  <option value="direct-message" disabled>
                    Direct Message (Coming Soon)
                  </option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Link Expiration
                <select
                  value={expirationHours}
                  onChange={e => setExpirationHours(Number(e.target.value))}
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours (default)</option>
                  <option value={168}>1 week</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Custom Message (Optional)
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Add a message for the recipient..."
                  rows={3}
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Permissions</h3>

            <div className="permissions-grid">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.canView}
                  disabled // Always true
                />
                Can View
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.canDownload}
                  onChange={e =>
                    setPermissions({
                      ...permissions,
                      canDownload: e.target.checked,
                    })
                  }
                />
                Can Download
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.canForward}
                  onChange={e =>
                    setPermissions({
                      ...permissions,
                      canForward: e.target.checked,
                    })
                  }
                />
                Can Forward
              </label>
            </div>
          </div>

          <div className="hipaa-notice">
            <strong>🔒 HIPAA Notice:</strong> This note contains Protected Health Information (PHI).
            All sharing is logged and audited for compliance. Only share with authorized
            individuals.
          </div>

          <div className="action-buttons">
            <button onClick={onClose} className="cancel-btn" disabled={isSharing}>
              Cancel
            </button>
            <button onClick={handleShare} className="share-btn" disabled={isSharing}>
              {isSharing ? 'Sharing...' : '🔒 Share Securely'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
