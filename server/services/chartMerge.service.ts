/**
 * Chart Merge Service
 *
 * Handles matching extracted clinical data with existing patient records.
 * Determines whether to add new records, update existing ones, or skip duplicates.
 * Uses fuzzy matching, RxNorm codes, and LOINC codes for intelligent merging.
 */

import { logger } from '../utils/logger';
import { rxnormLookupService } from './rxnormLookup.service';
import { loincLookupService } from './loincLookup.service';
import type { MedicationUpdate, LabUpdate, VitalUpdate, ChartUpdateResult } from './chartUpdateExtraction.service';

// Types
export interface ExistingMedication {
  id?: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status?: string;
  rxnorm_code?: string;
  start_date?: string;
  end_date?: string;
}

export interface ExistingLab {
  id?: string;
  test_name: string;
  value: number | string;
  unit?: string;
  date?: string;
  loinc_code?: string;
}

export interface ExistingVital {
  id?: string;
  type: string;
  value: number | string;
  systolic?: number;
  diastolic?: number;
  unit?: string;
  date?: string;
}

export interface MergeDecision {
  action: 'add' | 'update' | 'skip';
  reason: string;
  existingId?: string;
  matchScore?: number;
}

export interface MedicationMergeResult {
  medication: MedicationUpdate;
  decision: MergeDecision;
  existingRecord?: ExistingMedication;
  enrichedData?: {
    rxnorm_code?: string;
    normalized_name?: string;
  };
}

export interface LabMergeResult {
  lab: LabUpdate;
  decision: MergeDecision;
  existingRecord?: ExistingLab;
  enrichedData?: {
    loinc_code?: string;
    normalized_name?: string;
    standard_unit?: string;
  };
}

export interface VitalMergeResult {
  vital: VitalUpdate;
  decision: MergeDecision;
  existingRecord?: ExistingVital;
}

export interface ChartMergeResult {
  medications: MedicationMergeResult[];
  labs: LabMergeResult[];
  vitals: VitalMergeResult[];
  summary: {
    medicationsToAdd: number;
    medicationsToUpdate: number;
    medicationsSkipped: number;
    labsToAdd: number;
    labsToUpdate: number;
    labsSkipped: number;
    vitalsToAdd: number;
    vitalsToUpdate: number;
    vitalsSkipped: number;
  };
}

class ChartMergeService {
  private supabase: any = null;

  /**
   * Initialize with Supabase client
   */
  initialize(supabaseClient: any): void {
    this.supabase = supabaseClient;
    logger.info('ChartMerge', 'Service initialized with Supabase client');
  }

  /**
   * Process extracted data and determine merge actions
   */
  async processExtractedData(
    extractedData: ChartUpdateResult,
    patientId: string
  ): Promise<ChartMergeResult> {
    logger.info('ChartMerge', 'Processing extracted data for patient', { patientId });

    // Fetch existing patient data
    const existingData = await this.fetchExistingPatientData(patientId);

    // Process each category
    const medicationResults = await this.processMedications(
      extractedData.medications,
      existingData.medications
    );

    const labResults = await this.processLabs(
      extractedData.labs,
      existingData.labs
    );

    const vitalResults = await this.processVitals(
      extractedData.vitals,
      existingData.vitals
    );

    // Build summary
    const summary = {
      medicationsToAdd: medicationResults.filter(r => r.decision.action === 'add').length,
      medicationsToUpdate: medicationResults.filter(r => r.decision.action === 'update').length,
      medicationsSkipped: medicationResults.filter(r => r.decision.action === 'skip').length,
      labsToAdd: labResults.filter(r => r.decision.action === 'add').length,
      labsToUpdate: labResults.filter(r => r.decision.action === 'update').length,
      labsSkipped: labResults.filter(r => r.decision.action === 'skip').length,
      vitalsToAdd: vitalResults.filter(r => r.decision.action === 'add').length,
      vitalsToUpdate: vitalResults.filter(r => r.decision.action === 'update').length,
      vitalsSkipped: vitalResults.filter(r => r.decision.action === 'skip').length,
    };

    logger.info('ChartMerge', 'Merge processing complete', summary);

    return {
      medications: medicationResults,
      labs: labResults,
      vitals: vitalResults,
      summary
    };
  }

  /**
   * Fetch existing patient data from database
   */
  private async fetchExistingPatientData(patientId: string): Promise<{
    medications: ExistingMedication[];
    labs: ExistingLab[];
    vitals: ExistingVital[];
  }> {
    const result = {
      medications: [] as ExistingMedication[],
      labs: [] as ExistingLab[],
      vitals: [] as ExistingVital[]
    };

    if (!this.supabase) {
      logger.warn('ChartMerge', 'No Supabase client, returning empty existing data');
      return result;
    }

    try {
      // Fetch medications
      const { data: medsData } = await this.supabase
        .from('patient_medications')
        .select('*')
        .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
        .eq('status', 'active');

      if (medsData) {
        result.medications = medsData.map((m: any) => ({
          id: m.id,
          name: m.medication_name || m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          route: m.route,
          status: m.status,
          rxnorm_code: m.rxnorm_code,
          start_date: m.start_date
        }));
      }

      // Fetch labs from patient_comprehensive_chart
      const { data: chartData } = await this.supabase
        .from('patient_comprehensive_chart')
        .select('labs')
        .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
        .single();

      if (chartData?.labs) {
        // Labs might be stored as array or object
        const labsArray = Array.isArray(chartData.labs)
          ? chartData.labs
          : Object.values(chartData.labs);

        result.labs = labsArray.map((l: any) => ({
          id: l.id,
          test_name: l.test_name || l.name,
          value: l.value,
          unit: l.unit,
          date: l.date || l.collected_date,
          loinc_code: l.loinc_code
        }));
      }

      // Fetch vitals from patient_comprehensive_chart
      if (chartData) {
        const { data: vitalData } = await this.supabase
          .from('patient_comprehensive_chart')
          .select('vitals')
          .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
          .single();

        if (vitalData?.vitals) {
          const vitalsArray = Array.isArray(vitalData.vitals)
            ? vitalData.vitals
            : Object.values(vitalData.vitals);

          result.vitals = vitalsArray.map((v: any) => ({
            id: v.id,
            type: v.type,
            value: v.value,
            systolic: v.systolic,
            diastolic: v.diastolic,
            unit: v.unit,
            date: v.date
          }));
        }
      }

    } catch (error: any) {
      logger.warn('ChartMerge', 'Error fetching existing data', { error: error.message });
    }

    return result;
  }

  /**
   * Process medications and determine merge actions
   */
  private async processMedications(
    extracted: MedicationUpdate[],
    existing: ExistingMedication[]
  ): Promise<MedicationMergeResult[]> {
    const results: MedicationMergeResult[] = [];

    for (const med of extracted) {
      // Enrich with RxNorm code if not present
      let rxnormCode = med.rxnorm_code;
      let normalizedName = med.name;

      if (!rxnormCode && med.name) {
        try {
          const rxnormResult = await rxnormLookupService.lookupMedication(med.name);
          if (rxnormResult.found && rxnormResult.result) {
            rxnormCode = rxnormResult.result.rxcui;
            normalizedName = rxnormResult.result.name;
          }
        } catch (error) {
          // Continue without RxNorm code
        }
      }

      // Find matching existing medication
      const match = this.findMatchingMedication(med, existing, rxnormCode);

      let decision: MergeDecision;

      if (match.found && match.existingMed) {
        // Check if this is a meaningful update
        const hasNewInfo = this.medicationHasNewInfo(med, match.existingMed);

        if (hasNewInfo) {
          decision = {
            action: 'update',
            reason: `Update existing ${match.existingMed.name} with new information`,
            existingId: match.existingMed.id,
            matchScore: match.score
          };
        } else {
          decision = {
            action: 'skip',
            reason: `Duplicate of existing ${match.existingMed.name}`,
            existingId: match.existingMed.id,
            matchScore: match.score
          };
        }

        results.push({
          medication: med,
          decision,
          existingRecord: match.existingMed,
          enrichedData: {
            rxnorm_code: rxnormCode,
            normalized_name: normalizedName
          }
        });
      } else {
        // New medication
        decision = {
          action: 'add',
          reason: 'New medication not found in patient records'
        };

        results.push({
          medication: med,
          decision,
          enrichedData: {
            rxnorm_code: rxnormCode,
            normalized_name: normalizedName
          }
        });
      }
    }

    return results;
  }

  /**
   * Find matching medication in existing records
   */
  private findMatchingMedication(
    extracted: MedicationUpdate,
    existing: ExistingMedication[],
    rxnormCode?: string
  ): { found: boolean; existingMed?: ExistingMedication; score: number } {
    let bestMatch: ExistingMedication | undefined;
    let bestScore = 0;

    for (const existingMed of existing) {
      let score = 0;

      // RxNorm code match (highest confidence)
      if (rxnormCode && existingMed.rxnorm_code === rxnormCode) {
        score = 100;
      } else {
        // Name similarity match
        score = this.calculateNameSimilarity(extracted.name, existingMed.name);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = existingMed;
      }
    }

    // Threshold for considering a match
    const MATCH_THRESHOLD = 80;

    return {
      found: bestScore >= MATCH_THRESHOLD,
      existingMed: bestScore >= MATCH_THRESHOLD ? bestMatch : undefined,
      score: bestScore
    };
  }

  /**
   * Check if extracted medication has new information to add
   */
  private medicationHasNewInfo(
    extracted: MedicationUpdate,
    existing: ExistingMedication
  ): boolean {
    // New dosage when none existed
    if (extracted.dosage && !existing.dosage) return true;

    // Different dosage (potential update)
    if (extracted.dosage && existing.dosage &&
        extracted.dosage.toLowerCase() !== existing.dosage.toLowerCase()) return true;

    // New frequency when none existed
    if (extracted.frequency && !existing.frequency) return true;

    // Different frequency
    if (extracted.frequency && existing.frequency &&
        extracted.frequency.toLowerCase() !== existing.frequency.toLowerCase()) return true;

    // Status change (e.g., discontinued)
    if (extracted.status !== existing.status) return true;

    return false;
  }

  /**
   * Process labs and determine merge actions
   */
  private async processLabs(
    extracted: LabUpdate[],
    existing: ExistingLab[]
  ): Promise<LabMergeResult[]> {
    const results: LabMergeResult[] = [];

    for (const lab of extracted) {
      // Enrich with LOINC code if not present
      let loincCode = lab.loinc_code;
      let normalizedName = lab.test_name;
      let standardUnit = lab.unit;

      if (!loincCode && lab.test_name) {
        try {
          const loincResult = await loincLookupService.lookupLabTest(lab.test_name);
          if (loincResult.found && loincResult.result) {
            loincCode = loincResult.result.loinc_code;
            normalizedName = loincResult.result.common_name;
            standardUnit = loincResult.result.units || lab.unit;
          }
        } catch (error) {
          // Continue without LOINC code
        }
      }

      // Find matching existing lab
      const match = this.findMatchingLab(lab, existing, loincCode);

      let decision: MergeDecision;

      if (match.found && match.existingLab) {
        // Check if this is a new result (different date or value)
        const isDuplicate = this.isLabDuplicate(lab, match.existingLab);

        if (isDuplicate) {
          decision = {
            action: 'skip',
            reason: `Duplicate lab result for ${match.existingLab.test_name}`,
            existingId: match.existingLab.id,
            matchScore: match.score
          };
        } else {
          // New result for same test - add to history
          decision = {
            action: 'add',
            reason: `New result for ${normalizedName} (different date or value)`,
            matchScore: match.score
          };
        }

        results.push({
          lab,
          decision,
          existingRecord: match.existingLab,
          enrichedData: {
            loinc_code: loincCode,
            normalized_name: normalizedName,
            standard_unit: standardUnit
          }
        });
      } else {
        // New lab test
        decision = {
          action: 'add',
          reason: 'New lab test type not previously recorded'
        };

        results.push({
          lab,
          decision,
          enrichedData: {
            loinc_code: loincCode,
            normalized_name: normalizedName,
            standard_unit: standardUnit
          }
        });
      }
    }

    return results;
  }

  /**
   * Find matching lab in existing records
   */
  private findMatchingLab(
    extracted: LabUpdate,
    existing: ExistingLab[],
    loincCode?: string
  ): { found: boolean; existingLab?: ExistingLab; score: number } {
    let bestMatch: ExistingLab | undefined;
    let bestScore = 0;

    for (const existingLab of existing) {
      let score = 0;

      // LOINC code match (highest confidence)
      if (loincCode && existingLab.loinc_code === loincCode) {
        score = 100;
      } else {
        // Name similarity match
        score = this.calculateNameSimilarity(extracted.test_name, existingLab.test_name);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = existingLab;
      }
    }

    const MATCH_THRESHOLD = 80;

    return {
      found: bestScore >= MATCH_THRESHOLD,
      existingLab: bestScore >= MATCH_THRESHOLD ? bestMatch : undefined,
      score: bestScore
    };
  }

  /**
   * Check if lab is a duplicate of existing result
   */
  private isLabDuplicate(extracted: LabUpdate, existing: ExistingLab): boolean {
    // Same value and same date = duplicate
    if (extracted.value === existing.value && extracted.date === existing.date) {
      return true;
    }

    // Same value and no date on extracted (likely referring to existing)
    if (extracted.value === existing.value && !extracted.date) {
      return true;
    }

    return false;
  }

  /**
   * Process vitals and determine merge actions
   */
  private async processVitals(
    extracted: VitalUpdate[],
    existing: ExistingVital[]
  ): Promise<VitalMergeResult[]> {
    const results: VitalMergeResult[] = [];

    for (const vital of extracted) {
      // Find matching existing vital by type
      const match = this.findMatchingVital(vital, existing);

      let decision: MergeDecision;

      if (match.found && match.existingVital) {
        // Check if this is the same reading
        const isDuplicate = this.isVitalDuplicate(vital, match.existingVital);

        if (isDuplicate) {
          decision = {
            action: 'skip',
            reason: `Duplicate ${vital.type} reading`,
            existingId: match.existingVital.id,
            matchScore: match.score
          };
        } else {
          // New reading for same vital type
          decision = {
            action: 'add',
            reason: `New ${vital.type} reading`,
            matchScore: match.score
          };
        }

        results.push({
          vital,
          decision,
          existingRecord: match.existingVital
        });
      } else {
        // New vital type
        decision = {
          action: 'add',
          reason: `New ${vital.type} measurement`
        };

        results.push({
          vital,
          decision
        });
      }
    }

    return results;
  }

  /**
   * Find matching vital in existing records
   */
  private findMatchingVital(
    extracted: VitalUpdate,
    existing: ExistingVital[]
  ): { found: boolean; existingVital?: ExistingVital; score: number } {
    // Normalize vital type for matching
    const normalizedType = this.normalizeVitalType(extracted.type);

    for (const existingVital of existing) {
      const existingNormalizedType = this.normalizeVitalType(existingVital.type);

      if (normalizedType === existingNormalizedType) {
        return {
          found: true,
          existingVital,
          score: 100
        };
      }
    }

    return { found: false, score: 0 };
  }

  /**
   * Normalize vital type names
   */
  private normalizeVitalType(type: string): string {
    const normalized = type.toLowerCase().trim();

    const mappings: Record<string, string> = {
      'bp': 'blood_pressure',
      'blood pressure': 'blood_pressure',
      'systolic': 'blood_pressure',
      'diastolic': 'blood_pressure',
      'weight': 'weight',
      'wt': 'weight',
      'hr': 'heart_rate',
      'heart rate': 'heart_rate',
      'pulse': 'heart_rate',
      'temp': 'temperature',
      'temperature': 'temperature',
      'spo2': 'oxygen_saturation',
      'o2 sat': 'oxygen_saturation',
      'oxygen saturation': 'oxygen_saturation',
      'o2': 'oxygen_saturation',
      'bmi': 'bmi',
      'body mass index': 'bmi'
    };

    return mappings[normalized] || normalized;
  }

  /**
   * Check if vital is a duplicate
   */
  private isVitalDuplicate(extracted: VitalUpdate, existing: ExistingVital): boolean {
    // Same date and same values
    if (extracted.date === existing.date) {
      // For blood pressure, check both systolic and diastolic
      if (extracted.systolic !== undefined) {
        return extracted.systolic === existing.systolic &&
               extracted.diastolic === existing.diastolic;
      }
      return extracted.value === existing.value;
    }

    // No date on extracted but same values (likely duplicate)
    if (!extracted.date) {
      if (extracted.systolic !== undefined) {
        return extracted.systolic === existing.systolic &&
               extracted.diastolic === existing.diastolic;
      }
      return extracted.value === existing.value;
    }

    return false;
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 100;

    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 90;

    // Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    // Convert distance to similarity percentage
    const similarity = ((maxLength - distance) / maxLength) * 100;

    return Math.round(similarity);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // Create matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Apply approved merge results to the database
   */
  async applyMergeResults(
    mergeResult: ChartMergeResult,
    patientId: string,
    userId: string
  ): Promise<{ success: boolean; applied: number; errors: string[] }> {
    if (!this.supabase) {
      return { success: false, applied: 0, errors: ['Database not initialized'] };
    }

    let applied = 0;
    const errors: string[] = [];

    try {
      // Apply medication changes
      for (const medResult of mergeResult.medications) {
        if (medResult.decision.action === 'skip') continue;

        try {
          if (medResult.decision.action === 'add') {
            await this.addMedication(patientId, medResult, userId);
            applied++;
          } else if (medResult.decision.action === 'update') {
            await this.updateMedication(medResult, userId);
            applied++;
          }
        } catch (error: any) {
          errors.push(`Failed to ${medResult.decision.action} medication ${medResult.medication.name}: ${error.message}`);
        }
      }

      // Apply lab changes
      for (const labResult of mergeResult.labs) {
        if (labResult.decision.action === 'skip') continue;

        try {
          if (labResult.decision.action === 'add') {
            await this.addLab(patientId, labResult, userId);
            applied++;
          }
        } catch (error: any) {
          errors.push(`Failed to add lab ${labResult.lab.test_name}: ${error.message}`);
        }
      }

      // Apply vital changes
      for (const vitalResult of mergeResult.vitals) {
        if (vitalResult.decision.action === 'skip') continue;

        try {
          if (vitalResult.decision.action === 'add') {
            await this.addVital(patientId, vitalResult, userId);
            applied++;
          }
        } catch (error: any) {
          errors.push(`Failed to add vital ${vitalResult.vital.type}: ${error.message}`);
        }
      }

      logger.info('ChartMerge', 'Applied merge results', { patientId, applied, errors: errors.length });

      return {
        success: errors.length === 0,
        applied,
        errors
      };

    } catch (error: any) {
      logger.error('ChartMerge', 'Failed to apply merge results', { error: error.message });
      return { success: false, applied, errors: [error.message] };
    }
  }

  /**
   * Add new medication to database
   */
  private async addMedication(
    patientId: string,
    medResult: MedicationMergeResult,
    userId: string
  ): Promise<void> {
    const med = medResult.medication;
    const enriched = medResult.enrichedData;

    await this.supabase
      .from('patient_medications')
      .insert({
        unified_patient_id: patientId,
        medication_name: enriched?.normalized_name || med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        route: med.route,
        indication: med.indication,
        status: med.status || 'active',
        rxnorm_code: enriched?.rxnorm_code,
        completeness_score: med.completeness,
        missing_fields: med.missingFields,
        source: 'voice_dictation',
        created_by: userId,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Update existing medication in database
   */
  private async updateMedication(
    medResult: MedicationMergeResult,
    userId: string
  ): Promise<void> {
    const med = medResult.medication;
    const enriched = medResult.enrichedData;
    const existingId = medResult.decision.existingId;

    const updates: Record<string, any> = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    // Only update fields that have values
    if (med.dosage) updates.dosage = med.dosage;
    if (med.frequency) updates.frequency = med.frequency;
    if (med.route) updates.route = med.route;
    if (med.indication) updates.indication = med.indication;
    if (med.status) updates.status = med.status;
    if (enriched?.rxnorm_code) updates.rxnorm_code = enriched.rxnorm_code;

    // Recalculate completeness
    updates.completeness_score = med.completeness;
    updates.missing_fields = med.missingFields;

    await this.supabase
      .from('patient_medications')
      .update(updates)
      .eq('id', existingId);
  }

  /**
   * Add new lab to chart
   */
  private async addLab(
    patientId: string,
    labResult: LabMergeResult,
    userId: string
  ): Promise<void> {
    const lab = labResult.lab;
    const enriched = labResult.enrichedData;

    // Get current chart data
    const { data: chartData } = await this.supabase
      .from('patient_comprehensive_chart')
      .select('labs')
      .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .single();

    const currentLabs = chartData?.labs || [];

    // Add new lab result
    const newLab = {
      id: crypto.randomUUID(),
      test_name: enriched?.normalized_name || lab.test_name,
      value: lab.value,
      unit: enriched?.standard_unit || lab.unit,
      date: lab.date,
      date_inferred: lab.date_inferred,
      loinc_code: enriched?.loinc_code,
      completeness_score: lab.completeness,
      source: 'voice_dictation',
      created_by: userId,
      created_at: new Date().toISOString()
    };

    const updatedLabs = [...currentLabs, newLab];

    await this.supabase
      .from('patient_comprehensive_chart')
      .update({
        labs: updatedLabs,
        last_voice_update: new Date().toISOString()
      })
      .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`);
  }

  /**
   * Add new vital to chart
   */
  private async addVital(
    patientId: string,
    vitalResult: VitalMergeResult,
    userId: string
  ): Promise<void> {
    const vital = vitalResult.vital;

    // Get current chart data
    const { data: chartData } = await this.supabase
      .from('patient_comprehensive_chart')
      .select('vitals')
      .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`)
      .single();

    const currentVitals = chartData?.vitals || [];

    // Add new vital
    const newVital = {
      id: crypto.randomUUID(),
      type: vital.type,
      value: vital.value,
      systolic: vital.systolic,
      diastolic: vital.diastolic,
      unit: vital.unit,
      date: vital.date || new Date().toISOString().split('T')[0],
      source: 'voice_dictation',
      created_by: userId,
      created_at: new Date().toISOString()
    };

    const updatedVitals = [...currentVitals, newVital];

    await this.supabase
      .from('patient_comprehensive_chart')
      .update({
        vitals: updatedVitals,
        last_voice_update: new Date().toISOString()
      })
      .or(`unified_patient_id.eq.${patientId},tshla_id.eq.${patientId}`);
  }

  /**
   * Fill in missing field for an existing record
   */
  async fillMissingField(
    recordType: 'medication' | 'lab',
    recordId: string,
    fieldName: string,
    fieldValue: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      if (recordType === 'medication') {
        const { error } = await this.supabase
          .from('patient_medications')
          .update({
            [fieldName]: fieldValue,
            updated_by: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', recordId);

        if (error) throw error;

        // Recalculate completeness
        await this.recalculateMedicationCompleteness(recordId);
      }

      logger.info('ChartMerge', 'Filled missing field', { recordType, recordId, fieldName });
      return { success: true };

    } catch (error: any) {
      logger.error('ChartMerge', 'Failed to fill missing field', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate medication completeness score
   */
  private async recalculateMedicationCompleteness(medicationId: string): Promise<void> {
    const { data: med } = await this.supabase
      .from('patient_medications')
      .select('*')
      .eq('id', medicationId)
      .single();

    if (!med) return;

    const missingFields: string[] = [];
    if (!med.dosage) missingFields.push('dosage');
    if (!med.frequency) missingFields.push('frequency');

    const requiredFields = 3; // name, dosage, frequency
    const presentFields = requiredFields - missingFields.length;
    const completeness = Math.round((presentFields / requiredFields) * 100);

    await this.supabase
      .from('patient_medications')
      .update({
        completeness_score: completeness,
        missing_fields: missingFields
      })
      .eq('id', medicationId);
  }
}

// Export singleton instance
export const chartMergeService = new ChartMergeService();

export default chartMergeService;
