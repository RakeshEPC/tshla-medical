import { encryptPHI, decryptPHI, maskPHI } from './encryption';
import { env } from '../config/environment';
import { auditLogger, AuditAction, ResourceType } from './auditLog';

/**
 * Secure API client that handles PHI properly
 * Never exposes API keys to client
 * Encrypts sensitive data before transmission
 */
export class SecureApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a secure API call with PHI
   */
  async callWithPHI(endpoint: string, data: any, userId: string, patientId?: string): Promise<any> {
    try {
      // Sanitize and encrypt sensitive fields
      const sanitizedData = this.sanitizePHI(data);
      const encryptedPayload = {
        data: encryptPHI(JSON.stringify(sanitizedData)),
        userId,
        timestamp: new Date().toISOString(),
      };

      // Log the API call
      await auditLogger.log({
        userId,
        patientId,
        action: AuditAction.API_CALL,
        resourceType: ResourceType.PATIENT,
        resourceId: endpoint,
        details: {
          endpoint,
          method: 'POST',
          // Never log actual PHI, only metadata
          dataSize: JSON.stringify(data).length,
        },
        success: true,
      });

      // Make the API call (server-side only)
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // API key is only on server, never exposed to client
          Authorization: `Bearer ${env.API_KEY}`,
          'X-User-Id': userId,
          'X-Request-Id': this.generateRequestId(),
        },
        body: JSON.stringify(encryptedPayload),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const result = await response.json();

      // Decrypt response if needed
      if (result.encrypted) {
        result.data = JSON.parse(decryptPHI(result.data));
      }

      return result;
    } catch (error) {
      // Log failed API call
      await auditLogger.log({
        userId,
        patientId,
        action: AuditAction.API_CALL,
        resourceType: ResourceType.PATIENT,
        resourceId: endpoint,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sanitize PHI before sending
   * Remove any fields that shouldn't be transmitted
   */
  private sanitizePHI(data: any): any {
    const sanitized = { ...data };

    // Remove sensitive fields that shouldn't be sent
    const sensitiveFields = ['ssn', 'creditCard', 'password', 'securityAnswer'];

    sensitiveFields.forEach(field => {
      delete sanitized[field];
    });

    // Mask certain fields for logging
    if (sanitized.email) {
      const [localPart, domain] = sanitized.email.split('@');
      sanitized.emailMasked = maskPHI(localPart, 2) + '@' + domain;
    }

    if (sanitized.phone) {
      sanitized.phoneMasked = maskPHI(sanitized.phone, 4);
    }

    return sanitized;
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Specific API clients for different services
 */

// OpenAI replacement - use a HIPAA-compliant service
export class HIPAACompliantAI {
  private client: SecureApiClient;

  constructor() {
    // Use AWS Comprehend Medical or Azure Healthcare API instead
    this.client = new SecureApiClient(env.HEALTHCARE_AI_ENDPOINT);
  }

  async generateNote(transcript: string, userId: string, patientId: string): Promise<any> {
    // Encrypt transcript before sending
    const encryptedTranscript = encryptPHI(transcript);

    // Use healthcare-specific AI service
    const response = await this.client.callWithPHI(
      '/api/healthcare/generate-note',
      { transcript: encryptedTranscript },
      userId,
      patientId
    );

    return response;
  }

  async extractMedicalEntities(text: string, userId: string, patientId: string): Promise<any> {
    // Use AWS Comprehend Medical for entity extraction
    const response = await fetch('/api/aws/comprehend-medical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        text: encryptPHI(text),
        patientId: patientId,
      }),
    });

    return response.json();
  }
}

// Azure Speech Service wrapper with PHI protection
export class SecureSpeechService {
  async getToken(userId: string): Promise<{ token: string; region: string }> {
    // Token is generated server-side only
    const response = await fetch('/api/speech/secure-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get speech token');
    }

    return response.json();
  }

  // Never store transcripts in localStorage
  async saveTranscript(transcript: string, userId: string, patientId: string): Promise<void> {
    // Save to secure server storage instead
    await fetch('/api/transcripts/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        transcript: encryptPHI(transcript),
        patientId,
        timestamp: new Date().toISOString(),
      }),
    });
  }
}
