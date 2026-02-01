/**
 * TSH ID Display Tests
 *
 * These tests prevent the bug where patient_id (8-digit) was displayed
 * instead of tshla_id (formatted "TSH XXX-XXX")
 *
 * If these tests fail, it means someone is using the wrong field!
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDisplayTshId,
  getDisplayMrn,
  getInternalPatientId,
  getSchedulePatientIds,
  isValidTshIdFormat,
  isValidPatientIdFormat,
  hasValidTshId,
} from '../utils/patient-id-formatter';
import type { UnifiedPatient, SchedulePatientData } from '../types/unified-patient.types';

describe('TSH ID Display Validation', () => {
  let mockPatient: SchedulePatientData;

  beforeEach(() => {
    mockPatient = {
      patient_id: '99364924',      // 8-digit internal ID
      tshla_id: 'TSH 972-918',     // Formatted TSH ID
      mrn: '26996854',             // Athena MRN
      first_name: 'LEANNETTE',
      last_name: 'HIX',
      phone_primary: '8179944293',
      email: 'leannette@example.com',
      date_of_birth: '1975-05-15',
      gender: 'F',
    };
  });

  describe('getDisplayTshId()', () => {
    it('should return formatted TSH ID, NOT patient_id', () => {
      const tshId = getDisplayTshId(mockPatient);

      // ✅ MUST be formatted TSH ID
      expect(tshId).toBe('TSH 972-918');

      // ❌ MUST NOT be 8-digit patient_id
      expect(tshId).not.toBe('99364924');
      expect(tshId).not.toBe(mockPatient.patient_id);
    });

    it('should return null if patient is null', () => {
      expect(getDisplayTshId(null)).toBeNull();
      expect(getDisplayTshId(undefined)).toBeNull();
    });

    it('should return null if tshla_id is missing', () => {
      const patientWithoutTshId = {
        ...mockPatient,
        tshla_id: null as any,
      };

      expect(getDisplayTshId(patientWithoutTshId)).toBeNull();
    });

    it('should detect if someone accidentally used patient_id', () => {
      // Simulate the bug: someone used patient_id instead of tshla_id
      const buggyPatient = {
        ...mockPatient,
        tshla_id: mockPatient.patient_id, // ❌ This is the bug!
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      getDisplayTshId(buggyPatient);

      // Should log error about invalid format
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid TSH ID format')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('patient_id')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getDisplayMrn()', () => {
    it('should return MRN from patient record', () => {
      const mrn = getDisplayMrn(mockPatient);
      expect(mrn).toBe('26996854');
    });

    it('should use fallback MRN if patient record has none', () => {
      const patientWithoutMrn = {
        ...mockPatient,
        mrn: undefined,
      };

      const mrn = getDisplayMrn(patientWithoutMrn, '12345678');
      expect(mrn).toBe('12345678');
    });

    it('should prefer patient record MRN over fallback', () => {
      const mrn = getDisplayMrn(mockPatient, '12345678');
      expect(mrn).toBe('26996854'); // Should use patient record, not fallback
    });
  });

  describe('getSchedulePatientIds()', () => {
    it('should return all IDs with correct fields', () => {
      const ids = getSchedulePatientIds(mockPatient, 'FALLBACK_MRN');

      // TSH ID must be formatted, NOT 8-digit
      expect(ids.tsh_id).toBe('TSH 972-918');
      expect(ids.tsh_id).not.toBe('99364924');

      // MRN should be present
      expect(ids.mrn).toBe('26996854');

      // Internal ID is 8-digit (but not for display)
      expect(ids.internal_id).toBe('99364924');
    });

    it('should handle null patient gracefully', () => {
      const ids = getSchedulePatientIds(null, 'FALLBACK_MRN');

      expect(ids.tsh_id).toBeNull();
      expect(ids.mrn).toBe('FALLBACK_MRN');
      expect(ids.internal_id).toBeNull();
    });
  });

  describe('Format Validation', () => {
    describe('isValidTshIdFormat()', () => {
      it('should accept valid TSH ID format', () => {
        expect(isValidTshIdFormat('TSH 972-918')).toBe(true);
        expect(isValidTshIdFormat('TSH 000-000')).toBe(true);
        expect(isValidTshIdFormat('TSH 999-999')).toBe(true);
      });

      it('should reject invalid formats', () => {
        // ❌ 8-digit patient_id (common mistake!)
        expect(isValidTshIdFormat('99364924')).toBe(false);

        // ❌ Missing space
        expect(isValidTshIdFormat('TSH972-918')).toBe(false);

        // ❌ Wrong separator
        expect(isValidTshIdFormat('TSH 972_918')).toBe(false);

        // ❌ Wrong length
        expect(isValidTshIdFormat('TSH 97-91')).toBe(false);
        expect(isValidTshIdFormat('TSH 9721-9181')).toBe(false);

        // ❌ Null/undefined
        expect(isValidTshIdFormat(null)).toBe(false);
        expect(isValidTshIdFormat(undefined)).toBe(false);
      });
    });

    describe('isValidPatientIdFormat()', () => {
      it('should accept valid 8-digit patient_id', () => {
        expect(isValidPatientIdFormat('99364924')).toBe(true);
        expect(isValidPatientIdFormat('00000001')).toBe(true);
      });

      it('should reject invalid formats', () => {
        // ❌ TSH ID format (someone confused the fields!)
        expect(isValidPatientIdFormat('TSH 972-918')).toBe(false);

        // ❌ Wrong length
        expect(isValidPatientIdFormat('1234567')).toBe(false);
        expect(isValidPatientIdFormat('123456789')).toBe(false);

        // ❌ Non-numeric
        expect(isValidPatientIdFormat('ABC12345')).toBe(false);

        // ❌ Null/undefined
        expect(isValidPatientIdFormat(null)).toBe(false);
      });
    });
  });

  describe('hasValidTshId()', () => {
    it('should return true for patient with valid TSH ID', () => {
      expect(hasValidTshId(mockPatient)).toBe(true);
    });

    it('should return false for patient with invalid TSH ID', () => {
      const invalidPatient = {
        ...mockPatient,
        tshla_id: '99364924', // ❌ This is patient_id, not tshla_id!
      };

      expect(hasValidTshId(invalidPatient)).toBe(false);
    });

    it('should return false for null patient', () => {
      expect(hasValidTshId(null)).toBe(false);
      expect(hasValidTshId(undefined)).toBe(false);
    });
  });

  describe('Regression Tests - Prevent Bug from Happening Again', () => {
    it('CRITICAL: Schedule must NEVER show 8-digit patient_id as TSH ID', () => {
      // This test specifically prevents the bug that happened
      const displayValue = getDisplayTshId(mockPatient);

      // The bug: displayValue was "99364924" (patient_id)
      // Should be: "TSH 972-918" (tshla_id)

      // FAIL if showing 8-digit number
      expect(displayValue).not.toMatch(/^\d{8}$/);

      // FAIL if showing patient_id
      expect(displayValue).not.toBe(mockPatient.patient_id);

      // PASS only if showing formatted tshla_id
      expect(displayValue).toMatch(/^TSH \d{3}-\d{3}$/);
      expect(displayValue).toBe(mockPatient.tshla_id);
    });

    it('CRITICAL: getSchedulePatientIds must use tshla_id, not patient_id', () => {
      const ids = getSchedulePatientIds(mockPatient);

      // The bug: tsh_id was set to patient.patient_id
      // Should be: tsh_id set to patient.tshla_id

      // FAIL if tsh_id is 8-digit
      expect(ids.tsh_id).not.toMatch(/^\d{8}$/);

      // FAIL if tsh_id equals patient_id
      expect(ids.tsh_id).not.toBe(mockPatient.patient_id);

      // PASS only if tsh_id is formatted
      expect(ids.tsh_id).toBe('TSH 972-918');
      expect(ids.tsh_id).toBe(mockPatient.tshla_id);
    });

    it('CRITICAL: Component mapping must use correct field', () => {
      // Simulate what happens in schedule components
      const patient = mockPatient;

      // ❌ WRONG (this was the bug):
      // const appointmentData = {
      //   tshId: patient.patient_id  // Shows "99364924"
      // };

      // ✅ CORRECT:
      const appointmentData = {
        tshId: getDisplayTshId(patient),  // Shows "TSH 972-918"
      };

      expect(appointmentData.tshId).toBe('TSH 972-918');
      expect(appointmentData.tshId).not.toBe('99364924');
    });
  });
});
