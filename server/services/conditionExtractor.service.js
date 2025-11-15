/**
 * Condition Extractor Service
 * Uses OpenAI to extract structured patient data from unstructured progress note text
 */

const axios = require('axios');

class ConditionExtractorService {
  constructor() {
    this.openaiApiKey = process.env.VITE_OPENAI_API_KEY;
    this.openaiModel = 'gpt-4o-mini'; // Fast and cost-effective for extraction
  }

  /**
   * Extract structured patient data from progress note text using AI
   * @param {string} progressNoteText - Full text from progress note PDF
   * @returns {Promise<Object>} Structured patient data
   */
  async extractPatientData(progressNoteText) {
    try {
      const prompt = this.buildExtractionPrompt(progressNoteText);

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.openaiModel,
          messages: [
            {
              role: 'system',
              content: 'You are a medical data extraction assistant. Extract structured information from progress notes and return valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0, // Deterministic extraction
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const extractedText = response.data.choices[0].message.content;
      const extractedData = JSON.parse(extractedText);

      return {
        success: true,
        data: this.normalizeExtractedData(extractedData)
      };
    } catch (error) {
      console.error('❌ AI extraction error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Build the extraction prompt for OpenAI
   * @param {string} text - Progress note text
   * @returns {string} Prompt
   */
  buildExtractionPrompt(text) {
    return `Extract the following information from this medical progress note. Return ONLY valid JSON.

PROGRESS NOTE TEXT:
${text.substring(0, 8000)}

Extract and return JSON with this EXACT structure:
{
  "patient_name": "Last, First (extract from note)",
  "patient_dob": "YYYY-MM-DD (convert to this format)",
  "patient_phone": "Extract phone number, format as +1XXXXXXXXXX",
  "patient_mrn": "Medical record number or ID",
  "patient_email": "Email if present",
  "conditions": [
    "List ONLY endocrine conditions (diabetes, thyroid, testosterone, PCOS, osteoporosis, adrenal, pituitary)",
    "Use standard names: Type 2 Diabetes, Hypothyroidism, Hyperthyroidism, Low Testosterone, PCOS, Osteoporosis, etc."
  ],
  "medications": [
    {
      "name": "Medication name only (no dose)",
      "dose": "Dose amount",
      "frequency": "How often (e.g., daily, twice daily)",
      "route": "Route (oral, injection, topical)",
      "for_condition": "Which condition this treats (if clear)"
    }
  ],
  "allergies": ["List drug allergies, or 'NKDA' if none"],
  "last_labs": {
    "a1c": "Date of last A1C if mentioned",
    "tsh": "Date of last TSH if mentioned",
    "testosterone": "Date of last testosterone level if mentioned",
    "vitamin_d": "Date of last Vitamin D if mentioned",
    "dexa_scan": "Date of last DEXA scan if mentioned"
  },
  "provider_name": "Doctor's name from note"
}

IMPORTANT RULES:
1. Extract ONLY information that is explicitly stated in the note
2. For conditions, focus on ENDOCRINE conditions only (diabetes, thyroid, hormones, bone health)
3. Skip non-endocrine conditions (hypertension, CAD, etc.) unless they directly relate to endocrine care
4. Use standard condition names:
   - "Type 2 Diabetes" (not "DM2" or "T2DM")
   - "Hypothyroidism" (not "low thyroid")
   - "Osteoporosis" (not "low bone density")
5. For medications, extract CURRENTLY ACTIVE medications only (not discontinued)
6. If a field is not found, use null (not empty string)
7. Return ONLY the JSON object, no additional text`;
  }

  /**
   * Normalize and clean extracted data
   * @param {Object} data - Raw extracted data
   * @returns {Object} Normalized data
   */
  normalizeExtractedData(data) {
    return {
      patient_name: data.patient_name || null,
      patient_dob: this.normalizeDOB(data.patient_dob),
      patient_phone: this.normalizePhone(data.patient_phone),
      patient_mrn: data.patient_mrn || null,
      patient_email: data.patient_email || null,
      conditions: this.normalizeConditions(data.conditions || []),
      medications: this.normalizeMedications(data.medications || []),
      allergies: data.allergies || [],
      last_labs: data.last_labs || {},
      provider_name: data.provider_name || null,
      extracted_at: new Date().toISOString()
    };
  }

  /**
   * Normalize date of birth to YYYY-MM-DD format
   * @param {string} dob - Date string
   * @returns {string|null} Normalized date
   */
  normalizeDOB(dob) {
    if (!dob) return null;

    try {
      // Handle MM/DD/YYYY format
      const match = dob.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // Already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        return dob;
      }

      return null;
    } catch (error) {
      console.error('DOB normalization error:', error);
      return null;
    }
  }

  /**
   * Normalize phone number to E.164 format
   * @param {string} phone - Phone number
   * @returns {string|null} Normalized phone
   */
  normalizePhone(phone) {
    if (!phone) return null;

    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Add +1 if US number without country code
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    return digits.length >= 10 ? `+${digits}` : null;
  }

  /**
   * Normalize condition names to standard format
   * @param {Array<string>} conditions - Raw conditions
   * @returns {Array<string>} Normalized conditions
   */
  normalizeConditions(conditions) {
    const conditionMap = {
      'diabetes': 'Type 2 Diabetes',
      'dm2': 'Type 2 Diabetes',
      't2dm': 'Type 2 Diabetes',
      'type 2 dm': 'Type 2 Diabetes',
      'hypothyroid': 'Hypothyroidism',
      'low thyroid': 'Hypothyroidism',
      'hyperthyroid': 'Hyperthyroidism',
      'graves': 'Hyperthyroidism (Graves Disease)',
      'hashimoto': 'Hypothyroidism (Hashimoto)',
      'low t': 'Low Testosterone',
      'hypogonadism': 'Low Testosterone',
      'pcos': 'PCOS (Polycystic Ovary Syndrome)',
      'polycystic': 'PCOS (Polycystic Ovary Syndrome)',
      'osteoporosis': 'Osteoporosis',
      'osteopenia': 'Osteopenia',
      'low bone density': 'Osteopenia',
      'adrenal insufficiency': 'Adrenal Insufficiency',
      'addison': 'Adrenal Insufficiency (Addison Disease)'
    };

    return conditions
      .map(c => {
        const lower = c.toLowerCase().trim();
        return conditionMap[lower] || c; // Return mapped or original
      })
      .filter((c, index, self) => self.indexOf(c) === index); // Remove duplicates
  }

  /**
   * Normalize medication list
   * @param {Array<Object>} medications - Raw medications
   * @returns {Array<Object>} Normalized medications
   */
  normalizeMedications(medications) {
    return medications.map(med => ({
      name: med.name || 'Unknown',
      dose: med.dose || null,
      frequency: med.frequency || null,
      route: med.route || 'oral',
      for_condition: med.for_condition || null
    }));
  }

  /**
   * Map conditions to question categories for adaptive calling
   * @param {Array<string>} conditions - Patient's conditions
   * @returns {Array<string>} Question categories to use
   */
  mapConditionsToQuestionSets(conditions) {
    const questionSets = [];

    conditions.forEach(condition => {
      const lower = condition.toLowerCase();

      if (lower.includes('diabetes')) {
        questionSets.push('diabetes');
      }
      if (lower.includes('thyroid') || lower.includes('hypothyroid') || lower.includes('hyperthyroid')) {
        questionSets.push('thyroid');
      }
      if (lower.includes('testosterone') || lower.includes('hypogonadism')) {
        questionSets.push('testosterone');
      }
      if (lower.includes('osteoporosis') || lower.includes('osteopenia')) {
        questionSets.push('osteoporosis');
      }
      if (lower.includes('pcos')) {
        questionSets.push('pcos');
      }
      if (lower.includes('adrenal')) {
        questionSets.push('adrenal');
      }
    });

    // Remove duplicates
    return [...new Set(questionSets)];
  }
}

module.exports = new ConditionExtractorService();
