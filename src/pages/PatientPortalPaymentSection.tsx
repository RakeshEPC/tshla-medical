/**
 * Patient Portal Payment Section
 * Integrated payment view within unified patient portal
 * Shows all pending payments for logged-in patient
 * Created: 2026-01-23
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import PatientPaymentCard from '../components/PatientPaymentCard';
import type { PaymentRequest } from '../types/payment.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
}

export default function PatientPortalPaymentSection() {
  const navigate = useNavigate();
  const location = useLocation();

  // Session from navigation state
  const [session, setSession] = useState<PatientSession | null>(null);

  // Payment data
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showOtherPayments, setShowOtherPayments] = useState(false);

  /**
   * Load session from storage or navigation state
   */
  useEffect(() => {
    // Try to get session from navigation state first
    const stateSession = location.state?.session;
    if (stateSession) {
      setSession(stateSession);
      return;
    }

    // Fall back to session storage
    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession) {
      navigate('/patient-portal-login');
      return;
    }

    const sessionData: PatientSession = JSON.parse(savedSession);
    setSession(sessionData);
  }, [navigate, location.state]);

  /**
   * Load payment requests
   */
  useEffect(() => {
    if (!session) return;
    loadPayments();
  }, [session]);

  /**
   * Load all payment requests for patient
   */
  const loadPayments = async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/payment-requests/patient/${session.tshlaId}`,
        {
          headers: {
            'x-session-id': session.sessionId,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load payments');
      }

      // Sort by due date (soonest first)
      const sortedPayments = (data.paymentRequests || []).sort((a: PaymentRequest, b: PaymentRequest) => {
        return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
      });

      setPayments(sortedPayments);
    } catch (err: any) {
      console.error('Load payments error:', err);
      setError(err.message || 'Unable to load payment information');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle payment completion
   */
  const handlePaymentComplete = () => {
    // Reload payments
    loadPayments();
  };

  /**
   * Get pending payments
   */
  const pendingPayments = payments.filter((p) => p.payment_status === 'pending');

  /**
   * Get primary payment (soonest due date)
   */
  const primaryPayment = pendingPayments.length > 0 ? pendingPayments[0] : null;

  /**
   * Get other pending payments
   */
  const otherPayments = pendingPayments.slice(1);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Unable to Load Payments
          </h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center space-x-3">
            <CreditCard className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Center</h1>
              <p className="text-sm text-gray-600">
                {session?.patientName} • TSH ID: {session?.tshlaId}
              </p>
            </div>
          </div>
        </div>

        {/* No Payments */}
        {pendingPayments.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Caught Up!</h2>
            <p className="text-gray-600 mb-6">
              You have no outstanding payments at this time.
            </p>
            <button
              onClick={() => navigate('/patient-portal-unified', { state: { session } })}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Primary Payment */}
        {primaryPayment && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 mb-4 border-2 border-red-200">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-900">Payment Due</p>
                  <p className="text-sm text-red-700">
                    Due: {new Date(primaryPayment.due_date!).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Current Payment</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {primaryPayment.payment_type === 'copay'
                        ? 'Office Visit Copay'
                        : primaryPayment.payment_type === 'balance'
                        ? 'Account Balance'
                        : 'Patient Responsibility'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-green-600">
                      ${(primaryPayment.amount_cents / 100).toFixed(2)}
                    </p>
                    {primaryPayment.visit_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        Visit: {new Date(primaryPayment.visit_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <PatientPaymentCard
                  paymentRequest={primaryPayment}
                  onPaymentComplete={handlePaymentComplete}
                  isEmbedded={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* Other Pending Payments */}
        {otherPayments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <button
              onClick={() => setShowOtherPayments(!showOtherPayments)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 text-gray-600" />
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Other Pending Payments
                  </h3>
                  <p className="text-sm text-gray-600">
                    {otherPayments.length} payment{otherPayments.length !== 1 ? 's' : ''}{' '}
                    waiting
                  </p>
                </div>
              </div>
              {showOtherPayments ? (
                <ChevronUp className="w-6 h-6 text-gray-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-400" />
              )}
            </button>

            {showOtherPayments && (
              <div className="border-t border-gray-200">
                {otherPayments.map((payment, idx) => (
                  <div
                    key={payment.id}
                    className={`p-6 ${
                      idx < otherPayments.length - 1 ? 'border-b border-gray-200' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {payment.payment_type === 'copay'
                            ? 'Copay'
                            : payment.payment_type === 'balance'
                            ? 'Balance'
                            : 'Payment'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Due: {new Date(payment.due_date!).toLocaleDateString()}
                        </p>
                        {payment.visit_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Visit: {new Date(payment.visit_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(payment.amount_cents / 100).toFixed(2)}
                      </p>
                    </div>

                    <PatientPaymentCard
                      paymentRequest={payment}
                      onPaymentComplete={handlePaymentComplete}
                      isEmbedded={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
