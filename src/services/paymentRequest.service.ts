/**
 * Payment Request Service
 * API client for patient payment requests
 */

import type {
  PaymentRequest,
  CreatePaymentRequestData,
  PaymentRequestListResponse,
  CreatePaymentCheckoutResponse,
  PaymentDashboardFilters
} from '../types/payment.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io';

class PaymentRequestService {
  /**
   * Create a new payment request
   */
  async createPaymentRequest(data: CreatePaymentRequestData): Promise<{ success: boolean; paymentRequest: PaymentRequest; paymentLink: string }> {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        previsitId: data.previsit_id,
        appointmentId: data.appointment_id,
        patientId: data.patient_id,
        tshlaId: data.tshla_id,
        shareLinkId: data.share_link_id,
        patientName: data.patient_name,
        patientPhone: data.patient_phone,
        athenaMrn: data.athena_mrn,
        amountCents: data.amount_cents,
        paymentType: data.payment_type,
        emCode: data.em_code,
        providerName: data.provider_name,
        visitDate: data.visit_date,
        notes: data.notes,
        createdBy: data.created_by
      })
    });

    if (!response.ok) {
      // Get detailed error message from server
      let errorMessage = `Failed to create payment request (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = `Failed to create payment request: ${response.statusText}`;
      }
      console.error('❌ Payment creation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get pending payments for a patient by TSHLA ID
   */
  async getPaymentsByTshlaId(tshlaId: string): Promise<PaymentRequest[]> {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/by-tshla-id/${tshlaId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch payments');
    }

    const data = await response.json();
    return data.payments || [];
  }

  /**
   * Initiate Stripe checkout for a payment
   */
  async initiateCheckout(paymentRequestId: string): Promise<CreatePaymentCheckoutResponse> {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/${paymentRequestId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to initiate checkout');
    }

    const data = await response.json();
    return {
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
      paymentRequestId: data.paymentRequestId
    };
  }

  /**
   * List all payment requests with filters
   */
  async listPayments(filters?: PaymentDashboardFilters): Promise<PaymentRequestListResponse> {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.posted !== undefined && filters.posted !== 'all') params.append('posted', filters.posted.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.searchQuery) params.append('searchQuery', filters.searchQuery);

    const response = await fetch(`${API_BASE_URL}/api/payment-requests/list?${params}`);

    if (!response.ok) {
      throw new Error('Failed to fetch payment list');
    }

    return response.json();
  }

  /**
   * Mark payment as posted in EMR
   */
  async markAsPosted(paymentRequestId: string, staffId?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/${paymentRequestId}/mark-posted`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId })
    });

    if (!response.ok) {
      throw new Error('Failed to mark as posted');
    }
  }

  /**
   * Mark receipt as sent to patient
   */
  async markReceiptSent(paymentRequestId: string, sent: boolean, staffId?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/${paymentRequestId}/mark-receipt-sent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptSent: sent, staffId })
    });

    if (!response.ok) {
      throw new Error('Failed to update receipt sent status');
    }
  }

  /**
   * Cancel a payment request
   */
  async cancelPayment(paymentRequestId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/${paymentRequestId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to cancel payment');
    }
  }

  /**
   * Get daily summary report
   */
  async getDailySummary(params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    filterBy?: 'paid_at' | 'visit_date'
  }) {
    const queryParams = new URLSearchParams();

    if (params?.date) {
      queryParams.append('date', params.date);
    }
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.filterBy) {
      queryParams.append('filterBy', params.filterBy);
    }

    const queryString = queryParams.toString();
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/reports/daily-summary${queryString ? `?${queryString}` : ''}`);

    if (!response.ok) {
      throw new Error('Failed to fetch daily summary');
    }

    return response.json();
  }

  /**
   * Get unposted payments report
   */
  async getUnpostedReport() {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/reports/unposted`);

    if (!response.ok) {
      throw new Error('Failed to fetch unposted report');
    }

    return response.json();
  }

  /**
   * Get outstanding payments report
   */
  async getOutstandingReport() {
    const response = await fetch(`${API_BASE_URL}/api/payment-requests/reports/outstanding`);

    if (!response.ok) {
      throw new Error('Failed to fetch outstanding report');
    }

    return response.json();
  }
}

export const paymentRequestService = new PaymentRequestService();
