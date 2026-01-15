/**
 * Manual Script: Mark Payment Request as Paid
 * Use this to mark a specific payment request as paid manually
 * (For testing or when webhook didn't fire)
 *
 * Usage:
 *   node scripts/mark-payment-paid.js <payment_id>
 *
 * Example:
 *   node scripts/mark-payment-paid.js a045f7b7-9f4d-4a91-9199-dc905b2aac79
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function markPaymentAsPaid(paymentId) {
  try {
    console.log(`🔍 Looking up payment request: ${paymentId}`);

    // First, get the current payment request
    const { data: current, error: fetchError } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !current) {
      console.error('❌ Payment request not found:', fetchError?.message);
      return;
    }

    console.log('📄 Current payment request:');
    console.log(`   Patient: ${current.patient_name}`);
    console.log(`   Amount: $${(current.amount_cents / 100).toFixed(2)}`);
    console.log(`   Type: ${current.payment_type}`);
    console.log(`   Status: ${current.payment_status}`);
    console.log(`   Created: ${current.created_at}`);

    if (current.payment_status === 'paid') {
      console.log('✅ Payment is already marked as paid!');
      console.log(`   Paid at: ${current.paid_at}`);
      return;
    }

    // Update the payment request to paid
    const { data, error } = await supabase
      .from('patient_payment_requests')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: 'manual_update',
        stripe_charge_id: 'manual_update'
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to update payment:', error.message);
      return;
    }

    console.log('✅ Payment marked as PAID successfully!');
    console.log(`   Patient: ${data.patient_name}`);
    console.log(`   Amount: $${(data.amount_cents / 100).toFixed(2)}`);
    console.log(`   Paid at: ${data.paid_at}`);
    console.log('');
    console.log('🎉 The payment portal will now show "Payment Complete" status');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Get payment ID from command line argument
const paymentId = process.argv[2];

if (!paymentId) {
  console.error('❌ Usage: node scripts/mark-payment-paid.js <payment_id>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/mark-payment-paid.js a045f7b7-9f4d-4a91-9199-dc905b2aac79');
  process.exit(1);
}

// Run the script
markPaymentAsPaid(paymentId);
