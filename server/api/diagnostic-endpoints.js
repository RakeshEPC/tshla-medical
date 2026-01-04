/**
 * Diagnostic Endpoints for Troubleshooting Twilio + OpenAI Integration
 *
 * Provides tools to verify each component independently:
 * - /healthz: Basic health check
 * - /ws-test: Instructions for testing WebSocket
 * - /twiml-test: View sample TwiML output
 */

const { generateGoldenTwiML } = require('./twilio/diabetes-education-inbound-v2');

/**
 * GET /healthz
 * Basic health check endpoint
 */
function healthz(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'tshla-diabetes-education',
    version: '2.0.0'
  });
}

/**
 * GET /ws-test
 * Instructions for testing WebSocket connection
 */
function wsTest(req, res) {
  const wsUrl = 'wss://api.tshla.ai/media-stream';

  // Check environment variables (presence only, not values)
  const envCheck = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    VITE_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    SAFE_MODE: process.env.SAFE_MODE || 'D'
  };

  res.status(200).json({
    message: 'WebSocket Test Instructions',
    websocket_url: wsUrl,
    environment_vars: envCheck,
    test_commands: {
      nodejs: `
const WebSocket = require('ws');
const ws = new WebSocket('${wsUrl}');
ws.on('open', () => console.log('Connected'));
ws.on('message', (data) => console.log('Message:', data.toString()));
ws.on('error', (err) => console.error('Error:', err.message));
      `,
      curl: `curl --http1.1 -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test123==" "${wsUrl}"`
    },
    expected_response: 'HTTP/1.1 101 Switching Protocols',
    troubleshooting: {
      'HTTP/2 200': 'WebSocket upgrade blocked - check ingress --allow-insecure setting',
      'Connection refused': 'WebSocket server not running or wrong path',
      'TLS error': 'Certificate issue on custom domain',
      'Immediate close': 'WebSocket server crashing on connect - check logs'
    }
  });
}

/**
 * GET /twiml-test
 * View sample TwiML that would be returned to Twilio
 */
function twimlTest(req, res) {
  const sampleTwiML = generateGoldenTwiML('test-token-12345678', 'en');

  res.type('text/xml');
  res.send(sampleTwiML);
}

/**
 * GET /twiml-test-json
 * View TwiML as JSON for inspection
 */
function twimlTestJson(req, res) {
  const sampleTwiML = generateGoldenTwiML('test-token-12345678', 'en');

  res.json({
    twiml: sampleTwiML,
    validation: {
      starts_with_xml_declaration: sampleTwiML.startsWith('<?xml'),
      contains_response_tag: sampleTwiML.includes('<Response>'),
      contains_stream_tag: sampleTwiML.includes('<Stream'),
      websocket_url: sampleTwiML.match(/url="([^"]+)"/)?.[1],
      has_query_params: sampleTwiML.includes('?'), // Should be FALSE
      parameters: sampleTwiML.match(/<Parameter name="([^"]+)"/g)
    },
    requirements: {
      content_type: 'text/xml',
      response_time: '< 500ms',
      no_query_params: true,
      wss_protocol: true,
      status_callback: true
    }
  });
}

module.exports = {
  healthz,
  wsTest,
  twimlTest,
  twimlTestJson
};
