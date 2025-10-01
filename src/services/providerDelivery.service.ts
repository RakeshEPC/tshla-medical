import { logError, logWarn, logInfo, logDebug } from './logger.service';
interface ProviderDeliveryData {
  patientName: string;
  providerEmail: string;
  providerName: string;
  assessmentData: any;
}

interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class ProviderDeliveryService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  }

  async sendReportToProvider(data: ProviderDeliveryData): Promise<DeliveryResult> {
    try {
      logInfo('providerDelivery', 'Info message', {});

      const response = await fetch(`${this.apiUrl}/api/provider/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientName: data.patientName,
          providerEmail: data.providerEmail,
          providerName: data.providerName,
          assessmentData: data.assessmentData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      logInfo('providerDelivery', 'Info message', {});

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      logError('providerDelivery', 'Error message', {});

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getDeliveryStatus(assessmentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/api/provider/delivery-status/${assessmentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logError('providerDelivery', 'Error message', {});
      throw error;
    }
  }

  async trackEmailOpen(messageId: string): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/api/provider/track-open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          openedAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logError('providerDelivery', 'Error message', {});
      // Don't throw - this is not critical
    }
  }

  // Get list of participating providers
  async getParticipatingProviders(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/provider/participating`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logError('providerDelivery', 'Error message', {});
      // Return default list as fallback
      return [
        { id: 1, name: 'Dr. Rakesh Patel', email: 'rpatel@tshla.ai', specialty: 'Endocrinologist' },
        {
          id: 2,
          name: 'Dr. Veena Watwe',
          email: 'vwatwe@tshla.ai',
          specialty: 'Internal Medicine',
        },
        {
          id: 3,
          name: 'Dr. Tess Chamakkala',
          email: 'tchamakkala@tshla.ai',
          specialty: 'Endocrinologist',
        },
        { id: 4, name: 'Dr. Elinia Shakya', email: 'eshakya@tshla.ai', specialty: 'Primary Care' },
        { id: 5, name: 'Dr. Preeya Raghu', email: 'praghu@tshla.ai', specialty: 'Endocrinologist' },
        {
          id: 6,
          name: 'Shannon Gregorek, NP',
          email: 'sgregorek@tshla.ai',
          specialty: 'Diabetes Specialist',
        },
        { id: 7, name: 'Kruti Patel, NP', email: 'kpatel@tshla.ai', specialty: 'Primary Care' },
        { id: 8, name: 'Nadia Younus, PA', email: 'nyounus@tshla.ai', specialty: 'Endocrinology' },
        {
          id: 9,
          name: 'Radha Bernander, PA',
          email: 'rbernander@tshla.ai',
          specialty: 'Diabetes Care',
        },
      ];
    }
  }

  // Validate email address format
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Generate tracking pixel URL for email open tracking
  generateTrackingPixelUrl(messageId: string): string {
    return `${this.apiUrl}/api/provider/track-pixel/${messageId}`;
  }
}

export const providerDeliveryService = new ProviderDeliveryService();
