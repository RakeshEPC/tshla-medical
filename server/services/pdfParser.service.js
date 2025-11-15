/**
 * PDF Parser Service
 * Extracts text content from medical progress note PDFs
 */

const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

class PDFParserService {
  /**
   * Parse PDF file and extract text
   * @param {Buffer|string} pdfInput - PDF file buffer or file path
   * @returns {Promise<Object>} Parsed PDF data
   */
  async parsePDF(pdfInput) {
    try {
      let dataBuffer;

      // If string path, read file
      if (typeof pdfInput === 'string') {
        dataBuffer = await fs.readFile(pdfInput);
      } else {
        dataBuffer = pdfInput;
      }

      // Parse PDF
      const data = await pdfParse(dataBuffer);

      return {
        success: true,
        text: data.text,
        numPages: data.numpages,
        metadata: data.metadata,
        info: data.info,
        version: data.version
      };
    } catch (error) {
      console.error('❌ PDF parsing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean extracted text for better AI processing
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page headers/footers (common patterns)
      .replace(/Page \d+ of \d+/gi, '')
      .replace(/\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+(AM|PM)/gi, '')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract key sections from progress note text
   * @param {string} text - Extracted PDF text
   * @returns {Object} Organized sections
   */
  extractSections(text) {
    const sections = {
      patient_info: this.extractSection(text, [
        'Patient Name',
        'Patient\nName',
        'DOB',
        'Date of Birth',
        'MRN',
        'ID#'
      ]),
      medications: this.extractSection(text, [
        'Medications',
        'Current Medications',
        'MEDICATIONS',
        'Meds:'
      ]),
      problems: this.extractSection(text, [
        'Problems',
        'Problem List',
        'Diagnoses',
        'DIAGNOSIS',
        'Assessment'
      ]),
      allergies: this.extractSection(text, [
        'Allergies',
        'ALLERGIES',
        'Drug Allergies'
      ]),
      hpi: this.extractSection(text, [
        'HPI',
        'History of Present Illness',
        'HISTORY OF PRESENT ILLNESS'
      ])
    };

    return sections;
  }

  /**
   * Extract a specific section from text
   * @param {string} text - Full text
   * @param {Array<string>} headers - Possible section headers
   * @returns {string|null} Section text
   */
  extractSection(text, headers) {
    for (const header of headers) {
      const regex = new RegExp(
        `${this.escapeRegex(header)}[:\\s]*\\n([\\s\\S]+?)(?=\\n\\s*[A-Z][a-zA-Z\\s]+:|$)`,
        'i'
      );
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract patient demographics using simple pattern matching
   * @param {string} text - PDF text
   * @returns {Object} Demographics
   */
  extractDemographics(text) {
    const demographics = {};

    // Extract patient name (common patterns)
    const namePattern = /(?:Patient\s*Name|Name)[:\s]*([A-Z][a-zA-Z]+(?:,\s*[A-Z][a-zA-Z]+)?)/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      demographics.name = nameMatch[1].trim();
    }

    // Extract DOB
    const dobPattern = /(?:DOB|Date of Birth)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i;
    const dobMatch = text.match(dobPattern);
    if (dobMatch) {
      demographics.dob = dobMatch[1];
    }

    // Extract MRN/ID
    const mrnPattern = /(?:MRN|ID#|Patient ID)[:\s]*(\w+)/i;
    const mrnMatch = text.match(mrnPattern);
    if (mrnMatch) {
      demographics.mrn = mrnMatch[1];
    }

    // Extract phone number
    const phonePattern = /(?:Phone|Ph|Tel)[:\s]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i;
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch) {
      demographics.phone = phoneMatch[1].replace(/[^\d+]/g, '');
    }

    return demographics;
  }
}

module.exports = new PDFParserService();
