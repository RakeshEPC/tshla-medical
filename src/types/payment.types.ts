/**
 * Payment Request Types
 * TypeScript interfaces for patient payment system
 */

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
export type PaymentType = 'copay' | 'deductible' | 'balance' | 'other';

export interface PaymentRequest {
  id: string;

  // Links
  previsit_id: string | null;
  appointment_id: string | null;
  patient_id: string | null;
  tshla_id: string;
  share_link_id: string;

  // Patient Info
  patient_name: string;
  patient_phone: string;
  athena_mrn: string | null;

  // Payment Details
  amount_cents: number;
  payment_type: PaymentType;
  em_code: string | null;

  // Stripe
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;

  // Status
  payment_status: PaymentStatus;
  paid_at: string | null;

  // EMR Posting
  posted_in_emr: boolean;
  posted_in_emr_at: string | null;
  posted_in_emr_by: string | null;

  // Metadata
  provider_name: string;
  visit_date: string;
  notes: string | null;

  // Audit
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CreatePaymentRequestData {
  previsit_id?: string;
  appointment_id?: string;
  patient_id?: string;
  tshla_id: string;
  share_link_id: string;
  patient_name: string;
  patient_phone: string;
  athena_mrn?: string;
  amount_cents: number;
  payment_type: PaymentType;
  em_code?: string;
  provider_name: string;
  visit_date: string;
  notes?: string;
}

export interface PaymentRequestListResponse {
  payments: PaymentRequest[];
  summary: {
    total_pending: number;
    total_pending_count: number;
    total_paid: number;
    total_paid_count: number;
    total_unposted: number;
    total_unposted_count: number;
  };
}

export interface CreatePaymentCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
  paymentRequestId: string;
}

export interface PaymentDashboardFilters {
  status?: PaymentStatus | 'all';
  posted?: boolean | 'all';
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface DailySummaryReport {
  date: string;
  total_collected: number;
  total_count: number;
  by_payment_type: {
    copay: number;
    deductible: number;
    balance: number;
    other: number;
  };
  by_provider: Array<{
    provider_name: string;
    total: number;
    count: number;
  }>;
}

export interface UnpostedPaymentsReport {
  payments: PaymentRequest[];
  total_unposted: number;
  total_count: number;
}

export interface OutstandingPaymentsReport {
  payments: PaymentRequest[];
  aging: {
    '0-30': { count: number; total: number };
    '31-60': { count: number; total: number };
    '60+': { count: number; total: number };
  };
}
