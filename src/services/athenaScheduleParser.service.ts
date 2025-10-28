/**
 * Athena Schedule Parser Service
 * Intelligently parses Athena Health schedule exports (CSV/TSV)
 * with flexible column detection and validation
 */

import type {
  AthenaScheduleRow,
  ParsedAthenaAppointment,
  ImportError,
} from '../types/schedule.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Provider name mapping (customize for your practice)
const PROVIDER_NAME_MAPPING: Record<string, { id: string; fullName: string; specialty?: string }> = {
  // Radha Bernander
  'bernander, radha': { id: '962fbea3-3820-4b43-aad3-b31cdd27af83', fullName: 'Dr. Radha Bernander', specialty: 'Endo' },
  'radha bernander': { id: '962fbea3-3820-4b43-aad3-b31cdd27af83', fullName: 'Dr. Radha Bernander', specialty: 'Endo' },
  // Radha Bernander
  'bernander, radha': { id: '08567ee3-c589-405d-b394-dd7510366c1b', fullName: 'Dr. Radha Bernander', specialty: 'Internal Medicine' },
  'radha bernander': { id: '08567ee3-c589-405d-b394-dd7510366c1b', fullName: 'Dr. Radha Bernander', specialty: 'Internal Medicine' },
  // Tess Chamakkala
  'chamakkala, tess': { id: 'bef2b22e-588e-44fd-aefb-8ccbd4c634f3', fullName: 'Dr. Tess Chamakkala', specialty: 'Family Medicine' },
  'tess chamakkala': { id: 'bef2b22e-588e-44fd-aefb-8ccbd4c634f3', fullName: 'Dr. Tess Chamakkala', specialty: 'Family Medicine' },
  // Tess Chamakkala
  'chamakkala, tess': { id: '478698f8-fab2-4233-8e26-a9cf1145ddcd', fullName: 'Dr. Tess Chamakkala', specialty: 'Endocrinology' },
  'tess chamakkala': { id: '478698f8-fab2-4233-8e26-a9cf1145ddcd', fullName: 'Dr. Tess Chamakkala', specialty: 'Endocrinology' },
  // Shannon Gregorek
  'gregorek, shannon': { id: '84513525-64d0-4a21-9d87-15b31cdcd4ea', fullName: 'Dr. Shannon Gregorek', specialty: 'Endocrinology' },
  'shannon gregorek': { id: '84513525-64d0-4a21-9d87-15b31cdcd4ea', fullName: 'Dr. Shannon Gregorek', specialty: 'Endocrinology' },
  // Shannon Gregroek
  'gregroek, shannon': { id: 'df66dc55-1a88-4df0-be7d-6b4f4732b48d', fullName: 'Dr. Shannon Gregroek', specialty: 'Pediatrics' },
  'shannon gregroek': { id: 'df66dc55-1a88-4df0-be7d-6b4f4732b48d', fullName: 'Dr. Shannon Gregroek', specialty: 'Pediatrics' },
  // Cindy Laverde
  'laverde, cindy': { id: '357ab91f-3727-4d1f-b605-3c9ff70e4133', fullName: 'Dr. Cindy Laverde', specialty: 'Pediatrics' },
  'cindy laverde': { id: '357ab91f-3727-4d1f-b605-3c9ff70e4133', fullName: 'Dr. Cindy Laverde', specialty: 'Pediatrics' },
  // Vanessa Laverde
  'laverde, vanessa': { id: '7298c46a-6e8b-4d7c-ae00-46ee3b154543', fullName: 'Dr. Vanessa Laverde', specialty: 'Pediatrics' },
  'vanessa laverde': { id: '7298c46a-6e8b-4d7c-ae00-46ee3b154543', fullName: 'Dr. Vanessa Laverde', specialty: 'Pediatrics' },
  // Rakesh Patel
  'patel, rakesh': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  'rakesh patel': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  // Rakesh Patel
  'patel, rakesh': { id: '30c21923-cf6a-4cef-991b-808d13a26c5a', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  'rakesh patel': { id: '30c21923-cf6a-4cef-991b-808d13a26c5a', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  // Neha Patel
  'patel, neha': { id: '59bb5994-5c0d-4e1b-975a-eec141dccda8', fullName: 'Dr. Neha Patel', specialty: 'Psychiatry' },
  'neha patel': { id: '59bb5994-5c0d-4e1b-975a-eec141dccda8', fullName: 'Dr. Neha Patel', specialty: 'Psychiatry' },
  // Elinia Shakya
  'shakya, elinia': { id: '96306043-2e3e-4323-a07e-d11e1f1b76fc', fullName: 'Dr. Elinia Shakya', specialty: 'Family Medicine' },
  'elinia shakya': { id: '96306043-2e3e-4323-a07e-d11e1f1b76fc', fullName: 'Dr. Elinia Shakya', specialty: 'Family Medicine' },
  // Ghislaine Tonye
  'tonye, ghislaine': { id: '88382368-a7bc-4294-9ee0-47edfc62b22f', fullName: 'Dr. Ghislaine Tonye', specialty: 'Family Medicine' },
  'ghislaine tonye': { id: '88382368-a7bc-4294-9ee0-47edfc62b22f', fullName: 'Dr. Ghislaine Tonye', specialty: 'Family Medicine' },
  // Admin User
  'user, admin': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Dr. Admin User', specialty: 'admin' },
  'admin user': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Dr. Admin User', specialty: 'admin' },
  // Kamili Wade-Reescano
  'wade-reescano, kamili': { id: 'ff53319a-40fe-4011-a314-ceabbdb3180f', fullName: 'Dr. Kamili Wade-Reescano', specialty: 'Mental Health' },
  'kamili wade-reescano': { id: 'ff53319a-40fe-4011-a314-ceabbdb3180f', fullName: 'Dr. Kamili Wade-Reescano', specialty: 'Mental Health' },
  // Veena Watwe
  'watwe, veena': { id: '628aaeed-3e11-4745-bc48-cb6996701265', fullName: 'Dr. Veena Watwe', specialty: 'Pediatrics' },
  'veena watwe': { id: '628aaeed-3e11-4745-bc48-cb6996701265', fullName: 'Dr. Veena Watwe', specialty: 'Pediatrics' },
  // Veena Watwe
  'watwe, veena': { id: 'c5b7d2c7-d83f-44f7-9a9c-ad73e851b16d', fullName: 'Dr. Veena Watwe', specialty: 'Endocrinology' },
  'veena watwe': { id: 'c5b7d2c7-d83f-44f7-9a9c-ad73e851b16d', fullName: 'Dr. Veena Watwe', specialty: 'Endocrinology' },
  // Nadia Younus
  'younus, nadia': { id: 'd552f692-acf3-49e3-b238-6cc4f147013e', fullName: 'Dr. Nadia Younus', specialty: 'Internal Medicine' },
  'nadia younus': { id: 'd552f692-acf3-49e3-b238-6cc4f147013e', fullName: 'Dr. Nadia Younus', specialty: 'Internal Medicine' },
};

class AthenaScheduleParserService {
  /**
   * Parse Athena schedule file content
   */
  async parseScheduleFile(fileContent: string): Promise<{
    appointments: ParsedAthenaAppointment[];
    errors: ImportError[];
    warnings: string[];
  }> {
    const errors: ImportError[] = [];
    const warnings: string[] = [];
    const appointments: ParsedAthenaAppointment[] = [];

    try {
      // Detect delimiter (tab or comma)
      const delimiter = this.detectDelimiter(fileContent);
      logDebug('athenaParser', `Detected delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`, {});

      // Split into lines
      let lines = fileContent.trim().split('\n');
      if (lines.length < 2) {
        errors.push({ row: 0, message: 'File is empty or has no data rows' });
        return { appointments, errors, warnings };
      }

      // Skip report title line if present (e.g., "REPORT NAME : Tshla schedule")
      if (lines[0].toLowerCase().includes('report name')) {
        console.log('📝 [athenaParser] Skipping report title line');
        lines = lines.slice(1);
      }

      // Parse header row
      const headerRow = lines[0];
      const headers = this.parseRow(headerRow, delimiter);
      const columnMapping = this.mapColumns(headers);

      console.log('🔍 [athenaParser] Headers detected:', headers);
      console.log('🔍 [athenaParser] Column mapping:', columnMapping);
      logInfo('athenaParser', `Found ${headers.length} columns`, { headers, columnMapping });

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = this.parseRow(line, delimiter);
        const rowData = this.createRowObject(headers, values);

        try {
          const parsed = this.parseAppointment(rowData, columnMapping, i + 1);
          if (parsed.isValid) {
            appointments.push(parsed);
          } else {
            console.log(`❌ [athenaParser] Row ${i + 1} invalid:`, parsed.errors);
            errors.push(...parsed.errors.map(err => ({ row: i + 1, message: err })));
          }
        } catch (error) {
          console.error(`❌ [athenaParser] Row ${i + 1} exception:`, error);
          errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Failed to parse row',
          });
        }
      }

      logInfo('athenaParser', `Parsed ${appointments.length} valid appointments`, {
        total: lines.length - 1,
        valid: appointments.length,
        errors: errors.length,
      });

      return { appointments, errors, warnings };
    } catch (error) {
      logError('athenaParser', 'Fatal parse error', { error });
      errors.push({
        row: 0,
        message: error instanceof Error ? error.message : 'Unknown parse error',
      });
      return { appointments, errors, warnings };
    }
  }

  /**
   * Detect delimiter (tab or comma)
   */
  private detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    return tabCount > commaCount ? '\t' : ',';
  }

  /**
   * Parse a single row (handles quoted fields)
   */
  private parseRow(row: string, delimiter: string): string[] {
    if (delimiter === ',') {
      // Handle CSV with quotes
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    } else {
      // Simple tab split
      return row.split(delimiter).map(v => v.trim());
    }
  }

  /**
   * Create object from headers and values
   */
  private createRowObject(headers: string[], values: string[]): AthenaScheduleRow {
    const obj: AthenaScheduleRow = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  }

  /**
   * Map column headers to known fields
   */
  private mapColumns(headers: string[]): Record<string, number> {
    const mapping: Record<string, number> = {};

    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim();

      // Date - including Athena's "apptdate"
      if (normalized === 'apptdate' || (normalized.includes('date') && !normalized.includes('birth') && !normalized.includes('dob'))) {
        mapping['date'] = index;
      }
      // Time - including Athena's "apptstarttime"
      else if (normalized === 'apptstarttime' || normalized.includes('time') || normalized.includes('start')) {
        mapping['time'] = index;
      }
      // Provider - including Athena's "rndrng prvdr"
      else if (normalized === 'rndrng prvdr' || normalized.includes('rndrng') || normalized.includes('provider') || normalized.includes('doctor') || normalized.includes('prvdr')) {
        mapping['provider'] = index;
      }
      // Patient Full Name (single column) - Athena uses this
      else if (normalized === 'patient name' || (normalized.includes('patient') && normalized.includes('name') && !normalized.includes('first') && !normalized.includes('last'))) {
        mapping['patientFullName'] = index;
      }
      // Patient First Name
      else if (normalized.includes('first') && normalized.includes('name')) {
        mapping['firstName'] = index;
      }
      // Patient Last Name
      else if (normalized.includes('last') && normalized.includes('name')) {
        mapping['lastName'] = index;
      }
      // Age
      else if (normalized === 'age' || normalized.includes('patient age')) {
        mapping['age'] = index;
      }
      // DOB
      else if (normalized.includes('dob') || normalized.includes('birth')) {
        mapping['dob'] = index;
      }
      // Gender
      else if (normalized.includes('gender') || normalized === 'sex') {
        mapping['gender'] = index;
      }
      // Diagnosis - including Athena's ICD-10 columns
      else if (normalized.includes('diagnosis') || normalized === 'dx' || normalized.includes('chief complaint') || normalized.startsWith('icd10claimdiagdescr')) {
        // Store first diagnosis column found, or collect all
        if (!mapping['diagnosis']) {
          mapping['diagnosis'] = index;
        }
        // Also store individual diagnosis columns for later combining
        if (normalized.startsWith('icd10claimdiagdescr')) {
          if (!mapping['diagnosisColumns']) {
            mapping['diagnosisColumns'] = index; // Start tracking
          }
        }
      }
      // Visit Type
      else if (normalized.includes('visit') || normalized.includes('appt type')) {
        mapping['visitType'] = index;
      }
      // Duration
      else if (normalized.includes('duration')) {
        mapping['duration'] = index;
      }
      // MRN/Patient ID
      else if (normalized.includes('mrn') || (normalized.includes('patient') && normalized.includes('id'))) {
        mapping['mrn'] = index;
      }
      // Phone
      else if (normalized.includes('phone') && !normalized.includes('mobile')) {
        mapping['phone'] = index;
      }
      // Email
      else if (normalized.includes('email')) {
        mapping['email'] = index;
      }
    });

    return mapping;
  }

  /**
   * Parse a single appointment from row data
   */
  private parseAppointment(
    row: AthenaScheduleRow,
    columnMapping: Record<string, number>,
    rowNumber: number
  ): ParsedAthenaAppointment {
    const errors: string[] = [];
    const getValue = (key: string): string => {
      const index = columnMapping[key];
      if (index === undefined) return '';
      const value = Object.values(row)[index];
      return typeof value === 'string' ? value : String(value || '');
    };

    // Extract date
    const dateStr = getValue('date');
    const date = this.parseDate(dateStr);
    if (!date) {
      errors.push(`Invalid or missing date: "${dateStr}"`);
    }

    // Extract time
    const timeStr = getValue('time');
    const time = this.parseTime(timeStr);
    if (!time) {
      errors.push(`Invalid or missing time: "${timeStr}"`);
    }

    // Extract provider
    const providerStr = getValue('provider');
    const provider = this.parseProvider(providerStr);
    if (!provider.name) {
      errors.push(`Invalid or missing provider: "${providerStr}"`);
    }

    // Extract patient name
    let firstName = getValue('firstName') || '';
    let lastName = getValue('lastName') || '';

    // Handle full name in single column (Athena format)
    if (!firstName && !lastName) {
      const fullName = getValue('patientFullName');
      if (fullName) {
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else {
          firstName = fullName;
          lastName = '';
        }
      }
    }

    if (!firstName || !lastName) {
      errors.push('Missing patient first or last name');
    }

    // Extract age/DOB
    const ageStr = getValue('age');
    const dobStr = getValue('dob');
    const age = this.parseAge(ageStr);
    const dob = this.parseDate(dobStr);

    // Extract other fields
    const gender = getValue('gender');
    const diagnosis = getValue('diagnosis');
    const visitType = getValue('visitType');
    const durationStr = getValue('duration');
    const duration = this.parseDuration(durationStr) || 30; // Default 30 min
    const mrn = getValue('mrn');
    const phone = getValue('phone');
    const email = getValue('email');

    const isValid = errors.length === 0;
    const confidence = this.calculateConfidence(row, columnMapping);

    return {
      date: date || '',
      time: time || '',
      providerName: provider.name,
      providerId: provider.id,
      patientFirstName: firstName,
      patientLastName: lastName,
      patientAge: age,
      patientGender: gender || undefined,
      patientDOB: dob,
      patientPhone: phone || undefined,
      patientEmail: email || undefined,
      patientMRN: mrn || undefined,
      diagnosis: diagnosis || undefined,
      visitType: visitType || 'Office Visit',
      visitReason: diagnosis || undefined,
      duration,
      isValid,
      errors,
      confidence,
      rawRow: row,
    };
  }

  /**
   * Parse date from string (MM/DD/YYYY, etc.)
   */
  private parseDate(dateStr: string): string | undefined {
    if (!dateStr) return undefined;

    try {
      // Handle MM/DD/YYYY, M/D/YYYY, etc.
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // Handle YYYY-MM-DD
      if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
        return dateStr;
      }
    } catch (error) {
      logWarn('athenaParser', 'Failed to parse date', { dateStr });
    }

    return undefined;
  }

  /**
   * Parse time from string (9:00 AM, 09:00, etc.)
   */
  private parseTime(timeStr: string): string | undefined {
    if (!timeStr) return undefined;

    try {
      // Already in correct format (9:00 AM)
      if (timeStr.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) {
        return timeStr;
      }

      // Convert 24-hour to 12-hour with AM/PM
      const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        let [, hour, minute] = match;
        let h = parseInt(hour);
        const period = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h}:${minute} ${period}`;
      }
    } catch (error) {
      logWarn('athenaParser', 'Failed to parse time', { timeStr });
    }

    return undefined;
  }

  /**
   * Parse provider name and map to ID
   */
  private parseProvider(providerStr: string): { name: string; id?: string } {
    if (!providerStr) return { name: '' };

    const normalized = providerStr.toLowerCase().trim();

    // Check provider mapping
    for (const [key, value] of Object.entries(PROVIDER_NAME_MAPPING)) {
      if (normalized.includes(key)) {
        return { name: value.fullName, id: value.id };
      }
    }

    // Return as-is if not found
    return { name: providerStr, id: undefined };
  }

  /**
   * Parse age from string
   */
  private parseAge(ageStr: string): number | undefined {
    if (!ageStr) return undefined;
    const age = parseInt(ageStr);
    return isNaN(age) ? undefined : age;
  }

  /**
   * Parse duration from string (30 min, 45, etc.)
   */
  private parseDuration(durationStr: string): number | undefined {
    if (!durationStr) return undefined;

    const match = durationStr.match(/(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }

    return undefined;
  }

  /**
   * Calculate confidence score for parsed appointment
   */
  private calculateConfidence(row: AthenaScheduleRow, columnMapping: Record<string, number>): number {
    let score = 0;
    const required = ['date', 'time', 'provider'];
    const patientName = ['firstName', 'lastName', 'patientFullName']; // Accept either format
    const optional = ['age', 'dob', 'gender', 'diagnosis', 'visitType', 'duration'];

    // Required fields (20% each for date, time, provider)
    required.forEach(field => {
      if (columnMapping[field] !== undefined) {
        const value = Object.values(row)[columnMapping[field]];
        if (value && String(value).trim()) {
          score += 0.20;
        }
      }
    });

    // Patient name (40% - either firstName+lastName OR patientFullName)
    const hasFirstLast = columnMapping['firstName'] !== undefined && columnMapping['lastName'] !== undefined;
    const hasFullName = columnMapping['patientFullName'] !== undefined;
    if (hasFirstLast || hasFullName) {
      score += 0.40;
    }

    // Optional fields (5 points each, up to 30%)
    let optionalScore = 0;
    optional.forEach(field => {
      if (columnMapping[field] !== undefined) {
        const value = Object.values(row)[columnMapping[field]];
        if (value && String(value).trim()) {
          optionalScore += 0.05;
        }
      }
    });

    score += Math.min(optionalScore, 0.30);

    return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
  }
}

export const athenaScheduleParserService = new AthenaScheduleParserService();
