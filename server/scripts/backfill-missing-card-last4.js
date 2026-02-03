/**
 * Backfill script for missing card_last_4 values
 *
 * This script finds all paid payments missing card_last_4 and attempts to retrieve
 * the card details from Stripe. Run this periodically or on-demand.
 *
 * Usage: node server/scripts/backfill-missing-card-last4.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillMissingCardLast4() {

  try {
    // Find all paid payments missing card_last_4
    const { data: payments, error } = await supabase
      .from('patient_payment_requests')
      .select('id, patient_name, stripe_payment_intent_id, card_last_4, paid_at')
      .eq('payment_status', 'paid')
      .is('card_last_4', null);

    if (error) {
      return;
    }

    if (payments.length === 0) {
      return;
    }


    let successCount = 0;
    let failCount = 0;

    for (const payment of payments) {

      try {
        // Retrieve PaymentIntent from Stripe using modern latest_charge expansion
        const pi = await stripe.paymentIntents.retrieve(
          payment.stripe_payment_intent_id,
          { expand: ['latest_charge'] }
        );

        let cardLast4 = null;

        // Modern API: latest_charge
        const charge = pi.latest_charge;
        if (charge && typeof charge === 'object' && charge.payment_method_details?.card) {
          cardLast4 = charge.payment_method_details.card.last4;
        }

        // Fallback: legacy charges array
        if (!cardLast4 && pi.charges?.data?.length > 0) {
          const legacyCharge = pi.charges.data[0];
          if (legacyCharge.payment_method_details?.card) {
            cardLast4 = legacyCharge.payment_method_details.card.last4;
          } else if (legacyCharge.source?.last4) {
            cardLast4 = legacyCharge.source.last4;
          }
        }

        if (cardLast4) {
          // Update database
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

          // Set placeholder so it doesn't keep trying
          const { error: updateError } = await supabase
            .from('patient_payment_requests')
            .update({ card_last_4: '0000' })
            .eq('id', payment.id);

          if (updateError) {
            failCount++;
          } else {
            successCount++;
          }
        }
      } catch (stripeError) {

        // If Payment Intent doesn't exist, set placeholder
        if (stripeError.type === 'StripeInvalidRequestError') {

          const { error: updateError } = await supabase
            .from('patient_payment_requests')
            .update({ card_last_4: '0000' })
            .eq('id', payment.id);

          if (!updateError) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      }

    }


  } catch (error) {
  }
}

// Run if called directly
if (require.main === module) {
  backfillMissingCardLast4()
    .then(() => process.exit(0))
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { backfillMissingCardLast4 };
