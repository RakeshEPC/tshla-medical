/**
 * ElevenLabs Knowledge Base Service
 * Manages patient data documents in ElevenLabs Knowledge Base
 * for dynamic AI conversations
 *
 * Created: 2026-01-01
 */

const https = require('https');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || '';

if (!ELEVENLABS_API_KEY) {
  console.warn('⚠️  [KB Service] ELEVENLABS_API_KEY not configured');
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
    name: title,
    text: patientContext
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: '/v1/convai/knowledge-base/text',
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

          // Parse response to get document ID
          try {
            const response = JSON.parse(data);
            const actualDocId = response.id || response.document_id || docId;
            console.log(`   Document ID: ${actualDocId}`);
            resolve(actualDocId);
          } catch (e) {
            console.warn('[KB Service] ⚠️  Could not parse document ID from response, using generated ID');
            resolve(docId);
          }
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
      path: `/v1/convai/knowledge-base/${documentId}`,
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
  if (!ELEVENLABS_API_KEY) {
    console.error('[KB Service] ❌ API key not configured');
    return [];
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: '/v1/convai/knowledge-base',
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
 * Link KB document to agent
 * This makes the document searchable by the agent during conversations
 *
 * @param {string} agentId - ElevenLabs agent ID
 * @param {string} documentId - KB document ID to link
 * @returns {Promise<boolean>} - True if successful
 */
async function linkDocumentToAgent(agentId, documentId) {
  if (!ELEVENLABS_API_KEY) {
    console.error('[KB Service] ❌ API key not configured');
    return false;
  }

  console.log('[KB Service] 🔗 Linking KB document to agent');
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Document ID: ${documentId}`);

  return new Promise((resolve) => {
    // First, get current agent config to preserve existing knowledge_base docs
    const getOptions = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/convai/agents/${agentId}`,
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      },
      timeout: 10000
    };

    const getReq = https.request(getOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[KB Service] ❌ Failed to get agent config: ${res.statusCode}`);
          console.error(`   Response: ${data}`);
          resolve(false);
          return;
        }

        try {
          const agentConfig = JSON.parse(data);

          // Get existing KB documents (top-level knowledge_base array per API docs)
          const existingKB = agentConfig.knowledge_base || [];

          // Add new document in the CORRECT format per API docs
          const newDoc = {
            type: "text",
            id: documentId,
            name: "Patient Medical Data",
            usage_mode: "auto"  // RAG mode - retrieves relevant portions
          };

          const updatedKB = [...existingKB, newDoc];

          console.log(`   Existing KB docs: ${existingKB.length}`);
          console.log(`   Adding new document: ${documentId}`);

          // Use top-level knowledge_base parameter (correct API structure)
          const updateBody = {
            knowledge_base: updatedKB
          };

          console.log(`[KB Service] 🔧 Update body: ${JSON.stringify(updateBody, null, 2)}`);

          const postData = JSON.stringify(updateBody);

          const patchOptions = {
            hostname: 'api.elevenlabs.io',
            port: 443,
            path: `/v1/convai/agents/${agentId}`,
            method: 'PATCH',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
          };

          const patchReq = https.request(patchOptions, (patchRes) => {
            let patchData = '';

            patchRes.on('data', (chunk) => {
              patchData += chunk;
            });

            patchRes.on('end', () => {
              console.log(`[KB Service] PATCH response status: ${patchRes.statusCode}`);
              console.log(`[KB Service] PATCH response body: ${patchData.substring(0, 500)}`);

              if (patchRes.statusCode === 200 || patchRes.statusCode === 204) {
                console.log('[KB Service] ✅ Document linked to agent successfully');
                console.log(`[KB Service] Final agent KB config: ${JSON.stringify(updatedKB)}`);
                resolve(true);
              } else {
                console.error(`[KB Service] ❌ Failed to link document: ${patchRes.statusCode}`);
                console.error(`   Response: ${patchData}`);
                resolve(false);
              }
            });
          });

          patchReq.on('error', (error) => {
            console.error('[KB Service] ❌ PATCH request error:', error.message);
            resolve(false);
          });

          patchReq.on('timeout', () => {
            patchReq.destroy();
            console.error('[KB Service] ❌ PATCH request timeout');
            resolve(false);
          });

          patchReq.write(postData);
          patchReq.end();

        } catch (e) {
          console.error('[KB Service] ❌ Failed to parse agent config:', e);
          resolve(false);
        }
      });
    });

    getReq.on('error', (error) => {
      console.error('[KB Service] ❌ GET request error:', error.message);
      resolve(false);
    });

    getReq.on('timeout', () => {
      getReq.destroy();
      console.error('[KB Service] ❌ GET request timeout');
      resolve(false);
    });

    getReq.end();
  });
}

/**
 * Unlink KB document from agent
 * Called before deleting a document
 *
 * @param {string} agentId - ElevenLabs agent ID
 * @param {string} documentId - KB document ID to unlink
 * @returns {Promise<boolean>} - True if successful
 */
async function unlinkDocumentFromAgent(agentId, documentId) {
  if (!ELEVENLABS_API_KEY) {
    console.error('[KB Service] ❌ API key not configured');
    return false;
  }

  console.log('[KB Service] 🔓 Unlinking KB document from agent');
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Document ID: ${documentId}`);

  return new Promise((resolve) => {
    // Get current agent config
    const getOptions = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/convai/agents/${agentId}`,
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      },
      timeout: 10000
    };

    const getReq = https.request(getOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[KB Service] ❌ Failed to get agent config: ${res.statusCode}`);
          resolve(false);
          return;
        }

        try {
          const agentConfig = JSON.parse(data);

          // Get existing KB documents (top-level knowledge_base array)
          const existingKB = agentConfig.knowledge_base || [];

          // Remove document from knowledge_base array
          const updatedKB = existingKB.filter(doc => doc.id !== documentId);

          console.log(`   Before: ${existingKB.length} KB docs`);
          console.log(`   After: ${updatedKB.length} KB docs`);

          // Update agent with filtered knowledge_base (top-level parameter)
          const updateBody = {
            knowledge_base: updatedKB
          };

          const postData = JSON.stringify(updateBody);

          const patchOptions = {
            hostname: 'api.elevenlabs.io',
            port: 443,
            path: `/v1/convai/agents/${agentId}`,
            method: 'PATCH',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
          };

          const patchReq = https.request(patchOptions, (patchRes) => {
            let patchData = '';

            patchRes.on('data', (chunk) => {
              patchData += chunk;
            });

            patchRes.on('end', () => {
              if (patchRes.statusCode === 200 || patchRes.statusCode === 204) {
                console.log('[KB Service] ✅ Document unlinked from agent successfully');
                resolve(true);
              } else {
                console.error(`[KB Service] ❌ Failed to unlink document: ${patchRes.statusCode}`);
                console.error(`   Response: ${patchData}`);
                resolve(false);
              }
            });
          });

          patchReq.on('error', (error) => {
            console.error('[KB Service] ❌ PATCH request error:', error.message);
            resolve(false);
          });

          patchReq.on('timeout', () => {
            patchReq.destroy();
            console.error('[KB Service] ❌ PATCH request timeout');
            resolve(false);
          });

          patchReq.write(postData);
          patchReq.end();

        } catch (e) {
          console.error('[KB Service] ❌ Failed to parse agent config:', e);
          resolve(false);
        }
      });
    });

    getReq.on('error', (error) => {
      console.error('[KB Service] ❌ GET request error:', error.message);
      resolve(false);
    });

    getReq.on('timeout', () => {
      getReq.destroy();
      console.error('[KB Service] ❌ GET request timeout');
      resolve(false);
    });

    getReq.end();
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
  linkDocumentToAgent,
  unlinkDocumentFromAgent,
  listKBDocuments,
  cleanupOldDocuments,
  formatDocumentId
};
