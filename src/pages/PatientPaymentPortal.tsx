/**
 * Patient Payment Portal (Standalone)
 * Public page where patients pay via shareable payment link
 * Requires TSHLA ID verification before showing payment
 * This is used when there's NO audio summary (standalone payments)
 *
 * Created: 2026-01-14
 * URL: /payment/:paymentId
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Lock,
  User
} from 'lucide-react';
import PatientPaymentCard from '../components/PatientPaymentCard';
import type { PaymentRequest } from '../types/payment.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function PatientPaymentPortal() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();

  // State
  const [step, setStep] = useState<'loading' | 'tshla_entry' | 'payment_view' | 'success' | 'error'>('loading');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TSHLA ID input
  const [tshlaId, setTshlaId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  /**
   * Load payment request info on mount
   */
  useEffect(() => {
    loadPaymentInfo();
  }, [paymentId]);

  /**
   * Check for payment success/cancel query params
   */
  useEffect(() => {
    if (searchParams.get('payment_success') === 'true') {
      setStep('success');
    } else if (searchParams.get('payment_canceled') === 'true') {
      // Just reload the payment view
      if (step === 'loading') {
        loadPaymentInfo();
      }
    }
  }, [searchParams]);

  /**
   * Load payment request info (public endpoint)
   */
  const loadPaymentInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment-requests/portal/${paymentId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('This payment link is invalid or has been removed.');
        } else {
          setError('Unable to load payment request. Please try again later.');
        }
        setStep('error');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setPaymentRequest(data.paymentRequest);

        // If already paid, show success
        if (data.paymentRequest.payment_status === 'paid') {
          setStep('success');
        } else {
          setStep('tshla_entry');
        }
      } else {
        setError(data.error || 'Failed to load payment request');
        setStep('error');
      }
    } catch (err: any) {
      console.error('Error loading payment info:', err);
      setError('Network error. Please check your internet connection.');
      setStep('error');
    }
  };

  /**
   * Verify TSHLA ID matches payment request
   */
  const verifyTshlaId = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tshlaId.trim() || !paymentRequest) {
      setVerificationError('Please enter your TSHLA ID');
      return;
    }

    // Format TSHLA ID
    let formattedTshlaId = tshlaId.trim().toUpperCase();
    formattedTshlaId = formattedTshlaId.replace(/[\s-]/g, '');

    // Auto-format if needed
    if (!formattedTshlaId.match(/^TSH[A-Z0-9]{6}$/)) {
      if (formattedTshlaId.match(/^[A-Z0-9]{6}$/)) {
        formattedTshlaId = 'TSH' + formattedTshlaId;
      } else if (!formattedTshlaId.startsWith('TSH')) {
        setVerificationError('TSHLA ID should start with "TSH" followed by 6 characters (e.g., TSH ABC-123)');
        return;
      }
    }

    // Add formatting: TSH XXX-XXX
    if (formattedTshlaId.length === 9) {
      formattedTshlaId = `${formattedTshlaId.slice(0, 6)}-${formattedTshlaId.slice(6)}`;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      // Verify TSHLA ID matches the payment request
      if (formattedTshlaId !== paymentRequest.tshla_id) {
        setVerificationError('TSHLA ID does not match this payment request. Please check your ID and try again.');
        return;
      }

      // Success!
      setStep('payment_view');
    } catch (err: any) {
      console.error('Error verifying TSHLA ID:', err);
      setVerificationError('Verification error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TSHLA Medical</h1>
          <p className="text-gray-600 mt-2">Secure Online Payment</p>
        </div>

        {/* Loading State */}
        {step === 'loading' && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payment request...</p>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="bg-white rounded-2xl shadow-xl p-12">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Payment</h2>
              <p className="text-gray-600 mb-8">{error}</p>
              <p className="text-sm text-gray-500">
                Contact our office at <a href="tel:+18325938100" className="text-green-600 hover:underline">(832) 593-8100</a>
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && paymentRequest && (
          <div className="bg-white rounded-2xl shadow-xl p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Payment Complete!</h2>
              <p className="text-lg text-gray-600 mb-2">Thank you for your payment.</p>
              <p className="text-2xl font-bold text-green-600 mb-8">
                ${(paymentRequest.amount_cents / 100).toFixed(2)}
              </p>

              <div className="bg-green-50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Details</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Patient:</span>
                    <span className="font-medium">{paymentRequest.patient_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium capitalize">{paymentRequest.payment_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    <span className="font-medium">{paymentRequest.provider_name}</span>
                  </div>
                  {paymentRequest.visit_date && (
                    <div className="flex justify-between">
                      <span>Visit Date:</span>
                      <span className="font-medium">{formatDate(paymentRequest.visit_date)}</span>
                    </div>
                  )}
                  {paymentRequest.paid_at && (
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span className="font-medium">{formatDate(paymentRequest.paid_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-500">
                You should receive a receipt via email shortly. If you have any questions, please contact our office.
              </p>
            </div>
          </div>
        )}

        {/* TSHLA ID Entry Step */}
        {step === 'tshla_entry' && paymentRequest && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h2>
              <p className="text-gray-600">Please enter your TSHLA ID to access payment</p>
            </div>

            {/* Payment Info Preview */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Amount Due</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${(paymentRequest.amount_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 capitalize">{paymentRequest.payment_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Provider</p>
                  <p className="font-semibold text-gray-900">{paymentRequest.provider_name}</p>
                </div>
              </div>
            </div>

            {/* TSHLA ID Form */}
            <form onSubmit={verifyTshlaId} className="space-y-6">
              <div>
                <label htmlFor="tshla-id" className="block text-sm font-medium text-gray-700 mb-2">
                  TSHLA ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="tshla-id"
                    type="text"
                    value={tshlaId}
                    onChange={(e) => setTshlaId(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                    placeholder="TSH ABC-123"
                    autoFocus
                    disabled={isVerifying}
                  />
                </div>
                {verificationError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {verificationError}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  Format: TSH followed by 6 characters (e.g., TSH ABC-123)
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifying || !tshlaId}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Verifying...
                  </span>
                ) : (
                  'Continue to Payment'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Need help? Call our office at{' '}
                <a href="tel:+18325938100" className="text-green-600 hover:underline font-medium">
                  (832) 593-8100
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Payment View Step */}
        {step === 'payment_view' && paymentRequest && (
          <div className="space-y-6">
            <PatientPaymentCard
              payment={paymentRequest}
              onPaymentComplete={() => {
                setStep('success');
              }}
            />

            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <p className="text-sm text-gray-600">
                Questions about this charge? Contact our office at{' '}
                <a href="tel:+18325938100" className="text-green-600 hover:underline font-medium">
                  (832) 593-8100
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
