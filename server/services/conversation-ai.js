import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
/**
 * TSHLA Medical Conversation AI Service
 * Azure OpenAI GPT-4 powered conversation handler
 * Handles natural dialogue, patient data extraction, and emergency detection
 */

const axios = require('axios');

class ConversationAIService {
  constructor() {
    this.conversationHistory = new Map(); // Store conversation state per call
    this.azureOpenAIEndpoint =
      process.env.VITE_AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
    this.azureOpenAIKey = process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_KEY;
    this.azureOpenAIDeployment =
      process.env.VITE_AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    this.azureOpenAIVersion =
      process.env.VITE_AZURE_OPENAI_API_VERSION ||
      process.env.AZURE_OPENAI_API_VERSION ||
      '2024-02-01';

    logInfo('conversation-ai', '$1', $2);
    logDebug('conversation-ai', '$1', $2);
    logDebug('conversation-ai', '$1', $2);
    logDebug('conversation-ai', '$1', $2);
    logDebug('conversation-ai', '$1', $2);

    // Start periodic cleanup to prevent conversation buildup
    this.startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup of stale conversations (every 5 minutes)
   */
  startPeriodicCleanup() {
    setInterval(
      () => {
        this.cleanupStaleConversations();
      },
      5 * 60 * 1000
    ); // 5 minutes

    logDebug('conversation-ai', '$1', $2);
  }

  /**
   * Clean up conversations older than 30 minutes
   */
  cleanupStaleConversations() {
    const now = new Date();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    let cleaned = 0;

    for (const [callSid, conversation] of this.conversationHistory.entries()) {
      const age = now - new Date(conversation.startTime);

      if (age > staleThreshold) {
        logDebug('conversation-ai', '$1', $2);
        this.conversationHistory.delete(callSid);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logInfo('conversation-ai', '$1', $2);
    }
  }

  /**
   * Start a new conversation session (with conversation isolation)
   */
  startConversation(callSid, fromNumber, toNumber) {
    // CRITICAL: Always clear existing conversation with same CallSid to prevent persistence
    if (this.conversationHistory.has(callSid)) {
      logDebug('conversation-ai', '$1', $2);
      this.conversationHistory.delete(callSid);
    }

    const conversation = {
      callSid,
      fromNumber,
      toNumber,
      startTime: new Date(),
      messages: [],
      extractedData: {
        patientName: null,
        dateOfBirth: null,
        phoneNumber: fromNumber,
        reasonForCall: null,
        appointmentType: null,
        preferredProvider: null,
        isExistingPatient: null,
        urgencyLevel: 'routine',
        language: 'english',
        isEmergency: false,
      },
      conversationState: 'greeting',
      needsMoreInfo: [],
      createdAt: new Date().toISOString(), // For timeout cleanup
    };

    this.conversationHistory.set(callSid, conversation);
    logDebug('conversation-ai', '$1', $2);

    return this.generateGreeting(conversation);
  }

  /**
   * Generate initial greeting based on time of day and language detection
   */
  async generateGreeting(conversation) {
    const hour = new Date().getHours();
    let greeting;

    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    const message = `${greeting}! Thanks for calling E.P.C. My name is Sarah. How can I help you today?`;

    // Add system message to conversation
    conversation.messages.push({
      role: 'system',
      content: this.getSystemPrompt(),
    });

    conversation.messages.push({
      role: 'assistant',
      content: message,
    });

    return {
      message,
      conversationState: 'listening',
      extractedData: conversation.extractedData,
    };
  }

  /**
   * Process user input and generate response
   */
  async processUserInput(callSid, userInput, audioTranscript = null) {
    const conversation = this.conversationHistory.get(callSid);
    if (!conversation) {
      throw new Error(`No conversation found for call ${callSid}`);
    }

    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: userInput,
    });

    try {
      // Generate AI response using Azure OpenAI REST API
      const response = await axios.post(
        `${this.azureOpenAIEndpoint}openai/deployments/${this.azureOpenAIDeployment}/chat/completions?api-version=${this.azureOpenAIVersion}`,
        {
          messages: conversation.messages,
          max_tokens: 300,
          temperature: 0.7,
          frequency_penalty: 0.3,
          presence_penalty: 0.1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.azureOpenAIKey,
          },
        }
      );

      const aiMessage = response.data.choices[0].message.content;

      // Add AI response to conversation
      conversation.messages.push({
        role: 'assistant',
        content: aiMessage,
      });

      // Extract patient data from conversation
      const extractedInfo = await this.extractPatientData(conversation);
      Object.assign(conversation.extractedData, extractedInfo);

      // Check for emergency keywords
      const emergencyCheck = this.checkForEmergency(userInput);
      if (emergencyCheck.isEmergency) {
        conversation.extractedData.isEmergency = true;
        conversation.extractedData.urgencyLevel = 'emergency';
        logDebug('conversation-ai', '$1', $2);
      }

      // Update conversation state
      this.updateConversationState(conversation);

      return {
        message: aiMessage,
        conversationState: conversation.conversationState,
        extractedData: conversation.extractedData,
        isEmergency: emergencyCheck.isEmergency,
        emergencyReason: emergencyCheck.reason,
      };
    } catch (error) {
      logError('conversation-ai', '$1', $2);

      // Fallback response
      const fallbackMessage =
        "I apologize, but I'm having a technical issue right now. " +
        'Let me connect you with our staff who can help you directly. Please hold on.';

      return {
        message: fallbackMessage,
        conversationState: 'technical_error',
        extractedData: conversation.extractedData,
        isEmergency: false,
      };
    }
  }

  /**
   * Extract patient data from conversation using AI
   */
  async extractPatientData(conversation) {
    const extractionPrompt = `
        Based on the conversation, extract the following patient information if available:
        - Patient name (full name if provided)
        - Date of birth (any format)
        - Reason for call
        - Appointment type (new patient, follow-up, urgent, routine)
        - Preferred provider (Dr. Patel, Dr. Watwe, Shannon, Tess)
        - Language preference (detected from conversation)
        - Is this an existing patient or new patient?
        
        Return only a JSON object with the extracted information. Use null for missing information.
        `;

    try {
      const extractionMessages = [
        {
          role: 'system',
          content: extractionPrompt,
        },
        {
          role: 'user',
          content: conversation.messages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join('\n'),
        },
      ];

      const response = await axios.post(
        `${this.azureOpenAIEndpoint}openai/deployments/${this.azureOpenAIDeployment}/chat/completions?api-version=${this.azureOpenAIVersion}`,
        {
          messages: extractionMessages,
          max_tokens: 200,
          temperature: 0.1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.azureOpenAIKey,
          },
        }
      );

      const extractedText = response.data.choices[0].message.content;
      return JSON.parse(extractedText.replace(/```json|```/g, ''));
    } catch (error) {
      logError('conversation-ai', '$1', $2);
      return {}; // Return empty object if extraction fails
    }
  }

  /**
   * Check for emergency keywords and situations
   */
  checkForEmergency(userInput) {
    const emergencyKeywords = [
      'emergency',
      'urgent',
      'chest pain',
      'heart attack',
      'stroke',
      'bleeding',
      "can't breathe",
      'difficulty breathing',
      'unconscious',
      'suicide',
      'overdose',
      'severe pain',
      'accident',
      'injury',
      'blood sugar',
      'diabetic emergency',
      'seizure',
      'allergic reaction',
      'emergencia',
      'urgente',
      'dolor de pecho',
      'no puedo respirar',
    ];

    const input = userInput.toLowerCase();
    const foundKeywords = emergencyKeywords.filter(keyword =>
      input.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length > 0) {
      return {
        isEmergency: true,
        reason: `Emergency keywords detected: ${foundKeywords.join(', ')}`,
      };
    }

    return { isEmergency: false, reason: null };
  }

  /**
   * Update conversation state based on extracted information
   */
  updateConversationState(conversation) {
    const data = conversation.extractedData;

    // Determine what information we still need
    const missingInfo = [];
    if (!data.patientName) missingInfo.push('name');
    if (!data.dateOfBirth) missingInfo.push('date of birth');
    if (!data.reasonForCall) missingInfo.push('reason for call');

    conversation.needsMoreInfo = missingInfo;

    // Update conversation state
    if (data.isEmergency) {
      conversation.conversationState = 'emergency';
    } else if (missingInfo.length === 0) {
      conversation.conversationState = 'information_complete';
    } else {
      conversation.conversationState = 'collecting_information';
    }
  }

  /**
   * Get system prompt for Azure OpenAI
   */
  getSystemPrompt() {
    return `You are Sarah, a friendly and professional AI assistant for E.P.C. You help patients with:

PERSONALITY:
- Warm, friendly, and conversational tone
- Professional but not robotic
- Empathetic and understanding
- Efficient and direct - no unnecessary repetition
- Bilingual (English/Spanish) - detect language and respond accordingly

OFFICE INFORMATION:
- Office Hours: 8 AM - 5 PM, Monday-Friday
- Providers: Dr. Patel, Dr. Watwe, Shannon, Tess
- Appointment Types: 15-minute follow-ups, 30-minute new patient visits

YOUR TASKS:
1. Greet callers warmly and naturally
2. Understand their needs (appointment, message, question)
3. Collect required information: Name, Date of Birth, Reason for call
4. Determine appointment type and preferred provider
5. Handle emergencies by instructing to call 911 immediately
6. Schedule appointment requests or take detailed messages
7. Provide confirmation and next steps

CONVERSATION GUIDELINES:
- Be direct and concise - DO NOT repeat or summarize what the patient just told you
- Ask for information naturally, one question at a time
- If someone mentions chest pain, bleeding, or emergency - tell them to call 911 immediately
- For appointment requests, ask about preferred provider and dates
- For messages, get details about their concern
- ONLY confirm information ONCE at the very end when all details are collected
- End with clear next steps

CRITICAL RULE: Never say things like "I understand you said..." or "Let me help you with that..." - just ask the next question directly.

Remember: You're efficient, caring, and direct. No repetitive summarizing during conversation.`;
  }

  /**
   * Generate emergency response
   */
  generateEmergencyResponse() {
    return {
      message:
        'I understand this is urgent. For any medical emergency, please hang up now and call 911 immediately. ' +
        'If this is not a life-threatening emergency but you need urgent medical attention, you can also go to your nearest emergency room. ' +
        'Our office will follow up with you, but please get immediate medical care first.',
      conversationState: 'emergency',
      isEmergency: true,
      shouldEndCall: true,
    };
  }

  /**
   * Get conversation summary for database storage
   */
  getConversationSummary(callSid) {
    const conversation = this.conversationHistory.get(callSid);
    if (!conversation) return null;

    return {
      callSid: conversation.callSid,
      fromNumber: conversation.fromNumber,
      duration: Math.floor((new Date() - conversation.startTime) / 1000),
      messageCount: conversation.messages.length,
      extractedData: conversation.extractedData,
      conversationState: conversation.conversationState,
      transcript: conversation.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      summary: this.generateConversationSummary(conversation),
    };
  }

  /**
   * Generate a brief summary of the conversation
   */
  generateConversationSummary(conversation) {
    const data = conversation.extractedData;
    let summary = `Patient called TSHLA Medical. `;

    if (data.patientName) summary += `Name: ${data.patientName}. `;
    if (data.reasonForCall) summary += `Reason: ${data.reasonForCall}. `;
    if (data.appointmentType) summary += `Requested: ${data.appointmentType}. `;
    if (data.preferredProvider) summary += `Provider: ${data.preferredProvider}. `;
    if (data.isEmergency) summary += `⚠️ EMERGENCY CALL - instructed to call 911. `;

    summary += `Status: ${conversation.conversationState}.`;

    return summary;
  }

  /**
   * Generate AI summary for completed call with transcript
   */
  async generateSummary(callSid, transcript, extractedData) {
    try {
      logDebug('conversation-ai', '$1', $2);

      // Create context for AI summary
      const transcriptText = Array.isArray(transcript)
        ? transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')
        : transcript;

      const summaryMessages = [
        {
          role: 'system',
          content: `You are analyzing a completed phone call to TSHLA Medical. Generate a comprehensive summary including:

1. PATIENT INFORMATION (if available)
2. REASON FOR CALL
3. KEY DISCUSSION POINTS
4. NEXT STEPS/ACTION ITEMS
5. URGENCY LEVEL
6. APPOINTMENT NEEDS

Format as JSON with these fields:
- summary: Brief professional summary
- actionItems: Array of specific actions needed
- extractedData: Patient info, contact details, medical concerns
- urgencyLevel: "routine", "urgent", or "emergency"
- appointmentType: Type of appointment needed if any

Be concise but thorough. Focus on actionable information.`,
        },
        {
          role: 'user',
          content: `Call transcript:\n${transcriptText}\n\nPreviously extracted data: ${JSON.stringify(extractedData)}`,
        },
      ];

      const response = await axios.post(
        `${this.azureOpenAIEndpoint}openai/deployments/${this.azureOpenAIDeployment}/chat/completions?api-version=${this.azureOpenAIVersion}`,
        {
          messages: summaryMessages,
          max_tokens: 800,
          temperature: 0.1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.azureOpenAIKey,
          },
        }
      );

      const summaryText = response.data.choices[0].message.content;
      const summaryData = JSON.parse(summaryText.replace(/```json|```/g, ''));

      logInfo('conversation-ai', '$1', $2);
      return summaryData;
    } catch (error) {
      logError('conversation-ai', '$1', $2);
      // Return fallback summary
      return {
        summary: 'Phone call completed. Please review transcript for details.',
        actionItems: ['Review call transcript', 'Follow up as needed'],
        extractedData: extractedData || {},
        urgencyLevel: 'routine',
        appointmentType: 'Follow-up needed',
      };
    }
  }

  /**
   * Clean up conversation data
   */
  endConversation(callSid) {
    const conversation = this.conversationHistory.get(callSid);
    const summary = this.getConversationSummary(callSid);

    if (conversation) {
      this.conversationHistory.delete(callSid);
      logInfo('conversation-ai', '$1', $2);
    } else {
      logDebug('conversation-ai', '$1', $2);
    }

    return summary;
  }

  /**
   * Get debug info about current conversations
   */
  getDebugInfo() {
    const conversations = Array.from(this.conversationHistory.entries()).map(([callSid, conv]) => ({
      callSid,
      fromNumber: conv.fromNumber,
      startTime: conv.startTime,
      age: Math.floor((new Date() - new Date(conv.startTime)) / 60000), // minutes
      messageCount: conv.messages.length,
      state: conv.conversationState,
    }));

    return {
      totalConversations: this.conversationHistory.size,
      conversations,
    };
  }
}

module.exports = new ConversationAIService();
