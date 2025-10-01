/**
 * AI-Powered Schedule Parser Service
 * Uses intelligent field detection to parse appointment data flexibly
 */

import { azureAIService } from './azureAI.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface ParsedAppointment {
  date?: string;
  time?: string;
  patientFirstName?: string;
  patientLastName?: string;
  patientId?: string;
  patientDob?: string;
  patientEmail?: string;
  patientPhone?: string;
  patientMobile?: string;
  providerName?: string;
  providerCode?: string;
  visitType?: string;
  notes?: string;
  confidence: number;
}

export interface AIParseResult {
  appointments: ParsedAppointment[];
  columnMapping?: Record<string, number>;
  detectedFormat?: string;
  parseErrors: string[];
  suggestions: string[];
}

class AIScheduleParserService {
  /**
   * Use AI to intelligently parse schedule data
   */
  async parseScheduleWithAI(content: string): Promise<AIParseResult> {
    try {
      // First, get a sample of the data for AI analysis
      const lines = content.trim().split('\n');
      const sampleSize = Math.min(10, lines.length);
      const sampleData = lines.slice(0, sampleSize).join('\n');

      // Check if AI service is available
      const useAI = azureAIService && typeof azureAIService.processWithAI === 'function';

      if (!useAI) {
        logDebug('aiScheduleParser', 'Debug message', {});
        return this.fallbackParse(content);
      }

      // Ask AI to analyze the structure
      const structurePrompt = `Analyze this CSV/TSV data and identify what each column represents. Be flexible with variations and missing data.

Data sample:
${sampleData}

Please respond in JSON format with:
{
  "columnMapping": {
    "0": "field_name",
    "1": "field_name",
    ...
  },
  "dateFormat": "MM/DD/YYYY or similar",
  "hasHeader": true/false,
  "delimiter": "tab" or "comma",
  "detectedFields": ["list", "of", "detected", "fields"],
  "confidence": 0.0-1.0
}

Common field types to look for:
- Appointment date (could be labeled as date, apptdate, appointment date, etc.)
- Appointment time (time, schedule time, appt time, apptstarttime, apptscheduletime, start time, etc.)
- Patient first name (first, firstname, patient firstname, fname, etc.)
- Patient last name (last, lastname, patient lastname, lname, etc.)
- Patient ID (id, mrn, patient id, patient number, medical record number, patientid)
- Date of birth (dob, birthdate, patient dob, birth date, patientdob)
- Email (email, patient email, e-mail, patient_email)
- Phone (phone, home phone, telephone, contact, patient homephone, patient_homephone)
- Mobile (mobile, cell, cell phone, patient mobile no, patient_mobile)
- Provider/Doctor name (provider, doctor, physician, prvdr, rendering provider, appt schdlng prvdrfullnme, prvdrfullnme)
- Provider code (provider code, prvdr code, doctor id)

Be intelligent about detecting:
- Names (typically contain letters, may have spaces/hyphens)
- Dates (formats like MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD)
- IDs (typically numeric or alphanumeric codes)
- Phone numbers (various formats with parentheses, dashes, spaces)
- Emails (contains @ symbol)`;

      const structureAnalysis = await azureAIService.processWithAI(structurePrompt);

      let columnMapping: Record<string, number> = {};
      let hasHeader = true;
      let delimiter = '\t';
      let confidence = 0.8;

      try {
        const analysis = JSON.parse(structureAnalysis);
        columnMapping = analysis.columnMapping || {};
        hasHeader = analysis.hasHeader !== false;
        delimiter = analysis.delimiter === 'comma' ? ',' : '\t';
        confidence = analysis.confidence || 0.8;
      } catch (e) {
        logDebug('aiScheduleParser', 'Debug message', {});
        // Use intelligent detection that examines actual data
        columnMapping = this.detectColumnsIntelligently(lines, delimiter);
      }

      // Now parse each row using the detected structure
      const startRow = hasHeader ? 1 : 0;
      const appointments: ParsedAppointment[] = [];
      const parseErrors: string[] = [];

      logDebug('aiScheduleParser', 'Debug message', {});

      for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(delimiter).map(p => p.trim());

        // Use AI to extract appointment data from this row
        const appointment = await this.parseRowWithAI(parts, columnMapping, i);

        if (appointment) {
          appointments.push(appointment);
        } else {
          parseErrors.push(`Could not parse row ${i + 1}`);
        }

        // Limit AI calls for large files - use pattern matching after 100 rows
        if (i >= startRow + 100) {
          logDebug('aiScheduleParser', 'Debug message', {});
          const remainingLines = lines.slice(i + 1);
          logDebug('aiScheduleParser', 'Debug message', {});

          const remainingAppts = this.parseRemainingRowsWithPattern(
            remainingLines,
            columnMapping,
            delimiter
          );
          appointments.push(...remainingAppts);
          logInfo('aiScheduleParser', 'Info message', {});
          break;
        }
      }

      // Generate suggestions for improving data quality
      const suggestions = this.generateSuggestions(appointments, parseErrors);

      return {
        appointments,
        columnMapping,
        detectedFormat: `${hasHeader ? 'With header' : 'No header'}, ${delimiter === ',' ? 'Comma' : 'Tab'} delimited`,
        parseErrors,
        suggestions,
      };
    } catch (error) {
      logError('aiScheduleParser', 'Error message', {});
      logDebug('aiScheduleParser', 'Debug message', {});
      return this.fallbackParse(content);
    }
  }

  /**
   * Parse a single row with AI assistance
   */
  private async parseRowWithAI(
    parts: string[],
    columnMapping: Record<string, number>,
    rowIndex: number
  ): Promise<ParsedAppointment | null> {
    try {
      // Build a context string for AI
      const rowData = parts
        .map((part, idx) => {
          const fieldName = Object.entries(columnMapping).find(
            ([_, colIdx]) => colIdx === idx
          )?.[0];
          return `Column ${idx} (${fieldName || 'unknown'}): "${part}"`;
        })
        .join('\n');

      const prompt = `Extract appointment information from this row of data. Be flexible with formats and handle missing data gracefully.

${rowData}

Return JSON with these fields (use null for missing data):
{
  "date": "appointment date in MM/DD/YYYY format",
  "time": "appointment time - CRITICAL: Extract the actual appointment time value (e.g., '09:00 AM', '05:00 PM'). Look for columns labeled: apptstarttime, apptscheduletime, time, appointment_time, start_time, etc. The time should be in format like '09:00 AM' or '2:30 PM'",
  "patientFirstName": "patient's first name",
  "patientLastName": "patient's last name",
  "patientId": "patient ID or MRN",
  "patientDob": "patient date of birth",
  "patientEmail": "email address",
  "patientPhone": "phone number",
  "patientMobile": "mobile number",
  "providerName": "doctor/provider FULL name exactly as shown",
  "providerCode": "provider code if available",
  "confidence": 0.0-1.0
}

CRITICAL for provider identification:
- Look for columns with names like: rndrng_prvdr, appt_schdlng_prvdrfullnme, provider, doctor
- Provider names may be in formats like:
  * "LASTNAME, FIRSTNAME" (e.g., "CHAMAKKALA, TESS")
  * "GC_EPC_Lastname_F" (e.g., "GC_EPC_Chamakkala_T")
  * "FIRSTNAME LASTNAME" (e.g., "Tess Chamakkala")
  * Specialty names like "IDEAL PROTEIN COACH," or "CGMS KATY,"
- ALWAYS extract the FULL provider name/code exactly as shown
- If you see names like ADELEKE, BERNANDER, CHAMAKKALA, GREGOREK, LAVERDE, PATEL, SHAKYA, TONYE, WATWE, YOUNUS - these are provider last names
- Patient names are usually in separate first/last name columns
- Provider is the DOCTOR, not the patient`;

      const result = await azureAIService.processWithAI(prompt);

      try {
        const parsed = JSON.parse(result);
        return {
          ...parsed,
          confidence: parsed.confidence || 0.7,
        };
      } catch (e) {
        // If AI response isn't valid JSON, use pattern matching
        return this.parseRowWithPatterns(parts, columnMapping);
      }
    } catch (error) {
      logError('aiScheduleParser', 'Error message', {});
      return this.parseRowWithPatterns(parts, columnMapping);
    }
  }

  /**
   * Fallback pattern-based parsing for a row
   */
  private parseRowWithPatterns(
    parts: string[],
    columnMapping: Record<string, number>
  ): ParsedAppointment {
    const appointment: ParsedAppointment = {
      confidence: 0.5,
    };

    // Use patterns to identify fields
    parts.forEach((part, idx) => {
      // Date pattern (MM/DD/YYYY or similar)
      if (part.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
        if (!appointment.date && part.includes('/')) {
          appointment.date = part;
        } else if (!appointment.patientDob) {
          appointment.patientDob = part;
        }
      }

      // Time pattern
      if (part.match(/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i)) {
        appointment.time = part;
      }

      // Email pattern
      if (part.includes('@') && part.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        appointment.patientEmail = part;
      }

      // Phone pattern
      if (part.match(/^[\d\s\-\(\)\.]+$/) && part.replace(/\D/g, '').length >= 10) {
        if (!appointment.patientPhone) {
          appointment.patientPhone = part;
        } else {
          appointment.patientMobile = part;
        }
      }

      // ID pattern (numeric or alphanumeric)
      if (part.match(/^[A-Z0-9]{6,}$/i) && !part.includes('@')) {
        appointment.patientId = part;
      }

      // Provider code pattern
      if (part.match(/^GC_EPC_/i) || part.match(/^[A-Z]{2,}_[A-Z]{2,}/)) {
        appointment.providerCode = part;
      }
    });

    // Try to extract names from remaining fields
    const possibleNames = parts.filter(
      p => p.match(/^[A-Za-z\s\-']+$/) && p.length > 1 && !p.match(/^(AM|PM|Dr|MD|DO|NP|PA)$/i)
    );

    if (possibleNames.length >= 2) {
      appointment.patientFirstName = possibleNames[0];
      appointment.patientLastName = possibleNames[1];
    }

    return appointment;
  }

  /**
   * Parse remaining rows using detected pattern (for performance)
   */
  private parseRemainingRowsWithPattern(
    lines: string[],
    columnMapping: Record<string, number>,
    delimiter: string
  ): ParsedAppointment[] {
    const appointments: ParsedAppointment[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(delimiter).map(p => p.trim());
      const appointment = this.parseRowWithPatterns(parts, columnMapping);

      // Include appointments with valid date/time even if patient info is placeholder
      const hasValidSchedule = appointment && appointment.date && appointment.time;

      if (hasValidSchedule) {
        // Handle placeholder patient data
        if (!appointment.patientFirstName || appointment.patientFirstName === '-') {
          appointment.patientFirstName = 'Available';
        }
        if (!appointment.patientLastName || appointment.patientLastName === '-') {
          appointment.patientLastName = 'Slot';
        }
        if (!appointment.patientId || appointment.patientId === '-') {
          appointment.patientId = `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        appointments.push(appointment);
      }
    }

    return appointments;
  }

  /**
   * Intelligent column detection by examining actual data patterns
   */
  private detectColumnsIntelligently(lines: string[], delimiter: string): Record<string, number> {
    const sampleRows = lines.slice(1, Math.min(6, lines.length));
    const mapping: Record<string, number> = {};

    if (sampleRows.length === 0) {
      // Fall back to header-based detection if no data rows
      return this.detectColumnsHeuristically(lines[0], delimiter);
    }

    const firstRow = sampleRows[0].split(delimiter);

    firstRow.forEach((value, idx) => {
      const columnValues = sampleRows
        .map(row => {
          const parts = row.split(delimiter);
          return parts[idx] ? parts[idx].trim() : '';
        })
        .filter(v => v);

      // Skip empty columns or row numbers
      if (!columnValues.length || (idx === 0 && columnValues.every(v => v.match(/^\d{1,3}$/)))) {
        return;
      }

      // Date detection (MM/DD/YYYY format)
      if (columnValues.every(v => v && v.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/))) {
        const year = parseInt(columnValues[0].split('/')[2]);
        if (year >= 2024) {
          mapping['appointment_date'] = idx;
        } else {
          mapping['dob'] = idx;
        }
      }
      // Time detection (HH:MM AM/PM)
      else if (columnValues.every(v => v && v.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i))) {
        mapping['appointment_time'] = idx;
      }
      // Provider detection (LASTNAME, FIRSTNAME format)
      else if (columnValues.every(v => v && v.includes(',') && v.match(/^[A-Z]+,\s*[A-Z]/))) {
        mapping['provider'] = idx;
      }
      // Patient ID detection (7-9 digit numbers)
      else if (columnValues.every(v => v.match(/^\d{7,9}$/))) {
        mapping['patient_id'] = idx;
      }
      // Email detection
      else if (columnValues.some(v => v.includes('@') && v.includes('.'))) {
        mapping['email'] = idx;
      }
      // Phone number detection
      else if (
        columnValues.some(v => {
          const cleaned = v.replace(/\D/g, '');
          return cleaned.length === 10 || (cleaned.length >= 10 && v.includes('('));
        })
      ) {
        if (!mapping['phone']) {
          mapping['phone'] = idx;
        } else if (!mapping['mobile']) {
          mapping['mobile'] = idx;
        }
      }
      // Name detection (text without special chars)
      else if (columnValues.every(v => v.match(/^[A-Za-z\s\-'\.]+$/))) {
        const hasCommas = columnValues.some(v => v.includes(','));
        if (!hasCommas) {
          if (!mapping['first_name']) {
            mapping['first_name'] = idx;
          } else if (!mapping['last_name']) {
            mapping['last_name'] = idx;
          }
        }
      }
    });

    return mapping;
  }

  /**
   * Heuristic column detection as fallback
   */
  private detectColumnsHeuristically(
    headerLine: string,
    delimiter: string
  ): Record<string, number> {
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());
    const mapping: Record<string, number> = {};

    headers.forEach((header, idx) => {
      if (header.includes('date') && !header.includes('birth')) {
        mapping['appointment_date'] = idx;
      } else if (
        header.includes('time') ||
        header.includes('apptstarttime') ||
        header.includes('apptscheduletime')
      ) {
        mapping['appointment_time'] = idx;
      } else if (header.includes('first')) {
        mapping['first_name'] = idx;
      } else if (header.includes('last')) {
        mapping['last_name'] = idx;
      } else if (header.includes('id') || header.includes('mrn') || header.includes('patientid')) {
        mapping['patient_id'] = idx;
      } else if (header.includes('dob') || header.includes('birth')) {
        mapping['dob'] = idx;
      } else if (header.includes('email')) {
        mapping['email'] = idx;
      } else if (
        (header.includes('phone') || header.includes('homephone')) &&
        !header.includes('mobile')
      ) {
        mapping['phone'] = idx;
      } else if (
        header.includes('mobile') ||
        header.includes('cell') ||
        header.includes('mobileno')
      ) {
        mapping['mobile'] = idx;
      } else if (
        header.includes('prvdr') ||
        header.includes('provider') ||
        header.includes('doctor') ||
        header.includes('prvdrfullnme')
      ) {
        mapping['provider'] = idx;
      }
    });

    return mapping;
  }

  /**
   * Complete fallback parsing without AI
   */
  private fallbackParse(content: string): AIParseResult {
    const lines = content.trim().split('\n');
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    // Try intelligent detection first, fall back to header-based if needed
    const columnMapping =
      lines.length > 1
        ? this.detectColumnsIntelligently(lines, delimiter)
        : this.detectColumnsHeuristically(lines[0], delimiter);

    logDebug('aiScheduleParser', 'Debug message', {});

    const appointments: ParsedAppointment[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(delimiter).map(p => p.trim());
      const appointment = this.parseRowWithPatterns(parts, columnMapping);

      // Include appointments with valid date/time even if patient info is placeholder
      const hasValidSchedule = appointment && appointment.date && appointment.time;

      if (hasValidSchedule) {
        // Handle placeholder patient data
        if (!appointment.patientFirstName || appointment.patientFirstName === '-') {
          appointment.patientFirstName = 'Available';
        }
        if (!appointment.patientLastName || appointment.patientLastName === '-') {
          appointment.patientLastName = 'Slot';
        }
        if (!appointment.patientId || appointment.patientId === '-') {
          appointment.patientId = `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        appointments.push(appointment);
      } else {
        parseErrors.push(`Could not parse row ${i + 1}`);
      }
    }

    return {
      appointments,
      columnMapping,
      detectedFormat: 'Fallback parsing',
      parseErrors,
      suggestions: ['Consider using a more standard CSV format for better results'],
    };
  }

  /**
   * Generate suggestions for data improvement
   */
  private generateSuggestions(appointments: ParsedAppointment[], errors: string[]): string[] {
    const suggestions: string[] = [];

    // Check for missing critical fields
    const missingDates = appointments.filter(a => !a.date).length;
    const missingNames = appointments.filter(a => !a.patientLastName).length;
    const missingIds = appointments.filter(a => !a.patientId).length;

    if (missingDates > 0) {
      suggestions.push(`${missingDates} appointments are missing dates`);
    }
    if (missingNames > 0) {
      suggestions.push(`${missingNames} appointments are missing patient names`);
    }
    if (missingIds > 0) {
      suggestions.push(`${missingIds} appointments are missing patient IDs`);
    }

    if (errors.length > 10) {
      suggestions.push('Many parsing errors detected - consider checking data format');
    }

    // Check confidence levels
    const lowConfidence = appointments.filter(a => a.confidence < 0.6).length;
    if (lowConfidence > appointments.length * 0.3) {
      suggestions.push('Low confidence in parsing - data may need manual review');
    }

    return suggestions;
  }
}

export const aiScheduleParserService = new AIScheduleParserService();
