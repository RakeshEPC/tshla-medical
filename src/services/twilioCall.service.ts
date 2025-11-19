/**
 * Twilio Call Service
 * Handles outbound phone calls for PCM AI check-ins and provider responses
 * Integrates with ElevenLabs for voice generation
 * Created: 2025-01-19
 */

export interface TwilioCallOptions {
  to: string; // Patient phone number
  from?: string; // Twilio phone number (defaults to env var)
  audioUrl?: string; // Pre-generated ElevenLabs audio to play
  twimlUrl?: string; // TwiML endpoint for dynamic call flow
  statusCallback?: string; // Webhook for call status updates
  record?: boolean; // Record the call for transcription
}

export interface TwilioCallResult {
  callSid: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  to: string;
  from: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  errorMessage?: string;
}

class TwilioCallService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private apiUrl: string;

  constructor() {
    // In production, these come from environment variables
    this.accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID || '';
    this.authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN || '';
    this.fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER || '+15551234567';
    this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
  }

  /**
   * Make an outbound call to play pre-generated audio
   * Used for provider responses
   */
  async makeOutboundCall(options: TwilioCallOptions): Promise<TwilioCallResult> {
    const { to, audioUrl, statusCallback, record = true } = options;
    const from = options.from || this.fromNumber;

    // In production, this would make actual Twilio API call
    // For demo, simulate the call
    console.log('[Twilio] Making outbound call:', { to, from, audioUrl, statusCallback });

    if (!this.accountSid || !this.authToken) {
      console.warn('[Twilio] Missing credentials - returning demo result');
      return this.simulateCall(to, from);
    }

    try {
      // Build TwiML URL that will play the audio
      const twimlUrl = this.buildPlayAudioTwiML(audioUrl);

      // Make Twilio API request
      const params = new URLSearchParams({
        To: to,
        From: from,
        Url: twimlUrl,
        ...(statusCallback && { StatusCallback: statusCallback }),
        ...(record && { Record: 'true', RecordingStatusCallback: statusCallback })
      });

      const response = await fetch(`${this.apiUrl}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twilio API error: ${error}`);
      }

      const data = await response.json();

      return {
        callSid: data.sid,
        status: data.status,
        to: data.to,
        from: data.from,
        startedAt: data.start_time,
        endedAt: data.end_time,
        duration: data.duration
      };
    } catch (error) {
      console.error('[Twilio] Call failed:', error);
      return {
        callSid: 'error-' + Date.now(),
        status: 'failed',
        to,
        from,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Initiate a conversational AI check-in call
   * Uses ElevenLabs conversational AI agent
   */
  async initiateCheckInCall(
    phoneNumber: string,
    patientName: string,
    scriptTemplate: string = 'diabetes_weekly'
  ): Promise<TwilioCallResult> {
    console.log('[Twilio] Initiating check-in call:', { phoneNumber, patientName, scriptTemplate });

    // Build TwiML that connects to ElevenLabs conversational AI
    const twimlUrl = this.buildConversationalAITwiML(patientName, scriptTemplate);

    return this.makeOutboundCall({
      to: phoneNumber,
      twimlUrl,
      statusCallback: `${window.location.origin}/api/twilio/status`,
      record: true
    });
  }

  /**
   * Get call status from Twilio
   */
  async getCallStatus(callSid: string): Promise<TwilioCallResult> {
    if (!this.accountSid || !this.authToken) {
      return this.simulateCall('', '', callSid);
    }

    try {
      const response = await fetch(`${this.apiUrl}/Calls/${callSid}.json`, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`)
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch call status');
      }

      const data = await response.json();

      return {
        callSid: data.sid,
        status: data.status,
        to: data.to,
        from: data.from,
        startedAt: data.start_time,
        endedAt: data.end_time,
        duration: data.duration
      };
    } catch (error) {
      console.error('[Twilio] Failed to get call status:', error);
      throw error;
    }
  }

  /**
   * Build TwiML URL that plays audio file
   */
  private buildPlayAudioTwiML(audioUrl?: string): string {
    if (!audioUrl) {
      // Default greeting if no audio provided
      return `${window.location.origin}/api/twilio/default-message`;
    }

    // In production, this would be a server endpoint that returns TwiML
    // TwiML format: <Response><Play>AUDIO_URL</Play></Response>
    const twiml = encodeURIComponent(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>${audioUrl}</Play>
        <Hangup/>
      </Response>
    `);

    return `data:text/xml,${twiml}`;
  }

  /**
   * Build TwiML for conversational AI
   */
  private buildConversationalAITwiML(patientName: string, scriptTemplate: string): string {
    // In production, this connects to ElevenLabs conversational AI
    // Or uses Twilio's <Stream> to send audio to your AI endpoint
    const twiml = encodeURIComponent(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">Hi ${patientName}, this is your weekly diabetes check-in from TSHLA Medical.</Say>
        <Record maxLength="300" transcribe="true" transcribeCallback="${window.location.origin}/api/twilio/transcribe"/>
        <Hangup/>
      </Response>
    `);

    return `data:text/xml,${twiml}`;
  }

  /**
   * Simulate a call for demo purposes
   */
  private simulateCall(to: string, from: string = this.fromNumber, callSid?: string): TwilioCallResult {
    const sid = callSid || 'CA' + Math.random().toString(36).substr(2, 32);

    return {
      callSid: sid,
      status: 'completed',
      to,
      from,
      startedAt: new Date().toISOString(),
      endedAt: new Date(Date.now() + 60000).toISOString(),
      duration: 60
    };
  }

  /**
   * Format phone number to E.164 format (required by Twilio)
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If doesn't start with country code, assume US (+1)
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // Already formatted or international
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    const formatted = this.formatPhoneNumber(phone);
    // E.164 format: +[country][number], 1-15 digits
    return /^\+[1-9]\d{1,14}$/.test(formatted);
  }
}

export const twilioCallService = new TwilioCallService();
