import { loadStripe } from '@stripe/stripe-js';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Initialize Stripe with environment variable
const getStripePublishableKey = () => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key || key === 'pk_test_51example...') {
    logWarn('stripe', 'Stripe publishable key not configured - payments will not work', {
      hint: 'Set VITE_STRIPE_PUBLISHABLE_KEY in .env file',
      docs: 'See docs/STRIPE_SETUP_GUIDE.md for setup instructions'
    });
    return null;
  }
  return key;
};

const stripeKey = getStripePublishableKey();
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export interface PumpDrivePlan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export const PUMPDRIVE_PLANS: PumpDrivePlan[] = [
  {
    id: 'pump_report',
    name: 'Pump Recommendation Report',
    price: 9.99,
    description: 'Professional one-page pump recommendation report',
    features: [
      'AI-powered pump matching across 23 dimensions',
      'Personalized recommendations highlighting your choices',
      'Professional PDF report suitable for doctors',
      'QR code linking to digital resources',
      'Insurance information and next steps',
    ],
    popular: true,
  },
];

interface CheckoutSessionData {
  patientName: string;
  assessmentId: string;
  assessmentData: any;
  successUrl: string;
  cancelUrl: string;
}

// Enhanced checkout session creation for pump reports
export const createPumpReportCheckout = async (data: CheckoutSessionData) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';

    const response = await fetch(`${apiUrl}/api/stripe/create-pump-report-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientName: data.patientName,
        assessmentId: data.assessmentId,
        assessmentData: data.assessmentData,
        successUrl: data.successUrl,
        cancelUrl: data.cancelUrl,
        priceInCents: 999, // $9.99
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create checkout session');
    }

    const session = await response.json();
    return session; // Returns { id, url }
  } catch (error) {
    logError('stripe', 'Error message', {});
    throw error;
  }
};

// Legacy function - keep for backward compatibility
export const createCheckoutSession = async (planId: string, email: string) => {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        email,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId } = await response.json();
    const stripe = await stripePromise;

    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    const { error } = await stripe.redirectToCheckout({ sessionId });

    if (error) {
      throw error;
    }
  } catch (error) {
    logError('stripe', 'Error message', {});
    throw error;
  }
};

export const verifyPayment = async (sessionId: string) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    const response = await fetch(`${apiUrl}/api/stripe/verify-payment/${sessionId}`);
    if (!response.ok) {
      throw new Error('Payment verification failed');
    }
    return await response.json();
  } catch (error) {
    logError('stripe', 'Error message', {});
    throw error;
  }
};

// Service class for easier use
class StripeService {
  async createCheckoutSession(data: CheckoutSessionData) {
    return createPumpReportCheckout(data);
  }

  async verifyPayment(sessionId: string) {
    return verifyPayment(sessionId);
  }

  getPaymentStatusFromUrl(): { paid: boolean; sessionId?: string } {
    const urlParams = new URLSearchParams(window.location.search);
    const paid = urlParams.get('paid') === 'true';
    const sessionId = urlParams.get('session_id');
    return { paid, sessionId };
  }
}

export const stripeService = new StripeService();
