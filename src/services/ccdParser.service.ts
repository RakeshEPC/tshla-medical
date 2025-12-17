/**
 * CCD Parser Service (Frontend)
 * Client-side XML parsing for CCD (Continuity of Care Document) files
 * Provides preview and validation before uploading to server
 */

export interface CCDDemographics {
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  mrn: string | null;
  phone: string | null;
  email: string | null;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } | null;
}

export interface CCDMedication {
  name: string;
  dose: string | null;
  frequency: string | null;
  code: string | null;
}

export interface CCDCondition {
  name: string;
  code: string | null;
  codeSystem: string | null;
  status: string;
}

export interface CCDAllergy {
  allergen: string;
  reaction: string | null;
  code: string | null;
}

export interface CCDLab {
  name: string;
  value: string | null;
  unit: string | null;
  date: string | null;
  code: string | null;
}

export interface CCDVital {
  name: string;
  value: string | null;
  unit: string | null;
}

export interface CCDExtractedData {
  demographics: CCDDemographics | null;
  medications: CCDMedication[];
  conditions: CCDCondition[];
  allergies: CCDAllergy[];
  labs: CCDLab[];
  vitals: CCDVital[];
  documentInfo: {
    documentDate: string | null;
    documentAuthor: string | null;
  };
}

class CCDParserService {
  /**
   * Parse CCD XML file and extract structured data
   */
  async parseCCD(xmlString: string): Promise<CCDExtractedData> {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid XML format');
      }

      console.log('📄 Parsing CCD XML document (frontend)...');

      const extractedData: CCDExtractedData = {
        demographics: this.extractDemographics(xmlDoc),
        medications: this.extractMedications(xmlDoc),
        conditions: this.extractConditions(xmlDoc),
        allergies: this.extractAllergies(xmlDoc),
        labs: this.extractLabs(xmlDoc),
        vitals: this.extractVitals(xmlDoc),
        documentInfo: this.extractDocumentInfo(xmlDoc)
      };

      console.log('✅ CCD parsing complete (frontend)');
      console.log(`   - Demographics: ${extractedData.demographics ? 'Found' : 'Not found'}`);
      console.log(`   - Medications: ${extractedData.medications.length} items`);
      console.log(`   - Conditions: ${extractedData.conditions.length} items`);
      console.log(`   - Allergies: ${extractedData.allergies.length} items`);

      return extractedData;
    } catch (error) {
      console.error('❌ CCD parsing error:', error);
      throw new Error(`Failed to parse CCD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate CCD XML structure
   */
  validateCCD(xmlString: string): { valid: boolean; error?: string } {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

      // Check for parser errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        return { valid: false, error: 'Invalid XML format' };
      }

      // Check for ClinicalDocument root element
      const clinicalDocument = xmlDoc.querySelector('ClinicalDocument');
      if (!clinicalDocument) {
        return { valid: false, error: 'Not a valid CCD document (missing ClinicalDocument root)' };
      }

      // Check for recordTarget (patient info)
      const recordTarget = xmlDoc.querySelector('recordTarget');
      if (!recordTarget) {
        return { valid: false, error: 'Missing patient information (recordTarget)' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Read file as text
   */
  async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsText(file);
    });
  }

  // Private extraction methods

  private extractDemographics(xmlDoc: Document): CCDDemographics | null {
    try {
      const recordTarget = xmlDoc.querySelector('recordTarget');
      if (!recordTarget) return null;

      const patientRole = recordTarget.querySelector('patientRole');
      if (!patientRole) return null;

      const patient = patientRole.querySelector('patient');
      const addr = patientRole.querySelector('addr');

      // Extract name
      const name = patient?.querySelector('name');
      const given = name?.querySelector('given')?.textContent || '';
      const family = name?.querySelector('family')?.textContent || '';

      // Extract birth date
      const birthTime = patient?.querySelector('birthTime');
      const dob = birthTime?.getAttribute('value');

      // Extract gender
      const administrativeGender = patient?.querySelector('administrativeGenderCode');
      const gender = administrativeGender?.getAttribute('displayName') ||
                    administrativeGender?.getAttribute('code');

      // Extract address
      let address = null;
      if (addr) {
        address = {
          street: addr.querySelector('streetAddressLine')?.textContent,
          city: addr.querySelector('city')?.textContent,
          state: addr.querySelector('state')?.textContent,
          zipCode: addr.querySelector('postalCode')?.textContent
        };
      }

      // Extract phone and email
      const telecoms = patientRole.querySelectorAll('telecom');
      let phone = null;
      let email = null;
      telecoms.forEach(telecom => {
        const value = telecom.getAttribute('value');
        if (value?.startsWith('tel:')) {
          phone = value.replace('tel:', '');
        } else if (value?.startsWith('mailto:')) {
          email = value.replace('mailto:', '');
        }
      });

      // Extract MRN
      const id = patientRole.querySelector('id');
      const mrn = id?.getAttribute('extension');

      return {
        firstName: given,
        lastName: family,
        fullName: `${given} ${family}`.trim(),
        dateOfBirth: this.formatDate(dob),
        gender: gender || null,
        mrn: mrn || null,
        phone,
        email,
        address
      };
    } catch (error) {
      console.error('Error extracting demographics:', error);
      return null;
    }
  }

  private extractMedications(xmlDoc: Document): CCDMedication[] {
    const medications: CCDMedication[] = [];
    try {
      const medicationSection = this.getSectionByCode(xmlDoc, '10160-0');
      if (!medicationSection) return medications;

      const entries = medicationSection.querySelectorAll('entry');
      entries.forEach(entry => {
        const manufacturedMaterial = entry.querySelector('manufacturedMaterial');
        if (manufacturedMaterial) {
          const code = manufacturedMaterial.querySelector('code');
          const name = code?.getAttribute('displayName') ||
                      manufacturedMaterial.querySelector('name')?.textContent;

          // Extract dosage
          const doseQuantity = entry.querySelector('doseQuantity');
          const dose = doseQuantity ?
            `${doseQuantity.getAttribute('value')} ${doseQuantity.getAttribute('unit')}`.trim() :
            null;

          medications.push({
            name: name || 'Unknown medication',
            dose,
            frequency: null, // Could be extracted from effectiveTime
            code: code?.getAttribute('code') || null
          });
        }
      });
    } catch (error) {
      console.error('Error extracting medications:', error);
    }
    return medications;
  }

  private extractConditions(xmlDoc: Document): CCDCondition[] {
    const conditions: CCDCondition[] = [];
    try {
      const problemSection = this.getSectionByCode(xmlDoc, '11450-4');
      if (!problemSection) return conditions;

      const entries = problemSection.querySelectorAll('entry');
      entries.forEach(entry => {
        const value = entry.querySelector('value');
        if (value) {
          const name = value.getAttribute('displayName');
          const code = value.getAttribute('code');
          const codeSystem = value.getAttribute('codeSystemName');
          const statusCode = entry.querySelector('statusCode');
          const status = statusCode?.getAttribute('code');

          conditions.push({
            name: name || 'Unknown condition',
            code: code || null,
            codeSystem: codeSystem || null,
            status: status === 'completed' ? 'resolved' : 'active'
          });
        }
      });
    } catch (error) {
      console.error('Error extracting conditions:', error);
    }
    return conditions;
  }

  private extractAllergies(xmlDoc: Document): CCDAllergy[] {
    const allergies: CCDAllergy[] = [];
    try {
      const allergySection = this.getSectionByCode(xmlDoc, '48765-2');
      if (!allergySection) return allergies;

      const entries = allergySection.querySelectorAll('entry');
      entries.forEach(entry => {
        const participant = entry.querySelector('participant');
        if (participant) {
          const code = participant.querySelector('code');
          const name = code?.getAttribute('displayName') ||
                      participant.querySelector('name')?.textContent;
          const value = entry.querySelector('value');
          const reaction = value?.getAttribute('displayName');

          allergies.push({
            allergen: name || 'Unknown allergen',
            reaction: reaction || null,
            code: code?.getAttribute('code') || null
          });
        }
      });
    } catch (error) {
      console.error('Error extracting allergies:', error);
    }
    return allergies;
  }

  private extractLabs(xmlDoc: Document): CCDLab[] {
    const labs: CCDLab[] = [];
    try {
      const labSection = this.getSectionByCode(xmlDoc, '30954-2');
      if (!labSection) return labs;

      const entries = labSection.querySelectorAll('entry');
      entries.forEach(entry => {
        const code = entry.querySelector('code');
        const value = entry.querySelector('value');
        const effectiveTime = entry.querySelector('effectiveTime');

        if (code && value) {
          labs.push({
            name: code.getAttribute('displayName') || 'Unknown test',
            value: value.getAttribute('value'),
            unit: value.getAttribute('unit'),
            date: this.formatDate(effectiveTime?.getAttribute('value')),
            code: code.getAttribute('code')
          });
        }
      });
    } catch (error) {
      console.error('Error extracting labs:', error);
    }
    return labs;
  }

  private extractVitals(xmlDoc: Document): CCDVital[] {
    const vitals: CCDVital[] = [];
    try {
      const vitalSection = this.getSectionByCode(xmlDoc, '8716-3');
      if (!vitalSection) return vitals;

      const entries = vitalSection.querySelectorAll('entry');
      entries.forEach(entry => {
        const code = entry.querySelector('code');
        const value = entry.querySelector('value');

        if (code && value) {
          vitals.push({
            name: code.getAttribute('displayName') || 'Unknown vital',
            value: value.getAttribute('value'),
            unit: value.getAttribute('unit')
          });
        }
      });
    } catch (error) {
      console.error('Error extracting vitals:', error);
    }
    return vitals;
  }

  private extractDocumentInfo(xmlDoc: Document) {
    try {
      const effectiveTime = xmlDoc.querySelector('effectiveTime');
      const author = xmlDoc.querySelector('author');

      let authorName = null;
      if (author) {
        const assignedAuthor = author.querySelector('assignedAuthor');
        const name = assignedAuthor?.querySelector('name');
        const given = name?.querySelector('given')?.textContent;
        const family = name?.querySelector('family')?.textContent;
        authorName = `${given || ''} ${family || ''}`.trim();
      }

      return {
        documentDate: this.formatDate(effectiveTime?.getAttribute('value')),
        documentAuthor: authorName || 'Unknown'
      };
    } catch (error) {
      console.error('Error extracting document info:', error);
      return {
        documentDate: null,
        documentAuthor: null
      };
    }
  }

  private getSectionByCode(xmlDoc: Document, loincCode: string): Element | null {
    const sections = xmlDoc.querySelectorAll('section');
    for (let i = 0; i < sections.length; i++) {
      const code = sections[i].querySelector('code');
      if (code && code.getAttribute('code') === loincCode) {
        return sections[i];
      }
    }
    return null;
  }

  private formatDate(hl7Date: string | null): string | null {
    if (!hl7Date) return null;

    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);

    return `${month}/${day}/${year}`;
  }
}

export default new CCDParserService();
