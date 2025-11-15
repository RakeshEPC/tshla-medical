/**
 * Question Generator Service
 * Generates dynamic ElevenLabs conversation scripts based on patient's conditions
 */

const { getQuestionsForPatient, endocrineQuestions } = require('../config/endocrineQuestions');

class QuestionGeneratorService {
  /**
   * Generate ElevenLabs first prompt based on patient profile
   * @param {Object} patientProfile - Patient profile from database
   * @param {Object} appointment - Appointment details (optional)
   * @returns {string} ElevenLabs first prompt
   */
  generateFirstPrompt(patientProfile, appointment = null) {
    const { patient_name, conditions } = patientProfile;

    // Get relevant question sets for this patient
    const questions = getQuestionsForPatient(conditions || []);

    let prompt = `You are Sara, a friendly medical assistant calling to prepare for the patient's upcoming appointment.\n\n`;

    // Patient context
    prompt += `PATIENT CONTEXT:\n`;
    prompt += `- Name: ${patient_name}\n`;
    if (appointment) {
      prompt += `- Appointment: ${appointment.appointment_date} at ${appointment.appointment_time}\n`;
      prompt += `- Provider: ${appointment.provider_name}\n`;
    }
    prompt += `- Known Conditions: ${conditions.join(', ')}\n\n`;

    // Greeting and confirmation
    prompt += `SCRIPT:\n\n`;
    prompt += `1. GREETING & CONFIRMATION:\n`;
    if (appointment) {
      prompt += `   "Hi, is this ${patient_name}? This is Sara from Dr. ${appointment.provider_name || 'your doctor'}'s office.\n`;
      prompt += `   I'm calling to ask a few quick questions before your appointment ${this.formatAppointmentTime(appointment.appointment_date, appointment.appointment_time)}.\n`;
      prompt += `   This should only take about 3-4 minutes. Is now a good time?"\n\n`;
    } else {
      prompt += `   "Hi, is this ${patient_name}? This is Sara from your doctor's office.\n`;
      prompt += `   I have a few quick questions to prepare for your upcoming appointment.\n`;
      prompt += `   This should take about 3-4 minutes. Is now a good time?"\n\n`;
    }

    // Condition-specific questions
    prompt += `2. CONDITION-SPECIFIC QUESTIONS:\n\n`;

    Object.entries(questions.conditions).forEach(([key, config]) => {
      prompt += `   ${config.displayName.toUpperCase()}:\n`;
      config.questions.forEach((q, idx) => {
        prompt += `   ${idx + 1}. ${q.question}\n`;
        if (q.followUp) {
          if (typeof q.followUp === 'string') {
            prompt += `      Follow-up: ${q.followUp}\n`;
          } else {
            prompt += `      If YES: ${q.followUp.true || 'Continue'}\n`;
            prompt += `      If NO: ${q.followUp.false || 'Continue'}\n`;
          }
        }
      });
      prompt += `\n`;
    });

    // Universal questions
    prompt += `3. REFILLS & CONCERNS:\n`;
    questions.universal.forEach((q, idx) => {
      prompt += `   ${idx + 1}. ${q.question}\n`;
    });

    // Instructions
    prompt += `\n`;
    prompt += `IMPORTANT INSTRUCTIONS:\n`;
    prompt += `- Keep the conversation NATURAL and CONVERSATIONAL\n`;
    prompt += `- If patient gives a vague answer, ask ONE clarifying question\n`;
    prompt += `- Don't read the questions like a script - make it flow naturally\n`;
    prompt += `- If patient says they don't know something, that's okay - move on\n`;
    prompt += `- Goal is 3-4 minutes total, so be EFFICIENT\n`;
    prompt += `- At the end say: "Perfect! That's everything. We'll see you at your appointment."\n`;

    return prompt;
  }

  /**
   * Generate tool configuration for ElevenLabs based on patient conditions
   * @param {Array<string>} conditions - Patient's conditions
   * @returns {Array<Object>} ElevenLabs tool configurations
   */
  generateToolConfig(conditions) {
    const questions = getQuestionsForPatient(conditions || []);

    const tools = [];

    // Create a tool for each condition to save structured data
    Object.entries(questions.conditions).forEach(([key, config]) => {
      const toolProperties = {};

      // Build properties based on data structure
      Object.entries(config.dataStructure).forEach(([field, type]) => {
        if (type === 'boolean') {
          toolProperties[field] = {
            type: 'boolean',
            description: `Whether ${field.replace(/_/g, ' ')}`
          };
        } else if (type === 'string') {
          toolProperties[field] = {
            type: 'string',
            description: `Patient's ${field.replace(/_/g, ' ')}`
          };
        }
      });

      tools.push({
        name: `save_${key}_data`,
        description: `Save ${config.displayName} related information from the conversation`,
        parameters: {
          type: 'object',
          properties: toolProperties
        }
      });
    });

    // Add universal tools
    tools.push({
      name: 'save_refills',
      description: 'Save list of prescription refills patient needs',
      parameters: {
        type: 'object',
        properties: {
          refills: {
            type: 'array',
            items: {
              type: 'string',
              description: 'Medication name'
            },
            description: 'List of medications needing refills'
          }
        }
      }
    });

    tools.push({
      name: 'save_concerns',
      description: 'Save patient concerns or questions for the doctor',
      parameters: {
        type: 'object',
        properties: {
          concerns: {
            type: 'array',
            items: {
              type: 'string',
              description: 'A concern or question'
            },
            description: 'Patient concerns or questions'
          }
        }
      }
    });

    return tools;
  }

  /**
   * Format appointment time in natural language
   * @param {string} date - Appointment date
   * @param {string} time - Appointment time
   * @returns {string} Formatted string
   */
  formatAppointmentTime(date, time) {
    const appointmentDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if tomorrow
    if (appointmentDate.toDateString() === tomorrow.toDateString()) {
      return `tomorrow at ${time}`;
    }

    // Check if today
    if (appointmentDate.toDateString() === today.toDateString()) {
      return `later today at ${time}`;
    }

    // Otherwise, return full date
    const dateStr = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    return `on ${dateStr} at ${time}`;
  }

  /**
   * Generate a summary of what will be asked
   * @param {Array<string>} conditions - Patient conditions
   * @returns {string} Summary text
   */
  generateQuestionSummary(conditions) {
    const questions = getQuestionsForPatient(conditions || []);

    let summary = 'Pre-visit questions will cover:\n';

    Object.values(questions.conditions).forEach(config => {
      summary += `\n${config.displayName}:\n`;
      config.questions.forEach(q => {
        summary += `  - ${q.question}\n`;
      });
    });

    summary += `\nGeneral:\n`;
    questions.universal.forEach(q => {
      summary += `  - ${q.question}\n`;
    });

    return summary;
  }

  /**
   * Estimate call duration based on conditions
   * @param {Array<string>} conditions - Patient conditions
   * @returns {number} Estimated minutes
   */
  estimateCallDuration(conditions) {
    const questions = getQuestionsForPatient(conditions || []);

    // Each condition set: ~60 seconds
    const conditionTime = Object.keys(questions.conditions).length * 1;

    // Universal questions: ~60 seconds
    const universalTime = 1;

    // Greeting and closing: ~30 seconds
    const overheadTime = 0.5;

    return Math.ceil(conditionTime + universalTime + overheadTime);
  }
}

module.exports = new QuestionGeneratorService();
