/**
 * Cancel duplicate pending payment requests
 * Keeps the newest or paid payment, cancels older duplicates
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cancelDuplicates() {
  try {
    console.log('🔍 Finding duplicate payment requests...\n');

    const { data: payments, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    // Group by patient + amount + type
    const groups = {};
    payments.forEach(payment => {
      const key = `${payment.tshla_id}-${payment.amount_cents}-${payment.payment_type}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(payment);
    });

    // Find duplicates
    const duplicates = Object.entries(groups).filter(([_, payments]) => payments.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log(`Found ${duplicates.length} groups with duplicates:\n`);

    for (const [key, paymentGroup] of duplicates) {
      console.log(`\n📋 ${key}:`);

      // Sort: paid first, then by created_at descending (newest first)
      paymentGroup.sort((a, b) => {
        if (a.payment_status === 'paid' && b.payment_status !== 'paid') return -1;
        if (a.payment_status !== 'paid' && b.payment_status === 'paid') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      // Keep the first one (paid or newest), cancel the rest
      const [keep, ...toCancel] = paymentGroup;

      console.log(`   ✅ KEEP: ${keep.id.substring(0, 8)}... (${keep.payment_status}) - ${keep.patient_name}`);

      for (const payment of toCancel) {
        console.log(`   ❌ CANCEL: ${payment.id.substring(0, 8)}... (${payment.payment_status}) - Created: ${payment.created_at}`);

        // Cancel the payment
        const { error: cancelError } = await supabase
          .from('patient_payment_requests')
          .update({ payment_status: 'canceled' })
          .eq('id', payment.id);

        if (cancelError) {
          console.log(`      ⚠️  Failed to cancel: ${cancelError.message}`);
        } else {
          console.log(`      ✅ Canceled successfully`);
        }
      }
    }

    console.log('\n✅ Duplicate cleanup complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

cancelDuplicates();
