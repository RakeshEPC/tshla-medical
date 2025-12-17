/**
 * CCD XML Parser Service
 * Parses HL7 CCD/C-CDA (Continuity of Care Document) XML files
 * Extracts structured medical data: demographics, medications, conditions, allergies, labs
 *
 * Supports:
 * - CCD (Continuity of Care Document)
 * - C-CDA (Consolidated Clinical Document Architecture)
 * - HL7 v3
 */

const { DOMParser } = require('@xmldom/xmldom');

class CCDXMLParserService {
  constructor() {
    this.namespaces = {
      hl7: 'urn:hl7-org:v3',
      xsi: 'http://www.w3.org/2001/XMLSchema-instance'
    };
  }

  /**
   * Parse CCD XML and extract all relevant data
   * @param {string} xmlString - CCD XML content
   * @returns {Object} Extracted structured data
   */
  parseCCD(xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        throw new Error('Invalid XML format');
      }

      console.log('📄 Parsing CCD XML document...');

      const extractedData = {
        demographics: this.extractDemographics(xmlDoc),
        medications: this.extractMedications(xmlDoc),
        conditions: this.extractConditions(xmlDoc),
        allergies: this.extractAllergies(xmlDoc),
        labs: this.extractLabs(xmlDoc),
        vitals: this.extractVitals(xmlDoc),
        immunizations: this.extractImmunizations(xmlDoc),
        procedures: this.extractProcedures(xmlDoc),
        documentInfo: this.extractDocumentInfo(xmlDoc)
      };

      console.log('✅ CCD parsing complete');
      console.log(`   - Demographics: ${extractedData.demographics ? 'Found' : 'Not found'}`);
      console.log(`   - Medications: ${extractedData.medications.length} items`);
      console.log(`   - Conditions: ${extractedData.conditions.length} items`);
      console.log(`   - Allergies: ${extractedData.allergies.length} items`);
      console.log(`   - Labs: ${extractedData.labs.length} items`);

      return extractedData;
    } catch (error) {
      console.error('❌ CCD parsing error:', error);
      throw new Error(`Failed to parse CCD: ${error.message}`);
    }
  }

  /**
   * Extract patient demographics
   */
  extractDemographics(xmlDoc) {
    try {
      const recordTarget = xmlDoc.getElementsByTagName('recordTarget')[0];
      if (!recordTarget) return null;

      const patientRole = recordTarget.getElementsByTagName('patientRole')[0];
      if (!patientRole) return null;

      const patient = patientRole.getElementsByTagName('patient')[0];
      const addr = patientRole.getElementsByTagName('addr')[0];
      const telecom = patientRole.getElementsByTagName('telecom');

      // Extract name
      const name = patient.getElementsByTagName('name')[0];
      const given = name?.getElementsByTagName('given')[0]?.textContent || '';
      const family = name?.getElementsByTagName('family')[0]?.textContent || '';

      // Extract birth date
      const birthTime = patient.getElementsByTagName('birthTime')[0];
      const dob = birthTime?.getAttribute('value');

      // Extract gender
      const administrativeGender = patient.getElementsByTagName('administrativeGenderCode')[0];
      const gender = administrativeGender?.getAttribute('displayName') ||
                    administrativeGender?.getAttribute('code');

      // Extract address
      let address = null;
      if (addr) {
        const streetAddressLine = addr.getElementsByTagName('streetAddressLine')[0]?.textContent;
        const city = addr.getElementsByTagName('city')[0]?.textContent;
        const state = addr.getElementsByTagName('state')[0]?.textContent;
        const postalCode = addr.getElementsByTagName('postalCode')[0]?.textContent;

        address = {
          street: streetAddressLine,
          city,
          state,
          zipCode: postalCode
        };
      }

      // Extract phone and email
      let phone = null;
      let email = null;
      for (let i = 0; i < telecom.length; i++) {
        const value = telecom[i].getAttribute('value');
        if (value?.startsWith('tel:')) {
          phone = value.replace('tel:', '');
        } else if (value?.startsWith('mailto:')) {
          email = value.replace('mailto:', '');
        }
      }

      // Extract MRN (Medical Record Number)
      const id = patientRole.getElementsByTagName('id')[0];
      const mrn = id?.getAttribute('extension');

      return {
        firstName: given,
        lastName: family,
        fullName: `${given} ${family}`.trim(),
        dateOfBirth: this.formatDate(dob),
        gender,
        mrn,
        phone,
        email,
        address
      };
    } catch (error) {
      console.error('Error extracting demographics:', error);
      return null;
    }
  }

  /**
   * Extract medications
   */
  extractMedications(xmlDoc) {
    try {
      const medications = [];
      const medicationSections = this.getSectionByCode(xmlDoc, '10160-0'); // Medications code

      if (!medicationSections || medicationSections.length === 0) return medications;

      const entries = medicationSections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const manufacturedMaterial = entry.getElementsByTagName('manufacturedMaterial')[0];

        if (manufacturedMaterial) {
          const code = manufacturedMaterial.getElementsByTagName('code')[0];
          const name = code?.getAttribute('displayName') ||
                      manufacturedMaterial.getElementsByTagName('name')[0]?.textContent;

          // Extract dosage
          const doseQuantity = entry.getElementsByTagName('doseQuantity')[0];
          const dose = doseQuantity?.getAttribute('value') + ' ' +
                      doseQuantity?.getAttribute('unit');

          // Extract frequency
          const effectiveTime = entry.getElementsByTagName('effectiveTime');
          let frequency = null;
          for (let j = 0; j < effectiveTime.length; j++) {
            const period = effectiveTime[j].getElementsByTagName('period')[0];
            if (period) {
              const value = period.getAttribute('value');
              const unit = period.getAttribute('unit');
              frequency = `Every ${value} ${unit}`;
            }
          }

          medications.push({
            name: name || 'Unknown medication',
            dose: dose?.trim() || null,
            frequency: frequency,
            code: code?.getAttribute('code') || null
          });
        }
      }

      return medications;
    } catch (error) {
      console.error('Error extracting medications:', error);
      return [];
    }
  }

  /**
   * Extract conditions/problems
   */
  extractConditions(xmlDoc) {
    try {
      const conditions = [];
      const problemSections = this.getSectionByCode(xmlDoc, '11450-4'); // Problem list code

      if (!problemSections || problemSections.length === 0) return conditions;

      const entries = problemSections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const value = entry.getElementsByTagName('value')[0];

        if (value) {
          const name = value.getAttribute('displayName');
          const code = value.getAttribute('code');
          const codeSystem = value.getAttribute('codeSystemName');

          // Extract status (active/resolved)
          const statusCode = entry.getElementsByTagName('statusCode')[0];
          const status = statusCode?.getAttribute('code');

          conditions.push({
            name: name || 'Unknown condition',
            code: code,
            codeSystem: codeSystem,
            status: status === 'completed' ? 'resolved' : 'active'
          });
        }
      }

      return conditions;
    } catch (error) {
      console.error('Error extracting conditions:', error);
      return [];
    }
  }

  /**
   * Extract allergies
   */
  extractAllergies(xmlDoc) {
    try {
      const allergies = [];
      const allergySections = this.getSectionByCode(xmlDoc, '48765-2'); // Allergies code

      if (!allergySections || allergySections.length === 0) return allergies;

      const entries = allergySections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const participant = entry.getElementsByTagName('participant')[0];

        if (participant) {
          const code = participant.getElementsByTagName('code')[0];
          const name = code?.getAttribute('displayName') ||
                      participant.getElementsByTagName('name')[0]?.textContent;

          // Extract reaction
          const value = entry.getElementsByTagName('value')[0];
          const reaction = value?.getAttribute('displayName');

          allergies.push({
            allergen: name || 'Unknown allergen',
            reaction: reaction || 'Not specified',
            code: code?.getAttribute('code')
          });
        }
      }

      return allergies;
    } catch (error) {
      console.error('Error extracting allergies:', error);
      return [];
    }
  }

  /**
   * Extract lab results
   */
  extractLabs(xmlDoc) {
    try {
      const labs = [];
      const labSections = this.getSectionByCode(xmlDoc, '30954-2'); // Lab results code

      if (!labSections || labSections.length === 0) return labs;

      const entries = labSections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const code = entry.getElementsByTagName('code')[0];
        const value = entry.getElementsByTagName('value')[0];
        const effectiveTime = entry.getElementsByTagName('effectiveTime')[0];

        if (code && value) {
          labs.push({
            name: code.getAttribute('displayName') || 'Unknown test',
            value: value.getAttribute('value'),
            unit: value.getAttribute('unit'),
            date: this.formatDate(effectiveTime?.getAttribute('value')),
            code: code.getAttribute('code')
          });
        }
      }

      return labs;
    } catch (error) {
      console.error('Error extracting labs:', error);
      return [];
    }
  }

  /**
   * Extract vital signs
   */
  extractVitals(xmlDoc) {
    try {
      const vitals = [];
      const vitalSections = this.getSectionByCode(xmlDoc, '8716-3'); // Vital signs code

      if (!vitalSections || vitalSections.length === 0) return vitals;

      const entries = vitalSections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const code = entry.getElementsByTagName('code')[0];
        const value = entry.getElementsByTagName('value')[0];

        if (code && value) {
          vitals.push({
            name: code.getAttribute('displayName') || 'Unknown vital',
            value: value.getAttribute('value'),
            unit: value.getAttribute('unit')
          });
        }
      }

      return vitals;
    } catch (error) {
      console.error('Error extracting vitals:', error);
      return [];
    }
  }

  /**
   * Extract immunizations
   */
  extractImmunizations(xmlDoc) {
    try {
      const immunizations = [];
      const immunizationSections = this.getSectionByCode(xmlDoc, '11369-6'); // Immunizations code

      if (!immunizationSections || immunizationSections.length === 0) return immunizations;

      const entries = immunizationSections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const manufacturedMaterial = entry.getElementsByTagName('manufacturedMaterial')[0];
        const effectiveTime = entry.getElementsByTagName('effectiveTime')[0];

        if (manufacturedMaterial) {
          const code = manufacturedMaterial.getElementsByTagName('code')[0];
          const name = code?.getAttribute('displayName');

          immunizations.push({
            name: name || 'Unknown immunization',
            date: this.formatDate(effectiveTime?.getAttribute('value'))
          });
        }
      }

      return immunizations;
    } catch (error) {
      console.error('Error extracting immunizations:', error);
      return [];
    }
  }

  /**
   * Extract procedures
   */
  extractProcedures(xmlDoc) {
    try {
      const procedures = [];
      const procedureSections = this.getSectionByCode(xmlDoc, '47519-4'); // Procedures code

      if (!procedureSections || procedureSections.length === 0) return procedures;

      const entries = procedureSections[0].getElementsByTagName('entry');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const code = entry.getElementsByTagName('code')[0];
        const effectiveTime = entry.getElementsByTagName('effectiveTime')[0];

        if (code) {
          procedures.push({
            name: code.getAttribute('displayName') || 'Unknown procedure',
            date: this.formatDate(effectiveTime?.getAttribute('value')),
            code: code.getAttribute('code')
          });
        }
      }

      return procedures;
    } catch (error) {
      console.error('Error extracting procedures:', error);
      return [];
    }
  }

  /**
   * Extract document metadata
   */
  extractDocumentInfo(xmlDoc) {
    try {
      const effectiveTime = xmlDoc.getElementsByTagName('effectiveTime')[0];
      const author = xmlDoc.getElementsByTagName('author')[0];

      let authorName = null;
      if (author) {
        const assignedAuthor = author.getElementsByTagName('assignedAuthor')[0];
        const name = assignedAuthor?.getElementsByTagName('name')[0];
        const given = name?.getElementsByTagName('given')[0]?.textContent;
        const family = name?.getElementsByTagName('family')[0]?.textContent;
        authorName = `${given || ''} ${family || ''}`.trim();
      }

      return {
        documentDate: this.formatDate(effectiveTime?.getAttribute('value')),
        documentAuthor: authorName || 'Unknown'
      };
    } catch (error) {
      console.error('Error extracting document info:', error);
      return {};
    }
  }

  /**
   * Get section by LOINC code
   */
  getSectionByCode(xmlDoc, loincCode) {
    const sections = xmlDoc.getElementsByTagName('section');
    const matchingSections = [];

    for (let i = 0; i < sections.length; i++) {
      const code = sections[i].getElementsByTagName('code')[0];
      if (code && code.getAttribute('code') === loincCode) {
        matchingSections.push(sections[i]);
      }
    }

    return matchingSections;
  }

  /**
   * Format HL7 date (YYYYMMDD or YYYYMMDDHHmmss) to readable format
   */
  formatDate(hl7Date) {
    if (!hl7Date) return null;

    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);

    return `${month}/${day}/${year}`;
  }

  /**
   * Validate CCD structure
   */
  validateCCD(xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parser errors
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        return { valid: false, error: 'Invalid XML format' };
      }

      // Check for ClinicalDocument root element
      const clinicalDocument = xmlDoc.getElementsByTagName('ClinicalDocument')[0];
      if (!clinicalDocument) {
        return { valid: false, error: 'Not a valid CCD document (missing ClinicalDocument root)' };
      }

      // Check for recordTarget (patient info)
      const recordTarget = xmlDoc.getElementsByTagName('recordTarget')[0];
      if (!recordTarget) {
        return { valid: false, error: 'Missing patient information (recordTarget)' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new CCDXMLParserService();
