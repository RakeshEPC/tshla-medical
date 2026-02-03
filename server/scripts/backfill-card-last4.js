/**
 * Backfill card_last_4 for existing payments
 * This script retrieves card details from Stripe for payments that don't have card_last_4 set
 *
 * Usage: node server/scripts/backfill-card-last4.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeInstance = stripe(stripeSecretKey);

async function backfillCardLast4() {

  // Get all paid payments that don't have card_last_4
  const { data: payments, error } = await supabase
    .from('patient_payment_requests')
    .select('*')
    .eq('payment_status', 'paid')
    .is('card_last_4', null)
    .not('stripe_payment_intent_id', 'is', null)
    .order('paid_at', { ascending: false });

  if (error) {
    return;
  }


  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  for (const payment of payments) {

    try {
      // Retrieve PaymentIntent from Stripe
      const paymentIntent = await stripeInstance.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
        { expand: ['charges.data.payment_method_details'] }
      );

      let cardLast4 = null;

      // Try to extract card last 4
      if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
        const charge = paymentIntent.charges.data[0];

        if (charge.payment_method_details && charge.payment_method_details.card) {
          cardLast4 = charge.payment_method_details.card.last4;
        } else if (charge.source && charge.source.last4) {
          cardLast4 = charge.source.last4;
        }
      }

      if (cardLast4) {
        // Update the payment request with card_last_4
        const { error: updateError } = await supabase
          .from('patient_payment_requests')
          .update({ card_last_4: cardLast4 })
          .eq('id', payment.id);

        if (updateError) {
          failCount++;
        } else {
          successCount++;
        }
      } else {
        notFoundCount++;
      }
    } catch (err) {
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

}

// Run the backfill
backfillCardLast4()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    process.exit(1);
  });
