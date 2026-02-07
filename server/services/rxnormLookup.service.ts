/**
 * RxNorm Lookup Service
 *
 * Looks up RxNorm codes for medications using the NLM RxNorm REST API.
 * Includes caching to minimize API calls.
 *
 * API Documentation: https://rxnav.nlm.nih.gov/REST
 */

import { logger } from '../utils/logger';

// Types
export interface RxNormResult {
  rxcui: string;
  name: string;
  synonym?: string;
  tty: string; // Term Type (SCD, SBD, IN, PIN, etc.)
  strength?: string;
  doseForm?: string;
}

export interface RxNormSearchResult {
  found: boolean;
  result?: RxNormResult;
  suggestions?: string[];
  cached: boolean;
}

// In-memory cache (could be replaced with Redis)
const cache = new Map<string, { result: RxNormSearchResult; timestamp: number }>();
const CACHE_TTL_MS = 3600000; // 1 hour

// Common medication mappings for instant lookup
const COMMON_MEDICATIONS: Record<string, RxNormResult> = {
  'metformin': { rxcui: '6809', name: 'Metformin', tty: 'IN' },
  'metformin 500mg': { rxcui: '860975', name: 'Metformin 500 MG', tty: 'SCD', strength: '500 MG' },
  'metformin 1000mg': { rxcui: '860981', name: 'Metformin 1000 MG', tty: 'SCD', strength: '1000 MG' },
  'lisinopril': { rxcui: '29046', name: 'Lisinopril', tty: 'IN' },
  'lisinopril 10mg': { rxcui: '314076', name: 'Lisinopril 10 MG', tty: 'SCD', strength: '10 MG' },
  'lisinopril 20mg': { rxcui: '314077', name: 'Lisinopril 20 MG', tty: 'SCD', strength: '20 MG' },
  'atorvastatin': { rxcui: '83367', name: 'Atorvastatin', tty: 'IN' },
  'atorvastatin 10mg': { rxcui: '617312', name: 'Atorvastatin 10 MG', tty: 'SCD', strength: '10 MG' },
  'atorvastatin 20mg': { rxcui: '617310', name: 'Atorvastatin 20 MG', tty: 'SCD', strength: '20 MG' },
  'atorvastatin 40mg': { rxcui: '259255', name: 'Atorvastatin 40 MG', tty: 'SCD', strength: '40 MG' },
  'amlodipine': { rxcui: '17767', name: 'Amlodipine', tty: 'IN' },
  'amlodipine 5mg': { rxcui: '329528', name: 'Amlodipine 5 MG', tty: 'SCD', strength: '5 MG' },
  'amlodipine 10mg': { rxcui: '329527', name: 'Amlodipine 10 MG', tty: 'SCD', strength: '10 MG' },
  'levothyroxine': { rxcui: '10582', name: 'Levothyroxine', tty: 'IN' },
  'levothyroxine 50mcg': { rxcui: '966222', name: 'Levothyroxine Sodium 0.05 MG', tty: 'SCD', strength: '0.05 MG' },
  'levothyroxine 75mcg': { rxcui: '966228', name: 'Levothyroxine Sodium 0.075 MG', tty: 'SCD', strength: '0.075 MG' },
  'levothyroxine 100mcg': { rxcui: '966231', name: 'Levothyroxine Sodium 0.1 MG', tty: 'SCD', strength: '0.1 MG' },
  'aspirin': { rxcui: '1191', name: 'Aspirin', tty: 'IN' },
  'aspirin 81mg': { rxcui: '243670', name: 'Aspirin 81 MG', tty: 'SCD', strength: '81 MG' },
  'aspirin 325mg': { rxcui: '212033', name: 'Aspirin 325 MG', tty: 'SCD', strength: '325 MG' },
  'omeprazole': { rxcui: '7646', name: 'Omeprazole', tty: 'IN' },
  'omeprazole 20mg': { rxcui: '198048', name: 'Omeprazole 20 MG', tty: 'SCD', strength: '20 MG' },
  'omeprazole 40mg': { rxcui: '198049', name: 'Omeprazole 40 MG', tty: 'SCD', strength: '40 MG' },
  'losartan': { rxcui: '52175', name: 'Losartan', tty: 'IN' },
  'losartan 25mg': { rxcui: '979485', name: 'Losartan Potassium 25 MG', tty: 'SCD', strength: '25 MG' },
  'losartan 50mg': { rxcui: '979480', name: 'Losartan Potassium 50 MG', tty: 'SCD', strength: '50 MG' },
  'losartan 100mg': { rxcui: '979467', name: 'Losartan Potassium 100 MG', tty: 'SCD', strength: '100 MG' },
  'gabapentin': { rxcui: '25480', name: 'Gabapentin', tty: 'IN' },
  'gabapentin 100mg': { rxcui: '310431', name: 'Gabapentin 100 MG', tty: 'SCD', strength: '100 MG' },
  'gabapentin 300mg': { rxcui: '310433', name: 'Gabapentin 300 MG', tty: 'SCD', strength: '300 MG' },
  'gabapentin 600mg': { rxcui: '310434', name: 'Gabapentin 600 MG', tty: 'SCD', strength: '600 MG' },
  'hydrochlorothiazide': { rxcui: '5487', name: 'Hydrochlorothiazide', tty: 'IN' },
  'hydrochlorothiazide 25mg': { rxcui: '310798', name: 'Hydrochlorothiazide 25 MG', tty: 'SCD', strength: '25 MG' },

  // Diabetes medications
  'glipizide': { rxcui: '4821', name: 'Glipizide', tty: 'IN' },
  'glipizide 5mg': { rxcui: '310490', name: 'Glipizide 5 MG', tty: 'SCD', strength: '5 MG' },
  'glipizide 10mg': { rxcui: '310489', name: 'Glipizide 10 MG', tty: 'SCD', strength: '10 MG' },
  'glimepiride': { rxcui: '25789', name: 'Glimepiride', tty: 'IN' },
  'glimepiride 2mg': { rxcui: '199246', name: 'Glimepiride 2 MG', tty: 'SCD', strength: '2 MG' },
  'glimepiride 4mg': { rxcui: '199247', name: 'Glimepiride 4 MG', tty: 'SCD', strength: '4 MG' },
  'pioglitazone': { rxcui: '33738', name: 'Pioglitazone', tty: 'IN' },
  'pioglitazone 15mg': { rxcui: '312440', name: 'Pioglitazone 15 MG', tty: 'SCD', strength: '15 MG' },
  'pioglitazone 30mg': { rxcui: '312441', name: 'Pioglitazone 30 MG', tty: 'SCD', strength: '30 MG' },
  'sitagliptin': { rxcui: '593411', name: 'Sitagliptin', tty: 'IN' },
  'januvia': { rxcui: '593411', name: 'Sitagliptin', tty: 'IN' },
  'jardiance': { rxcui: '1545653', name: 'Empagliflozin', tty: 'IN' },
  'empagliflozin': { rxcui: '1545653', name: 'Empagliflozin', tty: 'IN' },
  'farxiga': { rxcui: '1488564', name: 'Dapagliflozin', tty: 'IN' },
  'dapagliflozin': { rxcui: '1488564', name: 'Dapagliflozin', tty: 'IN' },
  'invokana': { rxcui: '1373458', name: 'Canagliflozin', tty: 'IN' },
  'canagliflozin': { rxcui: '1373458', name: 'Canagliflozin', tty: 'IN' },

  // GLP-1 agonists
  'ozempic': { rxcui: '1991302', name: 'Semaglutide', tty: 'IN' },
  'semaglutide': { rxcui: '1991302', name: 'Semaglutide', tty: 'IN' },
  'wegovy': { rxcui: '1991302', name: 'Semaglutide', tty: 'IN' },
  'rybelsus': { rxcui: '1991302', name: 'Semaglutide', tty: 'IN' },
  'trulicity': { rxcui: '1551291', name: 'Dulaglutide', tty: 'IN' },
  'dulaglutide': { rxcui: '1551291', name: 'Dulaglutide', tty: 'IN' },
  'victoza': { rxcui: '897122', name: 'Liraglutide', tty: 'IN' },
  'liraglutide': { rxcui: '897122', name: 'Liraglutide', tty: 'IN' },
  'saxenda': { rxcui: '897122', name: 'Liraglutide', tty: 'IN' },
  'mounjaro': { rxcui: '2601734', name: 'Tirzepatide', tty: 'IN' },
  'tirzepatide': { rxcui: '2601734', name: 'Tirzepatide', tty: 'IN' },
  'zepbound': { rxcui: '2601734', name: 'Tirzepatide', tty: 'IN' },

  // Insulins
  'lantus': { rxcui: '261551', name: 'Insulin Glargine', tty: 'IN' },
  'insulin glargine': { rxcui: '261551', name: 'Insulin Glargine', tty: 'IN' },
  'basaglar': { rxcui: '261551', name: 'Insulin Glargine', tty: 'IN' },
  'toujeo': { rxcui: '261551', name: 'Insulin Glargine', tty: 'IN' },
  'levemir': { rxcui: '51428', name: 'Insulin Detemir', tty: 'IN' },
  'insulin detemir': { rxcui: '51428', name: 'Insulin Detemir', tty: 'IN' },
  'tresiba': { rxcui: '1374052', name: 'Insulin Degludec', tty: 'IN' },
  'insulin degludec': { rxcui: '1374052', name: 'Insulin Degludec', tty: 'IN' },
  'novolog': { rxcui: '86009', name: 'Insulin Aspart', tty: 'IN' },
  'insulin aspart': { rxcui: '86009', name: 'Insulin Aspart', tty: 'IN' },
  'humalog': { rxcui: '86009', name: 'Insulin Lispro', tty: 'IN' },
  'insulin lispro': { rxcui: '86009', name: 'Insulin Lispro', tty: 'IN' },
  'apidra': { rxcui: '274783', name: 'Insulin Glulisine', tty: 'IN' },
  'insulin glulisine': { rxcui: '274783', name: 'Insulin Glulisine', tty: 'IN' },
  'humulin': { rxcui: '5856', name: 'Insulin, Regular, Human', tty: 'IN' },
  'novolin': { rxcui: '5856', name: 'Insulin, Regular, Human', tty: 'IN' },
  'regular insulin': { rxcui: '5856', name: 'Insulin, Regular, Human', tty: 'IN' },
  'nph insulin': { rxcui: '5857', name: 'Insulin, Isophane, Human', tty: 'IN' }
};

class RxNormLookupService {
  private baseUrl = 'https://rxnav.nlm.nih.gov/REST';

  /**
   * Look up a medication by name
   */
  async lookupMedication(medicationName: string): Promise<RxNormSearchResult> {
    const normalizedName = medicationName.toLowerCase().trim();

    // Check cache first
    const cached = this.checkCache(normalizedName);
    if (cached) {
      return cached;
    }

    // Check common medications lookup table
    if (COMMON_MEDICATIONS[normalizedName]) {
      const result: RxNormSearchResult = {
        found: true,
        result: COMMON_MEDICATIONS[normalizedName],
        cached: false
      };
      this.setCache(normalizedName, result);
      return result;
    }

    // Call NLM RxNorm API
    try {
      const result = await this.searchRxNormAPI(medicationName);
      this.setCache(normalizedName, result);
      return result;
    } catch (error: any) {
      logger.error('RxNormLookup', 'API call failed', { error: error.message, medication: medicationName });
      return { found: false, cached: false };
    }
  }

  /**
   * Search the RxNorm API
   */
  private async searchRxNormAPI(medicationName: string): Promise<RxNormSearchResult> {
    const url = `${this.baseUrl}/rxcui.json?name=${encodeURIComponent(medicationName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`RxNorm API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.idGroup?.rxnormId?.length > 0) {
      const rxcui = data.idGroup.rxnormId[0];
      const properties = await this.getProperties(rxcui);

      return {
        found: true,
        result: {
          rxcui,
          name: properties?.name || medicationName,
          tty: properties?.tty || 'IN',
          strength: properties?.strength,
          doseForm: properties?.doseForm
        },
        cached: false
      };
    }

    // Try approximate search if exact match not found
    return this.approximateSearch(medicationName);
  }

  /**
   * Get medication properties by RxCUI
   */
  private async getProperties(rxcui: string): Promise<{
    name?: string;
    tty?: string;
    strength?: string;
    doseForm?: string;
  } | null> {
    try {
      const url = `${this.baseUrl}/rxcui/${rxcui}/properties.json`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const data = await response.json();
      const props = data.properties;

      return {
        name: props?.name,
        tty: props?.tty,
        // Parse strength and dose form from name if available
        strength: this.extractStrength(props?.name),
        doseForm: this.extractDoseForm(props?.name)
      };
    } catch {
      return null;
    }
  }

  /**
   * Approximate search for medications
   */
  private async approximateSearch(medicationName: string): Promise<RxNormSearchResult> {
    const url = `${this.baseUrl}/approximateTerm.json?term=${encodeURIComponent(medicationName)}&maxEntries=5`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { found: false, cached: false };
      }

      const data = await response.json();
      const candidates = data.approximateGroup?.candidate;

      if (candidates && candidates.length > 0) {
        const best = candidates[0];
        return {
          found: true,
          result: {
            rxcui: best.rxcui,
            name: best.name || medicationName,
            tty: best.tty || 'IN'
          },
          suggestions: candidates.slice(1, 4).map((c: any) => c.name),
          cached: false
        };
      }
    } catch {
      // Fall through to not found
    }

    return { found: false, cached: false };
  }

  /**
   * Extract strength from medication name
   */
  private extractStrength(name?: string): string | undefined {
    if (!name) return undefined;

    // Match patterns like "500 MG", "10 MG", "0.5 MG", "100 MCG"
    const match = name.match(/(\d+\.?\d*)\s*(mg|mcg|g|ml|units?)/i);
    return match ? `${match[1]} ${match[2].toUpperCase()}` : undefined;
  }

  /**
   * Extract dose form from medication name
   */
  private extractDoseForm(name?: string): string | undefined {
    if (!name) return undefined;

    const forms = [
      'Oral Tablet', 'Oral Capsule', 'Oral Solution',
      'Injectable Solution', 'Injection', 'Prefilled Syringe',
      'Topical Cream', 'Topical Ointment', 'Transdermal Patch',
      'Inhaler', 'Nasal Spray', 'Eye Drops', 'Ear Drops'
    ];

    for (const form of forms) {
      if (name.toLowerCase().includes(form.toLowerCase())) {
        return form;
      }
    }

    return undefined;
  }

  /**
   * Check cache for result
   */
  private checkCache(key: string): RxNormSearchResult | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.result, cached: true };
    }
    return null;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, result: RxNormSearchResult): void {
    cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Clear cache (for testing or maintenance)
   */
  clearCache(): void {
    cache.clear();
    logger.info('RxNormLookup', 'Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: cache.size,
      entries: Array.from(cache.keys())
    };
  }
}

// Export singleton instance
export const rxnormLookupService = new RxNormLookupService();

export default rxnormLookupService;
