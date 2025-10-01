import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
/**
 * TSHLA Medical Patient Extraction & Smart Lookup Service
 * Handles patient identification, data extraction, and database lookup
 */

const mysql = require('mysql2/promise');

class PatientExtractionService {
  constructor() {
    this.providers = ['Dr. Patel', 'Dr. Watwe', 'Shannon', 'Tess'];
    this.appointmentTypes = {
      'new patient': { duration: 30, type: 'new' },
      'follow up': { duration: 15, type: 'followup' },
      'follow-up': { duration: 15, type: 'followup' },
      routine: { duration: 15, type: 'followup' },
      'check up': { duration: 15, type: 'followup' },
      urgent: { duration: 30, type: 'urgent' },
      emergency: { duration: 30, type: 'emergency' },
    };
  }

  /**
   * Smart phone number lookup - check if patient exists in communication logs
   */
  async lookupPatientByPhone(phoneNumber) {
    try {
      // For now, return new patient since we don't have a patients table
      // We'll use the communication logs to track repeat callers
      logDebug('patient-extraction', '$1', $2);

      return {
        isExisting: false,
        patient: null,
        lastProvider: null,
        callHistory: [],
      };

      /* 
            // Future implementation when patients table exists:
            // Create database connection
            const connection = await this.getDatabaseConnection();
            
            // Clean phone number (remove formatting)
            const cleanPhone = this.cleanPhoneNumber(phoneNumber);
            
            // Search for patient by phone number
            const [rows] = await connection.execute(
                'SELECT * FROM patients WHERE phone_number = ? OR phone_number = ? LIMIT 1',
                [phoneNumber, cleanPhone]
            );
            
            await connection.end();
            
            if (rows.length > 0) {
                const patient = rows[0];
                logInfo('patient-extraction', '$1', $2);
                
                // Get last provider seen
                const lastProvider = await this.getLastProviderSeen(patient.id);
                
                return {
                    isExisting: true,
                    patient: {
                        id: patient.id,
                        name: `${patient.first_name} ${patient.last_name}`,
                        firstName: patient.first_name,
                        lastName: patient.last_name,
                        dateOfBirth: patient.date_of_birth,
                        phoneNumber: patient.phone_number,
                        email: patient.email,
                        insuranceProvider: patient.insurance_provider,
                        insurancePolicyNumber: patient.insurance_policy_number
                    },
                    lastProvider,
                    callHistory: []
                };
            }
            
            return { isExisting: false, patient: null };
            */
    } catch (error) {
      logError('patient-extraction', '$1', $2);
      return { isExisting: false, patient: null, error: error.message };
    }
  }

  /**
   * Get database connection
   */
  async getDatabaseConnection() {
    const mysql = require('mysql2/promise');
    return await mysql.createConnection({
      host: process.env.AZURE_MYSQL_HOST || 'tshla-mysql-staging.mysql.database.azure.com',
      user: process.env.AZURE_MYSQL_USER || 'tshlaadmin',
      password: process.env.AZURE_MYSQL_PASSWORD || 'TshlaSecure2025!',
      database: process.env.AZURE_MYSQL_DATABASE || 'tshla_medical_staging',
      ssl: { rejectUnauthorized: false },
    });
  }

  /**
   * Get last provider patient saw
   */
  async getLastProviderSeen(patientId) {
    try {
      const connection = await this.getDatabaseConnection();

      const [rows] = await connection.execute(
        `
                SELECT provider_name 
                FROM appointments 
                WHERE patient_id = ? AND status IN ('completed', 'confirmed')
                ORDER BY appointment_date DESC 
                LIMIT 1
            `,
        [patientId]
      );

      await connection.end();

      return rows.length > 0 ? rows[0].provider_name : null;
    } catch (error) {
      logError('patient-extraction', '$1', $2);
      return null;
    }
  }

  /**
   * Extract and validate patient information from conversation
   */
  extractPatientInfo(conversationData, existingPatient = null) {
    const extracted = {
      name: null,
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      phoneNumber: conversationData.fromNumber,
      reasonForCall: null,
      appointmentType: null,
      preferredProvider: null,
      urgencyLevel: 'routine',
      language: 'english',
      isExistingPatient: existingPatient ? true : false,
      confidence: 0,
    };

    // If existing patient, use known data
    if (existingPatient) {
      extracted.name = existingPatient.name;
      extracted.firstName = existingPatient.firstName;
      extracted.lastName = existingPatient.lastName;
      extracted.dateOfBirth = existingPatient.dateOfBirth;
      extracted.preferredProvider = existingPatient.lastProviderSeen;
      extracted.confidence += 40; // High confidence for existing patient
    }

    // Extract name from conversation
    const nameMatch = this.extractName(conversationData.transcript);
    if (nameMatch && !existingPatient) {
      extracted.name = nameMatch.fullName;
      extracted.firstName = nameMatch.firstName;
      extracted.lastName = nameMatch.lastName;
      extracted.confidence += 20;
    }

    // Extract date of birth
    const dobMatch = this.extractDateOfBirth(conversationData.transcript);
    if (dobMatch) {
      extracted.dateOfBirth = dobMatch;
      extracted.confidence += 15;
    }

    // Extract reason for call
    const reasonMatch = this.extractReasonForCall(conversationData.transcript);
    if (reasonMatch) {
      extracted.reasonForCall = reasonMatch;
      extracted.confidence += 10;
    }

    // Extract appointment type
    const appointmentMatch = this.extractAppointmentType(conversationData.transcript);
    if (appointmentMatch) {
      extracted.appointmentType = appointmentMatch.type;
      extracted.urgencyLevel = appointmentMatch.urgency;
      extracted.confidence += 10;
    }

    // Extract preferred provider
    const providerMatch = this.extractPreferredProvider(conversationData.transcript);
    if (providerMatch) {
      extracted.preferredProvider = providerMatch;
      extracted.confidence += 5;
    }

    // Detect language
    const languageDetection = this.detectLanguage(conversationData.transcript);
    extracted.language = languageDetection;

    return extracted;
  }

  /**
   * Extract name from conversation text
   */
  extractName(transcript) {
    const namePatterns = [
      /(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /(?:name\s*[:\-]?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:calling|here)/i,
    ];

    for (const pattern of namePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        const fullName = match[1].trim();
        const nameParts = fullName.split(' ');
        return {
          fullName,
          firstName: nameParts[0],
          lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : null,
        };
      }
    }

    return null;
  }

  /**
   * Extract date of birth from conversation
   */
  extractDateOfBirth(transcript) {
    const dobPatterns = [
      /(?:born|birth|dob|date of birth).*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
      /(?:born|birth).*?(\w+\s+\d{1,2},?\s+\d{4})/i,
      /(\w+\s+\d{1,2},?\s+\d{4})/i,
    ];

    for (const pattern of dobPatterns) {
      const match = transcript.match(pattern);
      if (match) {
        return this.normalizeDateOfBirth(match[1]);
      }
    }

    return null;
  }

  /**
   * Extract reason for call from conversation
   */
  extractReasonForCall(transcript) {
    const reasonPatterns = [
      /(?:calling (?:about|for|because)|need to|want to|reason).*?([^.!?]{10,100})/i,
      /(?:i have|feeling|experiencing|problem with).*?([^.!?]{10,100})/i,
      /(?:appointment|visit|see|check).*?([^.!?]{10,100})/i,
    ];

    for (const pattern of reasonPatterns) {
      const match = transcript.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: look for medical keywords
    const medicalKeywords = [
      'appointment',
      'checkup',
      'follow up',
      'medication',
      'prescription',
      'pain',
      'diabetes',
      'blood sugar',
      'insulin',
      'thyroid',
      'weight',
      'test results',
      'lab work',
      'consultation',
      'second opinion',
    ];

    const lowerTranscript = transcript.toLowerCase();
    const foundKeywords = medicalKeywords.filter(keyword => lowerTranscript.includes(keyword));

    if (foundKeywords.length > 0) {
      return `Medical concern: ${foundKeywords.join(', ')}`;
    }

    return 'General inquiry';
  }

  /**
   * Extract appointment type from conversation
   */
  extractAppointmentType(transcript) {
    const lowerTranscript = transcript.toLowerCase();

    // Check for emergency keywords first
    const emergencyKeywords = [
      'emergency',
      'urgent',
      'chest pain',
      'bleeding',
      "can't breathe",
      'severe pain',
      'heart attack',
      'stroke',
      'seizure',
    ];

    for (const keyword of emergencyKeywords) {
      if (lowerTranscript.includes(keyword)) {
        return { type: 'emergency', urgency: 'emergency' };
      }
    }

    // Check for appointment types
    for (const [typeKey, typeData] of Object.entries(this.appointmentTypes)) {
      if (lowerTranscript.includes(typeKey)) {
        return {
          type: typeKey,
          urgency: typeData.type === 'urgent' ? 'urgent' : 'routine',
          duration: typeData.duration,
        };
      }
    }

    // Default based on context
    if (lowerTranscript.includes('new') || lowerTranscript.includes('first time')) {
      return { type: 'new patient', urgency: 'routine', duration: 30 };
    }

    return { type: 'follow up', urgency: 'routine', duration: 15 };
  }

  /**
   * Extract preferred provider from conversation
   */
  extractPreferredProvider(transcript) {
    const lowerTranscript = transcript.toLowerCase();

    for (const provider of this.providers) {
      const lowerProvider = provider.toLowerCase();
      if (lowerTranscript.includes(lowerProvider)) {
        return provider;
      }

      // Check for partial matches (e.g., "patel" for "Dr. Patel")
      const providerParts = provider.toLowerCase().split(' ');
      for (const part of providerParts) {
        if (part.length > 2 && lowerTranscript.includes(part)) {
          return provider;
        }
      }
    }

    return null;
  }

  /**
   * Detect language from conversation
   */
  detectLanguage(transcript) {
    const spanishKeywords = [
      'hola',
      'gracias',
      'por favor',
      'disculpe',
      'necesito',
      'quiero',
      'cita',
      'doctor',
      'medicina',
      'dolor',
      'emergencia',
      'ayuda',
      'español',
      'habla español',
    ];

    const lowerTranscript = transcript.toLowerCase();
    const spanishWordCount = spanishKeywords.filter(word => lowerTranscript.includes(word)).length;

    return spanishWordCount >= 2 ? 'spanish' : 'english';
  }

  /**
   * Normalize date of birth to standard format
   */
  normalizeDateOfBirth(dateString) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
    } catch (error) {
      logError('patient-extraction', '$1', $2);
    }

    return dateString; // Return original if parsing fails
  }

  /**
   * Clean phone number to standard format
   */
  cleanPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/[^\d]/g, '');
  }

  /**
   * Get database connection
   */
  async getDatabaseConnection() {
    return mysql.createConnection({
      host: process.env.AZURE_MYSQL_HOST || 'tshla-mysql-staging.mysql.database.azure.com',
      port: process.env.AZURE_MYSQL_PORT || 3306,
      database: process.env.AZURE_MYSQL_DATABASE || 'tshla_medical_staging',
      user: process.env.AZURE_MYSQL_USER || 'azureadmin',
      password: process.env.AZURE_MYSQL_PASSWORD || 'TshlaSecure2025!',
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Validate extracted patient information
   */
  validatePatientInfo(extractedInfo) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      missingRequired: [],
    };

    // Check required fields
    if (!extractedInfo.name && !extractedInfo.firstName) {
      validation.missingRequired.push('name');
    }

    if (!extractedInfo.dateOfBirth) {
      validation.missingRequired.push('date of birth');
    }

    if (!extractedInfo.reasonForCall) {
      validation.missingRequired.push('reason for call');
    }

    // Validate phone number format
    if (extractedInfo.phoneNumber && !this.isValidPhoneNumber(extractedInfo.phoneNumber)) {
      validation.warnings.push('Phone number format may be incorrect');
    }

    // Validate date of birth format
    if (extractedInfo.dateOfBirth && !this.isValidDate(extractedInfo.dateOfBirth)) {
      validation.errors.push('Date of birth format is invalid');
      validation.isValid = false;
    }

    // Set overall validation status
    if (validation.missingRequired.length > 0) {
      validation.warnings.push(
        `Missing required information: ${validation.missingRequired.join(', ')}`
      );
    }

    return validation;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone) {
    const phoneRegex = /^[\+]?[1]?[\s\-\.]?\(?[0-9]{3}\)?[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate date format
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date < new Date();
  }
}

module.exports = new PatientExtractionService();
