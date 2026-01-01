/**
 * ElevenLabs Knowledge Base Service
 * Manages patient data documents in ElevenLabs Knowledge Base
 * for dynamic AI conversations
 *
 * Created: 2026-01-01
 */

const https = require('https');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || '';
const ELEVENLABS_KB_ID = process.env.ELEVENLABS_KB_ID || '';

if (!ELEVENLABS_API_KEY) {
  console.warn('⚠️  [KB Service] ELEVENLABS_API_KEY not configured');
}

if (!ELEVENLABS_KB_ID) {
  console.warn('⚠️  [KB Service] ELEVENLABS_KB_ID not configured - Knowledge Base features disabled');
}

/**
 * Generate unique document ID for patient
 * Format: patient_{phone_number_without_plus}_{timestamp}
 * Example: patient_18326073630_1704153600000
 */
function formatDocumentId(phoneNumber, callSid = null) {
  const cleanPhone = phoneNumber.replace(/\+/g, '').replace(/[^0-9]/g, '');

  if (callSid) {
    // Include CallSid for uniqueness in case of concurrent calls
    return `patient_${cleanPhone}_${callSid}`;
  }

  // Fallback: use timestamp
  const timestamp = Date.now();
  return `patient_${cleanPhone}_${timestamp}`;
}

/**
 * Upload patient context to Knowledge Base
 * This makes patient data available to the AI during the call
 *
 * @param {Object} patient - Patient record from database
 * @param {string} patient.phone_number - E.164 format phone number
 * @param {string} patient.first_name - Patient first name
 * @param {string} patient.last_name - Patient last name
 * @param {string} patient.clinical_notes - Clinical notes text
 * @param {Array} patient.focus_areas - Focus areas array
 * @param {Object} patient.medical_data - Structured medical data
 * @param {string} callSid - Twilio Call SID for uniqueness
 * @returns {Promise<string>} - Document ID if successful
 */
async function uploadPatientToKB(patient, patientContext, callSid = null) {
  if (!ELEVENLABS_KB_ID) {
    console.warn('[KB Service] ⚠️  Knowledge Base ID not configured - skipping upload');
    return null;
  }

  if (!ELEVENLABS_API_KEY) {
    console.error('[KB Service] ❌ API key not configured');
    throw new Error('ElevenLabs API key not configured');
  }

  const docId = formatDocumentId(patient.phone_number, callSid);
  const title = `${patient.first_name} ${patient.last_name} - Medical Data`;

  console.log('[KB Service] 📤 Uploading patient data to Knowledge Base');
  console.log(`   Document ID: ${docId}`);
  console.log(`   Patient: ${patient.first_name} ${patient.last_name}`);
  console.log(`   Context length: ${patientContext.length} characters`);

  const requestBody = {
    document_id: docId,
    title: title,
    content: patientContext,
    metadata: {
      phone_number: patient.phone_number,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      uploaded_at: new Date().toISOString(),
      call_sid: callSid || 'unknown'
    }
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/knowledge-bases/${ELEVENLABS_KB_ID}/documents`,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000 // 10 second timeout
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`[KB Service] 📥 Upload response status: ${res.statusCode}`);

        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('[KB Service] ✅ Patient data uploaded successfully');
          console.log(`   Response: ${data.substring(0, 200)}`);
          resolve(docId);
        } else {
          console.error(`[KB Service] ❌ Upload failed with status ${res.statusCode}`);
          console.error(`   Response: ${data}`);
          reject(new Error(`KB upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[KB Service] ❌ Request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[KB Service] ❌ Request timeout');
      reject(new Error('KB upload timeout'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Delete patient document from Knowledge Base
 * Called when call ends to clean up patient data
 *
 * @param {string} documentId - Document ID to delete
 * @returns {Promise<boolean>} - True if successful
 */
async function deletePatientFromKB(documentId) {
  if (!ELEVENLABS_KB_ID) {
    console.warn('[KB Service] ⚠️  Knowledge Base ID not configured - skipping delete');
    return false;
  }

  if (!ELEVENLABS_API_KEY) {
    console.error('[KB Service] ❌ API key not configured');
    return false;
  }

  console.log('[KB Service] 🗑️  Deleting patient data from Knowledge Base');
  console.log(`   Document ID: ${documentId}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/knowledge-bases/${ELEVENLABS_KB_ID}/documents/${documentId}`,
      method: 'DELETE',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`[KB Service] 📥 Delete response status: ${res.statusCode}`);

        if (res.statusCode === 200 || res.statusCode === 204 || res.statusCode === 404) {
          // 404 is OK - document already deleted or doesn't exist
          console.log('[KB Service] ✅ Patient data deleted successfully');
          resolve(true);
        } else {
          console.error(`[KB Service] ❌ Delete failed with status ${res.statusCode}`);
          console.error(`   Response: ${data}`);
          resolve(false); // Don't throw - cleanup is best-effort
        }
      });
    });

    req.on('error', (error) => {
      console.error('[KB Service] ❌ Delete request error:', error.message);
      resolve(false); // Don't throw - cleanup is best-effort
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[KB Service] ❌ Delete request timeout');
      resolve(false);
    });

    req.end();
  });
}

/**
 * List all documents in Knowledge Base (for debugging/cleanup)
 * @returns {Promise<Array>} - Array of document objects
 */
async function listKBDocuments() {
  if (!ELEVENLABS_KB_ID || !ELEVENLABS_API_KEY) {
    console.error('[KB Service] ❌ KB not configured');
    return [];
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/knowledge-bases/${ELEVENLABS_KB_ID}/documents`,
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.documents || parsed || []);
          } catch (e) {
            console.error('[KB Service] ❌ Failed to parse list response');
            resolve([]);
          }
        } else {
          console.error(`[KB Service] ❌ List failed: ${res.statusCode}`);
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      console.error('[KB Service] ❌ List request error:', error.message);
      resolve([]);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}

/**
 * Cleanup old documents (documents older than 24 hours)
 * This is a safety mechanism for orphaned documents
 * @returns {Promise<number>} - Number of documents deleted
 */
async function cleanupOldDocuments() {
  console.log('[KB Service] 🧹 Starting cleanup of old documents');

  try {
    const documents = await listKBDocuments();
    console.log(`[KB Service] Found ${documents.length} documents in KB`);

    if (documents.length === 0) {
      return 0;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let deletedCount = 0;

    for (const doc of documents) {
      // Check if document has uploaded_at metadata
      const uploadedAt = doc.metadata?.uploaded_at;

      if (uploadedAt) {
        const uploadDate = new Date(uploadedAt);

        if (uploadDate < oneDayAgo) {
          console.log(`[KB Service] Deleting old document: ${doc.document_id} (uploaded ${uploadedAt})`);
          const deleted = await deletePatientFromKB(doc.document_id);
          if (deleted) deletedCount++;
        }
      } else {
        // If no metadata, assume it's old and delete it
        console.log(`[KB Service] Deleting document without metadata: ${doc.document_id}`);
        const deleted = await deletePatientFromKB(doc.document_id);
        if (deleted) deletedCount++;
      }
    }

    console.log(`[KB Service] ✅ Cleanup complete - deleted ${deletedCount} documents`);
    return deletedCount;

  } catch (error) {
    console.error('[KB Service] ❌ Cleanup error:', error);
    return 0;
  }
}

module.exports = {
  uploadPatientToKB,
  deletePatientFromKB,
  listKBDocuments,
  cleanupOldDocuments,
  formatDocumentId
};
