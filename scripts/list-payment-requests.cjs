/**
 * List all payment requests to check for duplicates
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listPaymentRequests() {
  try {
    console.log('🔍 Fetching all payment requests...\n');

    const { data, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log(`Found ${data.length} payment requests:\n`);

    data.forEach((payment, index) => {
      console.log(`${index + 1}. ${payment.patient_name} - $${(payment.amount_cents / 100).toFixed(2)}`);
      console.log(`   ID: ${payment.id}`);
      console.log(`   TSHLA: ${payment.tshla_id}`);
      console.log(`   Status: ${payment.payment_status}`);
      console.log(`   Created: ${payment.created_at}`);
      console.log(`   Stripe Session: ${payment.stripe_session_id || 'None'}`);
      console.log('');
    });

    // Check for duplicates by patient
    const patientGroups = {};
    data.forEach(payment => {
      const key = `${payment.patient_name}-${payment.amount_cents}-${payment.payment_type}`;
      if (!patientGroups[key]) {
        patientGroups[key] = [];
      }
      patientGroups[key].push(payment);
    });

    const duplicates = Object.entries(patientGroups).filter(([_, payments]) => payments.length > 1);

    if (duplicates.length > 0) {
      console.log('\n⚠️  DUPLICATES FOUND:');
      duplicates.forEach(([key, payments]) => {
        console.log(`\n${key}:`);
        payments.forEach(p => {
          console.log(`  - ${p.id} (${p.payment_status}) - Created: ${p.created_at}`);
        });
      });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

listPaymentRequests();
