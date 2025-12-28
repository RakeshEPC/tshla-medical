/**
 * Twilio Verification Script
 * Verifies Twilio credentials, phone numbers, and account status
 * Usage: node scripts/verify-twilio.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║           TWILIO VERIFICATION SCRIPT                              ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');

// Check if credentials are configured
console.log('📋 Step 1: Checking Environment Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const results = {
  credentials: false,
  phoneNumber: false,
  accountStatus: false,
  phoneStatus: false,
  balance: false
};

if (!TWILIO_ACCOUNT_SID) {
  console.log('❌ TWILIO_ACCOUNT_SID: Not configured');
} else {
  console.log('✅ TWILIO_ACCOUNT_SID: Configured');
  console.log(`   Value: ${TWILIO_ACCOUNT_SID.substring(0, 10)}...`);
  results.credentials = true;
}

if (!TWILIO_AUTH_TOKEN) {
  console.log('❌ TWILIO_AUTH_TOKEN: Not configured');
} else {
  console.log('✅ TWILIO_AUTH_TOKEN: Configured');
  console.log(`   Value: ${TWILIO_AUTH_TOKEN.substring(0, 8)}...`);
}

if (!TWILIO_PHONE_NUMBER) {
  console.log('❌ TWILIO_PHONE_NUMBER: Not configured');
} else {
  console.log('✅ TWILIO_PHONE_NUMBER: Configured');
  console.log(`   Value: ${TWILIO_PHONE_NUMBER}`);
  results.phoneNumber = true;
}

console.log('');

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.log('❌ CRITICAL ERROR: Missing Twilio credentials');
  console.log('');
  console.log('Please configure the following in your .env file:');
  console.log('  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx');
  console.log('  TWILIO_AUTH_TOKEN=your_auth_token');
  console.log('  TWILIO_PHONE_NUMBER=+1XXXYYYZZZZ');
  console.log('');
  process.exit(1);
}

// Initialize Twilio client
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function verifyTwilio() {
  console.log('📋 Step 2: Verifying Twilio Account Status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Fetch account details
    const account = await client.api.accounts(TWILIO_ACCOUNT_SID).fetch();

    console.log('✅ Account Status:', account.status);
    console.log(`   Account Type: ${account.type}`);
    console.log(`   Account Name: ${account.friendlyName}`);
    console.log(`   Date Created: ${account.dateCreated}`);

    if (account.status === 'active') {
      results.accountStatus = true;
    } else {
      console.log('⚠️  WARNING: Account is not active!');
    }

    console.log('');
  } catch (error) {
    console.log('❌ Failed to fetch account status');
    console.log(`   Error: ${error.message}`);
    if (error.code === 20003) {
      console.log('   → Invalid credentials - Check your ACCOUNT_SID and AUTH_TOKEN');
    }
    console.log('');
  }

  console.log('📋 Step 3: Checking Phone Numbers');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // List all phone numbers
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });

    if (phoneNumbers.length === 0) {
      console.log('⚠️  No phone numbers found in account');
    } else {
      console.log(`✅ Found ${phoneNumbers.length} phone number(s):\n`);

      phoneNumbers.forEach((number, index) => {
        console.log(`   ${index + 1}. ${number.phoneNumber}`);
        console.log(`      Friendly Name: ${number.friendlyName}`);
        console.log(`      Capabilities: Voice=${number.capabilities.voice}, SMS=${number.capabilities.sms}`);
        console.log(`      Voice URL: ${number.voiceUrl || 'Not set'}`);

        // Check if this is the configured number
        if (number.phoneNumber === TWILIO_PHONE_NUMBER) {
          console.log('      ⭐ This is your configured number!');
          results.phoneStatus = true;
        }
        console.log('');
      });
    }

    // Warn if configured number not found
    if (TWILIO_PHONE_NUMBER && !results.phoneStatus) {
      console.log(`⚠️  WARNING: Configured number ${TWILIO_PHONE_NUMBER} not found in account!`);
      console.log('   → Double-check TWILIO_PHONE_NUMBER in your .env file');
      console.log('');
    }

  } catch (error) {
    console.log('❌ Failed to list phone numbers');
    console.log(`   Error: ${error.message}`);
    console.log('');
  }

  console.log('📋 Step 4: Checking Account Balance');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Fetch balance
    const balance = await client.balance.fetch();

    const balanceAmount = parseFloat(balance.balance);
    const currency = balance.currency;

    console.log(`✅ Account Balance: ${balanceAmount} ${currency}`);

    if (balanceAmount > 5) {
      console.log('   ✅ Balance is sufficient for testing');
      results.balance = true;
    } else if (balanceAmount > 0) {
      console.log('   ⚠️  Balance is low - consider adding funds');
      results.balance = true;
    } else {
      console.log('   ❌ Insufficient balance - please add funds to your account');
    }

    console.log('');
  } catch (error) {
    console.log('⚠️  Could not fetch balance (may not be available for all account types)');
    console.log(`   Error: ${error.message}`);
    console.log('');
    // Don't fail on balance check - not all accounts support this
    results.balance = true;
  }

  console.log('📋 Step 5: Testing API Connectivity');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Try to list recent calls (just to verify API works)
    const calls = await client.calls.list({ limit: 1 });
    console.log('✅ Successfully connected to Twilio API');
    console.log(`   Most recent call: ${calls.length > 0 ? calls[0].dateCreated : 'None'}`);
    console.log('');
  } catch (error) {
    console.log('❌ Failed to connect to Twilio API');
    console.log(`   Error: ${error.message}`);
    console.log('');
  }

  // Final summary
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                    VERIFICATION SUMMARY                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const allPassed = Object.values(results).every(r => r === true);

  console.log(`Credentials Configured: ${results.credentials ? '✅' : '❌'}`);
  console.log(`Phone Number Configured: ${results.phoneNumber ? '✅' : '❌'}`);
  console.log(`Account Status Active: ${results.accountStatus ? '✅' : '❌'}`);
  console.log(`Phone Number Valid: ${results.phoneStatus ? '✅' : '❌'}`);
  console.log(`Sufficient Balance: ${results.balance ? '✅' : '⚠️ '}`);
  console.log('');

  if (allPassed) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL CHECKS PASSED! Twilio is ready for testing.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Run basic test call: node scripts/test-twilio-basic.js --phone="+1YOURNUMBER"');
    console.log('2. Run full system test: npx tsx scripts/test-call.ts --phone="+1YOURNUMBER"');
    console.log('');
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  SOME CHECKS FAILED - Review the issues above');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Verify credentials at: https://console.twilio.com/');
    console.log('2. Check billing at: https://console.twilio.com/us1/billing/manage-billing/billing-overview');
    console.log('3. Verify phone numbers at: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming');
    console.log('');
  }

  return allPassed;
}

// Run verification
verifyTwilio()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
