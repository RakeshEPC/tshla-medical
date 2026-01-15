/**
 * Patient Payment Request API
 * Handles online payment requests for copays, deductibles, and balances
 * Integrates with Stripe for payment processing
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
const isStripeConfigured = stripeSecretKey &&
  stripeSecretKey !== 'sk_test_example...' &&
  stripeSecretKey !== 'sk_test_51example...';

let stripeInstance = null;
if (isStripeConfigured) {
  stripeInstance = stripe(stripeSecretKey);
  logger.info('PaymentAPI', 'Stripe initialized for office visit payments');
}

/**
 * Create a new payment request
 * POST /api/payment-requests/create
 */
router.post('/create', async (req, res) => {
  try {
    logger.info('PaymentAPI', 'Payment request received', { body: req.body });

    const {
      previsitId,
      appointmentId,
      patientId,
      tshlaId,
      shareLinkId,
      patientName,
      patientPhone,
      athenaMrn,
      amountCents,
      paymentType,
      emCode,
      providerName,
      visitDate,
      notes,
      createdBy
    } = req.body;

    // Enhanced validation with detailed logging
    const missingFields = [];
    if (!tshlaId) missingFields.push('tshlaId');
    if (!patientName) missingFields.push('patientName');
    if (!amountCents) missingFields.push('amountCents');
    if (!paymentType) missingFields.push('paymentType');
    if (!providerName) missingFields.push('providerName');

    if (missingFields.length > 0) {
      logger.error('PaymentAPI', 'Missing required fields', {
        missingFields,
        receivedData: { tshlaId, patientName, amountCents, paymentType, providerName }
      });
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    if (amountCents <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than zero'
      });
    }

    // Auto-generate share_link_id if not provided (for standalone payments without audio summary)
    const finalShareLinkId = shareLinkId || `PAY-${tshlaId}-${Date.now()}`;

    const insertData = {
      previsit_id: previsitId || null,
      appointment_id: appointmentId || null,
      patient_id: patientId || null,
      tshla_id: tshlaId,
      share_link_id: finalShareLinkId,
      patient_name: patientName,
      patient_phone: patientPhone,
      athena_mrn: athenaMrn || null,
      amount_cents: amountCents,
      payment_type: paymentType,
      em_code: emCode || null,
      provider_name: providerName,
      visit_date: visitDate,
      notes: notes || null,
      created_by: createdBy || null,
      payment_status: 'pending'
    };

    logger.info('PaymentAPI', 'Inserting payment request', { insertData });

    // Create payment request
    const { data, error } = await supabase
      .from('patient_payment_requests')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error('PaymentAPI', 'Database insert failed', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
    }

    // Generate payment link - use standalone payment portal if no audio summary exists
    const appUrl = process.env.VITE_APP_URL || 'https://www.tshla.ai';
    const paymentLink = shareLinkId
      ? `${appUrl}/patient-summary/${shareLinkId}` // Has audio summary
      : `${appUrl}/payment/${data.id}`; // Standalone payment

    // Update previsit_data if previsitId provided
    if (previsitId) {
      await supabase
        .from('previsit_data')
        .update({ active_payment_request_id: data.id })
        .eq('id', previsitId);
    }

    logger.info('PaymentAPI', 'Payment request created', {
      paymentRequestId: data.id,
      tshlaId,
      amountCents,
      paymentType
    });

    res.json({
      success: true,
      paymentRequest: data,
      paymentLink
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Create payment request error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get pending payments for a patient by TSHLA ID
 * GET /api/payment-requests/by-tshla-id/:tshlaId
 */
router.get('/by-tshla-id/:tshlaId', async (req, res) => {
  try {
    const { tshlaId } = req.params;

    const { data, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('tshla_id', tshlaId)
      .in('payment_status', ['pending', 'paid'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.json({
      success: true,
      payments: data || []
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Get payments by TSHLA ID error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get payment request details for standalone payment portal
 * GET /api/payment-requests/portal/:paymentId
 * Public endpoint - used by patient payment portal (TSHLA ID verification happens client-side)
 */
router.get('/portal/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const { data, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found'
      });
    }

    // Return payment details (sensitive data filtered by TSHLA ID verification on client)
    res.json({
      success: true,
      paymentRequest: {
        id: data.id,
        patient_name: data.patient_name,
        tshla_id: data.tshla_id,
        athena_mrn: data.athena_mrn,
        amount_cents: data.amount_cents,
        payment_type: data.payment_type,
        payment_status: data.payment_status,
        provider_name: data.provider_name,
        visit_date: data.visit_date,
        em_code: data.em_code,
        created_at: data.created_at,
        paid_at: data.paid_at
      }
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Get payment portal details error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Initiate Stripe checkout for a payment request
 * POST /api/payment-requests/:id/checkout
 */
router.post('/:id/checkout', async (req, res) => {
  try {
    if (!stripeInstance) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not configured'
      });
    }

    const { id } = req.params;

    // Get payment request
    const { data: paymentRequest, error: fetchError } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !paymentRequest) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found'
      });
    }

    // Check if already paid
    if (paymentRequest.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment already completed'
      });
    }

    // Create Stripe checkout session
    const appUrl = process.env.VITE_APP_URL || 'https://www.tshla.ai';
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Office Visit ${paymentRequest.payment_type.charAt(0).toUpperCase() + paymentRequest.payment_type.slice(1)}`,
            description: `${paymentRequest.provider_name} - ${paymentRequest.visit_date || 'Recent visit'}`,
          },
          unit_amount: paymentRequest.amount_cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: paymentRequest.share_link_id && !paymentRequest.share_link_id.startsWith('PAY-')
        ? `${appUrl}/patient-summary/${paymentRequest.share_link_id}?payment_success=true`
        : `${appUrl}/payment/${id}?payment_success=true`,
      cancel_url: paymentRequest.share_link_id && !paymentRequest.share_link_id.startsWith('PAY-')
        ? `${appUrl}/patient-summary/${paymentRequest.share_link_id}?payment_canceled=true`
        : `${appUrl}/payment/${id}?payment_canceled=true`,
      metadata: {
        type: 'office_visit_copay',
        payment_request_id: id,
        patient_id: paymentRequest.patient_id || '',
        tshla_id: paymentRequest.tshla_id,
        appointment_id: paymentRequest.appointment_id || '',
        em_code: paymentRequest.em_code || '',
        payment_type: paymentRequest.payment_type
      },
      customer_email: req.body.customerEmail || undefined,
    });

    // Update payment request with Stripe session ID
    await supabase
      .from('patient_payment_requests')
      .update({ stripe_session_id: session.id })
      .eq('id', id);

    logger.info('PaymentAPI', 'Stripe checkout created', {
      paymentRequestId: id,
      sessionId: session.id,
      amount: paymentRequest.amount_cents
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      paymentRequestId: id
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Checkout creation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List all payment requests with filters
 * GET /api/payment-requests/list
 */
router.get('/list', async (req, res) => {
  try {
    const { status, posted, startDate, endDate, searchQuery } = req.query;

    let query = supabase
      .from('patient_payment_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('payment_status', status);
    }

    if (posted === 'true') {
      query = query.eq('posted_in_emr', true);
    } else if (posted === 'false') {
      query = query.eq('posted_in_emr', false);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: payments, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Apply search filter in memory (for patient name, MRN, TSHLA ID)
    let filteredPayments = payments;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredPayments = payments.filter(p =>
        p.patient_name?.toLowerCase().includes(query) ||
        p.athena_mrn?.toLowerCase().includes(query) ||
        p.tshla_id?.toLowerCase().includes(query)
      );
    }

    // Calculate summary
    const summary = {
      total_pending: filteredPayments
        .filter(p => p.payment_status === 'pending')
        .reduce((sum, p) => sum + p.amount_cents, 0),
      total_pending_count: filteredPayments.filter(p => p.payment_status === 'pending').length,
      total_paid: filteredPayments
        .filter(p => p.payment_status === 'paid')
        .reduce((sum, p) => sum + p.amount_cents, 0),
      total_paid_count: filteredPayments.filter(p => p.payment_status === 'paid').length,
      total_unposted: filteredPayments
        .filter(p => p.payment_status === 'paid' && !p.posted_in_emr)
        .reduce((sum, p) => sum + p.amount_cents, 0),
      total_unposted_count: filteredPayments.filter(p => p.payment_status === 'paid' && !p.posted_in_emr).length
    };

    res.json({
      success: true,
      payments: filteredPayments,
      summary
    });
  } catch (error) {
    logger.error('PaymentAPI', 'List payments error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Mark payment as posted in EMR
 * PATCH /api/payment-requests/:id/mark-posted
 */
router.patch('/:id/mark-posted', async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;

    const { data, error } = await supabase
      .from('patient_payment_requests')
      .update({
        posted_in_emr: true,
        posted_in_emr_at: new Date().toISOString(),
        posted_in_emr_by: staffId || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('PaymentAPI', 'Payment marked as posted', {
      paymentRequestId: id,
      staffId
    });

    res.json({
      success: true,
      paymentRequest: data
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Mark posted error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Mark receipt as sent to patient
 * PATCH /api/payment-requests/:id/mark-receipt-sent
 */
router.patch('/:id/mark-receipt-sent', async (req, res) => {
  try {
    const { id } = req.params;
    const { receiptSent, staffId } = req.body;

    const updateData = {
      receipt_sent: receiptSent,
      receipt_sent_at: receiptSent ? new Date().toISOString() : null,
      receipt_sent_by: receiptSent ? (staffId || null) : null
    };

    const { data, error } = await supabase
      .from('patient_payment_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('PaymentAPI', 'Receipt sent status updated', {
      paymentRequestId: id,
      receiptSent,
      staffId
    });

    res.json({
      success: true,
      paymentRequest: data
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Mark receipt sent error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel a payment request
 * DELETE /api/payment-requests/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow canceling pending payments
    const { data: existing, error: fetchError } = await supabase
      .from('patient_payment_requests')
      .select('payment_status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found'
      });
    }

    if (existing.payment_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Can only cancel pending payment requests'
      });
    }

    const { error } = await supabase
      .from('patient_payment_requests')
      .update({ payment_status: 'canceled' })
      .eq('id', id);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('PaymentAPI', 'Payment request canceled', { paymentRequestId: id });

    res.json({
      success: true,
      message: 'Payment request canceled'
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Cancel payment error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get daily summary report
 * GET /api/payment-requests/reports/daily-summary
 */
router.get('/reports/daily-summary', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('payment_status', 'paid')
      .gte('paid_at', `${targetDate}T00:00:00`)
      .lte('paid_at', `${targetDate}T23:59:59`);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate totals
    const totalCollected = data.reduce((sum, p) => sum + p.amount_cents, 0);
    const byPaymentType = {
      copay: data.filter(p => p.payment_type === 'copay').reduce((sum, p) => sum + p.amount_cents, 0),
      deductible: data.filter(p => p.payment_type === 'deductible').reduce((sum, p) => sum + p.amount_cents, 0),
      balance: data.filter(p => p.payment_type === 'balance').reduce((sum, p) => sum + p.amount_cents, 0),
      other: data.filter(p => p.payment_type === 'other').reduce((sum, p) => sum + p.amount_cents, 0),
    };

    // Group by provider
    const providerMap = {};
    data.forEach(p => {
      if (!providerMap[p.provider_name]) {
        providerMap[p.provider_name] = { total: 0, count: 0 };
      }
      providerMap[p.provider_name].total += p.amount_cents;
      providerMap[p.provider_name].count++;
    });

    const byProvider = Object.entries(providerMap).map(([name, stats]) => ({
      provider_name: name,
      total: stats.total,
      count: stats.count
    }));

    res.json({
      success: true,
      date: targetDate,
      total_collected: totalCollected,
      total_count: data.length,
      by_payment_type: byPaymentType,
      by_provider: byProvider
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Daily summary error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get unposted payments report
 * GET /api/payment-requests/reports/unposted
 */
router.get('/reports/unposted', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('payment_status', 'paid')
      .eq('posted_in_emr', false)
      .order('paid_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const totalUnposted = data.reduce((sum, p) => sum + p.amount_cents, 0);

    res.json({
      success: true,
      payments: data,
      total_unposted: totalUnposted,
      total_count: data.length
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Unposted report error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get outstanding payments report
 * GET /api/payment-requests/reports/outstanding
 */
router.get('/reports/outstanding', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate aging
    const now = new Date();
    const aging = {
      '0-30': { count: 0, total: 0 },
      '31-60': { count: 0, total: 0 },
      '60+': { count: 0, total: 0 }
    };

    data.forEach(p => {
      const daysSince = Math.floor((now - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
      if (daysSince <= 30) {
        aging['0-30'].count++;
        aging['0-30'].total += p.amount_cents;
      } else if (daysSince <= 60) {
        aging['31-60'].count++;
        aging['31-60'].total += p.amount_cents;
      } else {
        aging['60+'].count++;
        aging['60+'].total += p.amount_cents;
      }
    });

    res.json({
      success: true,
      payments: data,
      aging
    });
  } catch (error) {
    logger.error('PaymentAPI', 'Outstanding report error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Download receipt PDF for a payment
 * GET /api/payment-requests/:id/receipt
 */
router.get('/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch payment data
    const { data: payment, error } = await supabase
      .from('patient_payment_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !payment) {
      logger.error('PaymentAPI', 'Payment not found for receipt', { id });
      return res.status(404).json({
        success: false,
        error: 'Payment request not found'
      });
    }

    // Check if payment is paid
    if (payment.payment_status !== 'paid') {
      logger.warn('PaymentAPI', 'Receipt requested for unpaid payment', { id, status: payment.payment_status });
      return res.status(400).json({
        success: false,
        error: 'Receipt can only be generated for paid payments'
      });
    }

    // Import receipt generator (dynamic import for ES module)
    const { default: receiptGenerator } = await import('../services/receiptGenerator.service.js');

    // Set response headers for PDF download
    const filename = receiptGenerator.getReceiptFilename(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Generate and stream PDF
    await receiptGenerator.generateReceipt(payment, res);

    logger.info('PaymentAPI', 'Receipt downloaded', {
      paymentId: id,
      filename
    });

  } catch (error) {
    logger.error('PaymentAPI', 'Receipt generation error', { error: error.message });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate receipt'
      });
    }
  }
});

module.exports = router;
