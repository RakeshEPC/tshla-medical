/**
 * Patient Payment Card Component
 * Displays payment request and Stripe checkout button on patient summary portal
 */

import { useState } from 'react';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { paymentRequestService } from '../services/paymentRequest.service';
import type { PaymentRequest } from '../types/payment.types';

interface PatientPaymentCardProps {
  payment: PaymentRequest;
  onPaymentComplete?: () => void;
}

export default function PatientPaymentCard({ payment, onPaymentComplete }: PatientPaymentCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayNow = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔍 Initiating checkout for payment:', payment.id);
      const response = await paymentRequestService.initiateCheckout(payment.id);
      console.log('✅ Checkout response:', response);

      if (!response.checkoutUrl) {
        throw new Error('No checkout URL received from server');
      }

      // Redirect to Stripe Checkout
      console.log('🔗 Redirecting to Stripe:', response.checkoutUrl);
      window.location.href = response.checkoutUrl;
    } catch (err: any) {
      console.error('❌ Error initiating checkout:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        stack: err.stack
      });
      setError(`Failed to start payment: ${err.message || 'Please try again or contact the office.'}`);
      setIsProcessing(false);
    }
  };

  // Don't show if payment is not pending
  if (payment.payment_status !== 'pending') {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl shadow-xl p-6 border-2 border-blue-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Payment Required</h3>
            <p className="text-sm text-gray-600 capitalize">{payment.payment_type}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Amount Due:</span>
          <span className="text-4xl font-bold text-blue-900">
            ${(payment.amount_cents / 100).toFixed(2)}
          </span>
        </div>

        <div className="border-t border-gray-200 pt-3 mt-3 space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Visit Date:</span>
            <span className="font-medium text-gray-900">
              {new Date(payment.visit_date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Provider:</span>
            <span className="font-medium text-gray-900">{payment.provider_name}</span>
          </div>
          {payment.em_code && (
            <div className="flex justify-between">
              <span>Visit Code:</span>
              <span className="font-mono font-medium text-gray-900">{payment.em_code}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        onClick={handlePayNow}
        disabled={isProcessing}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay Now with Credit Card
          </>
        )}
      </button>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-600 justify-center">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span>Secure payment powered by Stripe</span>
      </div>

      <p className="mt-3 text-xs text-center text-gray-500">
        Questions about this charge? Contact our office at{' '}
        <a href="tel:+18325938100" className="text-blue-600 hover:underline font-medium">
          (832) 593-8100
        </a>
      </p>
    </div>
  );
}
