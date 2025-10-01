import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { noteSharingService, type ShareableNote } from '../services/noteSharing.service';
import './SharedNote.css';

export default function SharedNote() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<ShareableNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      loadSharedNote(token);
    }
  }, [token]);

  const loadSharedNote = async (shareToken: string) => {
    try {
      setLoading(true);
      const sharedNote = await noteSharingService.getSharedNote(shareToken);

      if (sharedNote) {
        setNote(sharedNote);
      } else {
        setError('This note has expired or is no longer available.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shared note');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!note) return;

    setDownloading(true);

    // Create a blob with the note content
    const noteText = `
MEDICAL NOTE
============================================
Patient: ${note.patientName}
MRN: ${note.patientMRN}
Date: ${new Date(note.createdAt).toLocaleString()}
Type: ${note.noteType}
Created By: ${note.createdBy}
============================================

${note.noteContent}

============================================
This document contains Protected Health Information (PHI)
Shared via TSHLA Medical - HIPAA Compliant Platform
`;

    const blob = new Blob([noteText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical_note_${note.patientMRN}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    setDownloading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="shared-note-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading secure note...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-note-container">
        <div className="error-state">
          <div className="error-icon">🔒</div>
          <h2>Access Denied</h2>
          <p>{error}</p>
          <div className="error-details">
            <p>Possible reasons:</p>
            <ul>
              <li>The link has expired</li>
              <li>The note has been revoked</li>
              <li>Invalid access token</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="shared-note-container">
        <div className="error-state">
          <p>No note found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-note-container">
      <div className="shared-note-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>🏥 TSHLA Medical</h1>
            <span className="secure-badge">🔒 Secure Document</span>
          </div>
          <div className="actions">
            <button onClick={handlePrint} className="action-btn print-btn">
              🖨️ Print
            </button>
            <button
              onClick={handleDownload}
              className="action-btn download-btn"
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : '📥 Download'}
            </button>
          </div>
        </div>
      </div>

      <div className="hipaa-banner">
        <strong>⚠️ HIPAA Notice:</strong> This document contains Protected Health Information (PHI).
        Access is being logged for compliance. Do not share without proper authorization.
      </div>

      <div className="shared-note-content">
        <div className="note-metadata">
          <h2>Medical Note</h2>
          <div className="metadata-grid">
            <div className="metadata-item">
              <label>Patient Name:</label>
              <span>{note.patientName}</span>
            </div>
            <div className="metadata-item">
              <label>MRN:</label>
              <span>{note.patientMRN}</span>
            </div>
            <div className="metadata-item">
              <label>Note Type:</label>
              <span className="note-type-badge">{note.noteType}</span>
            </div>
            <div className="metadata-item">
              <label>Created:</label>
              <span>{new Date(note.createdAt).toLocaleString()}</span>
            </div>
            <div className="metadata-item">
              <label>Created By:</label>
              <span>{note.createdBy}</span>
            </div>
            {note.metadata?.specialty && (
              <div className="metadata-item">
                <label>Specialty:</label>
                <span>{note.metadata.specialty}</span>
              </div>
            )}
          </div>
        </div>

        <div className="note-body">
          <pre className="note-text">{note.noteContent}</pre>
        </div>

        <div className="note-footer">
          <p className="footer-text">
            This medical note was shared securely through TSHLA Medical's HIPAA-compliant platform.
            All access to this document is logged and audited for compliance purposes.
          </p>
          <p className="footer-timestamp">Document accessed: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="security-footer">
        <div className="security-info">
          <span>🔐 End-to-end encrypted</span>
          <span>📝 Audit logged</span>
          <span>✅ HIPAA compliant</span>
          <span>⏱️ Time-limited access</span>
        </div>
      </div>
    </div>
  );
}
