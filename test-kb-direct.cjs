/**
 * Test script to manually add a document to agent KB and verify it shows up
 */

const https = require('https');

const AGENT_ID = 'agent_6101kbk0qsmfefftpw6sf9k0wfyb';
const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;

if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not set!');
  console.error('Run: export ELEVENLABS_API_KEY="your_key_here"');
  console.error('Or get it from GitHub secrets');
  process.exit(1);
}

// Step 1: Create KB document
const testData = `
Patient: Rakesh Patel
A1C: 9.7%
Medications: Metformin 1000mg twice daily
Focus: Weight loss, sick day management
`;

const createDoc = () => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      name: 'Test Patient Data',
      text: testData
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/convai/knowledge-base/text',
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Create response:', res.statusCode);
        console.log('Body:', data);
        resolve(JSON.parse(data));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// Step 2: Link document to agent
const linkDoc = (docId) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      knowledge_base: [{
        type: 'text',
        id: docId,
        name: 'Test Patient Data',
        usage_mode: 'auto'
      }]
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/convai/agents/${AGENT_ID}`,
      method: 'PATCH',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\nLink response:', res.statusCode);
        console.log('Body:', data.substring(0, 500));
        resolve();
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// Run test
async function main() {
  try {
    console.log('Creating KB document...');
    const doc = await createDoc();
    console.log('\nDocument created:', doc.id);

    console.log('\nLinking to agent...');
    await linkDoc(doc.id);

    console.log('\n✅ Done! Check https://elevenlabs.io/app/conversational-ai');
    console.log('Document ID:', doc.id);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
