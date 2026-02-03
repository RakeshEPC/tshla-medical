/**
 * Stripe Webhook Handler for Payment Requests
 * Handles payment completion events from Stripe
 * Updates patient_payment_requests table when payment succeeds
 *
 * Created: 2026-01-15
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe');
const logger = require('../logger');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const isStripeConfigured = stripeSecretKey &&
  stripeSecretKey !== 'sk_test_example...' &&
  stripeSecretKey !== 'sk_test_51example...';

let stripeInstance = null;
if (isStripeConfigured) {
  stripeInstance = stripe(stripeSecretKey);
  logger.info('StripeWebhook', 'Stripe initialized for payment webhooks');
}

/**
 * Stripe Webhook Endpoint
 * POST /api/webhooks/stripe
 * Handles checkout.session.completed events
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeInstance) {
    logger.warn('StripeWebhook', 'Stripe not configured, ignoring webhook');
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify webhook signature
    if (webhookSecret) {
      event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
      logger.info('StripeWebhook', 'Webhook signature verified', { type: event.type });
    } else {
      // In development, parse without verification
      event = JSON.parse(req.body.toString());
      logger.warn('StripeWebhook', 'Webhook signature NOT verified (no secret)', { type: event.type });
    }
  } catch (err) {
    logger.error('StripeWebhook', 'Webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;

    case 'payment_intent.succeeded':
      logger.info('StripeWebhook', 'Payment intent succeeded', { paymentIntentId: event.data.object.id });
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    default:
      logger.info('StripeWebhook', 'Unhandled event type', { type: event.type });
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

/**
 * Handle checkout.session.completed event
 * Marks payment request as paid in database
 */
async function handleCheckoutCompleted(session) {
  try {
    logger.info('StripeWebhook', 'Processing checkout completion', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      amount: session.amount_total
    });

    // Get payment request ID from session metadata
    const paymentRequestId = session.metadata?.payment_request_id;

    if (!paymentRequestId) {
      logger.error('StripeWebhook', 'No payment_request_id in session metadata', {
        sessionId: session.id,
        metadata: session.metadata
      });
      return;
    }

    // Only update if payment was successful
    if (session.payment_status === 'paid') {
      // Retrieve payment method details to get last 4 digits of card
      let cardLast4 = null;
      let chargeId = null;
      try {
        if (session.payment_intent) {
          // Modern Stripe API: use latest_charge expansion
          const paymentIntent = await stripeInstance.paymentIntents.retrieve(
            session.payment_intent,
            { expand: ['latest_charge'] }
          );

          const charge = paymentIntent.latest_charge;
          if (charge && typeof charge === 'object') {
            chargeId = charge.id;
            if (charge.payment_method_details?.card) {
              cardLast4 = charge.payment_method_details.card.last4;
              logger.info('StripeWebhook', 'Retrieved card last 4 from latest_charge', {
                paymentRequestId,
                last4: cardLast4,
                brand: charge.payment_method_details.card.brand
              });
            }
          }

          // Fallback: legacy charges array
          if (!cardLast4 && paymentIntent.charges?.data?.length > 0) {
            const legacyCharge = paymentIntent.charges.data[0];
            chargeId = chargeId || legacyCharge.id;
            if (legacyCharge.payment_method_details?.card) {
              cardLast4 = legacyCharge.payment_method_details.card.last4;
              logger.info('StripeWebhook', 'Retrieved card last 4 from legacy charges', {
                paymentRequestId,
                last4: cardLast4
              });
            }
          }
        }

        if (!cardLast4) {
          logger.warn('StripeWebhook', 'Could not extract card last 4 from any source', {
            paymentRequestId,
            sessionId: session.id,
            hasPaymentIntent: !!session.payment_intent
          });
        }
      } catch (cardError) {
        logger.error('StripeWebhook', 'Error retrieving card details', {
          error: cardError.message,
          stack: cardError.stack,
          paymentRequestId
        });
      }

      const { data, error } = await supabase
        .from('patient_payment_requests')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent,
          stripe_charge_id: chargeId || session.payment_intent,
          card_last_4: cardLast4
        })
        .eq('id', paymentRequestId)
        .select()
        .single();

      if (error) {
        logger.error('StripeWebhook', 'Failed to update payment request', {
          paymentRequestId,
          error: error.message
        });
        return;
      }

      logger.info('StripeWebhook', 'Payment request marked as paid', {
        paymentRequestId,
        patientName: data.patient_name,
        amount: session.amount_total / 100,
        tshlaId: data.tshla_id
      });

      // TODO: Send confirmation email/SMS to patient
      // TODO: Notify staff of payment completion
    } else {
      logger.warn('StripeWebhook', 'Checkout completed but payment not marked as paid', {
        sessionId: session.id,
        paymentStatus: session.payment_status
      });
    }
  } catch (err) {
    logger.error('StripeWebhook', 'Error handling checkout completion', {
      error: err.message,
      sessionId: session.id
    });
  }
}

/**
 * Handle payment_intent.payment_failed event
 * Marks payment request as failed in database
 */
async function handlePaymentFailed(paymentIntent) {
  try {
    logger.info('StripeWebhook', 'Processing payment failure', {
      paymentIntentId: paymentIntent.id,
      failureMessage: paymentIntent.last_payment_error?.message
    });

    // Find payment request by payment intent ID
    const { data: paymentRequests, error: findError } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .limit(1);

    if (findError || !paymentRequests || paymentRequests.length === 0) {
      logger.warn('StripeWebhook', 'Could not find payment request for failed payment', {
        paymentIntentId: paymentIntent.id
      });
      return;
    }

    const paymentRequest = paymentRequests[0];

    // Update payment request status to failed
    const { error } = await supabase
      .from('patient_payment_requests')
      .update({
        payment_status: 'failed'
      })
      .eq('id', paymentRequest.id);

    if (error) {
      logger.error('StripeWebhook', 'Failed to mark payment as failed', {
        paymentRequestId: paymentRequest.id,
        error: error.message
      });
      return;
    }

    logger.info('StripeWebhook', 'Payment request marked as failed', {
      paymentRequestId: paymentRequest.id,
      patientName: paymentRequest.patient_name,
      failureReason: paymentIntent.last_payment_error?.message
    });
  } catch (err) {
    logger.error('StripeWebhook', 'Error handling payment failure', {
      error: err.message,
      paymentIntentId: paymentIntent.id
    });
  }
}

module.exports = router;
