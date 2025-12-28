/**
 * Twilio Diagnostic Script
 * Provides detailed authentication debugging information
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║           TWILIO DIAGNOSTIC SCRIPT                                ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');

console.log('🔍 Credential Analysis:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Check Account SID format
console.log('1. Account SID Check:');
console.log(`   Value: ${TWILIO_ACCOUNT_SID}`);
console.log(`   Length: ${TWILIO_ACCOUNT_SID?.length || 0} characters`);
console.log(`   Starts with 'AC': ${TWILIO_ACCOUNT_SID?.startsWith('AC') ? '✅' : '❌'}`);
console.log(`   Expected length: 34 characters`);
console.log(`   Actual matches expected: ${TWILIO_ACCOUNT_SID?.length === 34 ? '✅' : '❌'}`);
console.log('');

// Check Auth Token format
console.log('2. Auth Token Check:');
console.log(`   Value: ${TWILIO_AUTH_TOKEN}`);
console.log(`   Length: ${TWILIO_AUTH_TOKEN?.length || 0} characters`);
console.log(`   Expected length: 32 characters`);
console.log(`   Actual matches expected: ${TWILIO_AUTH_TOKEN?.length === 32 ? '✅' : '❌'}`);
console.log(`   Contains only hex characters: ${/^[a-f0-9]+$/.test(TWILIO_AUTH_TOKEN || '') ? '✅' : '❌'}`);
console.log('');

// Check for common issues
console.log('3. Common Issues Check:');
const issues = [];

if (!TWILIO_ACCOUNT_SID) {
  issues.push('Account SID is not set');
} else if (!TWILIO_ACCOUNT_SID.startsWith('AC')) {
  issues.push('Account SID should start with "AC"');
} else if (TWILIO_ACCOUNT_SID.length !== 34) {
  issues.push(`Account SID should be 34 characters (found ${TWILIO_ACCOUNT_SID.length})`);
}

if (!TWILIO_AUTH_TOKEN) {
  issues.push('Auth Token is not set');
} else if (TWILIO_AUTH_TOKEN.length !== 32) {
  issues.push(`Auth Token should be 32 characters (found ${TWILIO_AUTH_TOKEN.length})`);
} else if (!/^[a-f0-9]+$/.test(TWILIO_AUTH_TOKEN)) {
  issues.push('Auth Token contains invalid characters (should be hex: 0-9, a-f)');
}

// Check for whitespace or hidden characters
if (TWILIO_ACCOUNT_SID?.trim() !== TWILIO_ACCOUNT_SID) {
  issues.push('Account SID has leading/trailing whitespace');
}

if (TWILIO_AUTH_TOKEN?.trim() !== TWILIO_AUTH_TOKEN) {
  issues.push('Auth Token has leading/trailing whitespace');
}

if (issues.length > 0) {
  console.log('   ⚠️  Issues found:');
  issues.forEach(issue => console.log(`      - ${issue}`));
} else {
  console.log('   ✅ No format issues detected');
}
console.log('');

// Test API connection with raw HTTP
console.log('4. Raw API Connection Test:');
console.log('   Testing Twilio API with Basic Auth...');
console.log('');

const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

const options = {
  hostname: 'api.twilio.com',
  port: 443,
  path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json`,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'User-Agent': 'TshlaTestScript/1.0'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`   HTTP Status: ${res.statusCode}`);
    console.log('');

    if (res.statusCode === 200) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ AUTHENTICATION SUCCESSFUL!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      try {
        const account = JSON.parse(data);
        console.log('Account Details:');
        console.log(`   Status: ${account.status}`);
        console.log(`   Type: ${account.type}`);
        console.log(`   Friendly Name: ${account.friendly_name}`);
        console.log(`   Date Created: ${account.date_created}`);
        console.log('');
        console.log('✅ Your Twilio credentials are working correctly!');
        console.log('');
        console.log('Next Step: Run the basic test call:');
        console.log('   node test-twilio-basic.cjs --phone="+1YOURNUMBER"');
      } catch (e) {
        console.log('   Response data:', data);
      }
    } else if (res.statusCode === 401) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ AUTHENTICATION FAILED (401 Unauthorized)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('This means the Account SID or Auth Token is incorrect.');
      console.log('');
      console.log('Please verify in Twilio Console:');
      console.log('1. Go to: https://console.twilio.com/');
      console.log('2. Look for "Account Info" section');
      console.log('3. Verify Account SID matches: AC3a28272c27111a4a99531fff151dcdab');
      console.log('4. Click "Show" next to Auth Token');
      console.log('5. Compare with value in your .env file');
      console.log('');
      console.log('Common Issues:');
      console.log('   - Auth Token was regenerated recently');
      console.log('   - Copy/paste error (extra spaces, missing characters)');
      console.log('   - Using wrong Twilio account (if you have multiple)');
      console.log('   - Account was transferred to a different SID');
      console.log('');

      try {
        const error = JSON.parse(data);
        console.log('Error Details from Twilio:');
        console.log(`   Code: ${error.code}`);
        console.log(`   Message: ${error.message}`);
        console.log(`   More Info: ${error.more_info}`);
      } catch (e) {
        console.log('   Raw response:', data);
      }
    } else if (res.statusCode === 403) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ ACCESS FORBIDDEN (403)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('This means your account may be suspended or restricted.');
      console.log('');
      console.log('Please check:');
      console.log('1. Go to: https://console.twilio.com/');
      console.log('2. Check for suspension notices');
      console.log('3. Verify billing is up to date');
      console.log('4. Contact Twilio support if needed');
      console.log('');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`❌ UNEXPECTED RESPONSE (HTTP ${res.statusCode})`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('Response:', data);
      console.log('');
    }
  });
});

req.on('error', (error) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('❌ CONNECTION ERROR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Error: ${error.message}`);
  console.log('');
  console.log('This could indicate:');
  console.log('   - Network connectivity issues');
  console.log('   - Firewall blocking HTTPS requests');
  console.log('   - DNS resolution problems');
  console.log('');
});

req.end();
