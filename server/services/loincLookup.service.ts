/**
 * LOINC Lookup Service
 *
 * Looks up LOINC codes for lab tests using the local loinc_common_labs table.
 * Falls back to fuzzy matching for common lab name variations.
 */

import { logger } from '../utils/logger';

// Types
export interface LOINCResult {
  loinc_code: string;
  component: string;
  common_name: string;
  units?: string;
  category?: string;
}

export interface LOINCSearchResult {
  found: boolean;
  result?: LOINCResult;
  suggestions?: string[];
}

// Common lab name aliases for fuzzy matching
const LAB_ALIASES: Record<string, string> = {
  // A1C variations
  'a1c': 'A1C',
  'hba1c': 'A1C',
  'hemoglobin a1c': 'A1C',
  'glycated hemoglobin': 'A1C',
  'glycosylated hemoglobin': 'A1C',
  'hgba1c': 'A1C',

  // Lipids
  'ldl': 'LDL',
  'ldl-c': 'LDL',
  'ldl cholesterol': 'LDL',
  'bad cholesterol': 'LDL',
  'hdl': 'HDL',
  'hdl-c': 'HDL',
  'hdl cholesterol': 'HDL',
  'good cholesterol': 'HDL',
  'total cholesterol': 'Total Cholesterol',
  'cholesterol': 'Total Cholesterol',
  'tg': 'Triglycerides',
  'trigs': 'Triglycerides',
  'triglyceride': 'Triglycerides',

  // Thyroid
  'tsh': 'TSH',
  'thyroid': 'TSH',
  'thyroid stimulating hormone': 'TSH',
  'ft4': 'Free T4',
  'free t4': 'Free T4',
  't4 free': 'Free T4',
  'thyroxine': 'Free T4',
  'ft3': 'Free T3',
  'free t3': 'Free T3',
  't3 free': 'Free T3',
  'triiodothyronine': 'Free T3',
  'thyroglobulin': 'Thyroglobulin',
  'tg level': 'Thyroglobulin',

  // Kidney
  'creatinine': 'Creatinine',
  'creat': 'Creatinine',
  'serum creatinine': 'Creatinine',
  'bun': 'BUN',
  'blood urea nitrogen': 'BUN',
  'urea': 'BUN',
  'gfr': 'eGFR',
  'egfr': 'eGFR',
  'glomerular filtration rate': 'eGFR',
  'microalbumin': 'Urine Microalbumin',
  'urine albumin': 'Urine Microalbumin',
  'uacr': 'Urine Microalbumin/Creatinine Ratio',
  'albumin creatinine ratio': 'Urine Microalbumin/Creatinine Ratio',

  // Glucose
  'glucose': 'Glucose',
  'blood sugar': 'Glucose',
  'blood glucose': 'Glucose',
  'fasting glucose': 'Fasting Glucose',
  'fbs': 'Fasting Glucose',
  'fasting blood sugar': 'Fasting Glucose',

  // Vitamins & Minerals
  'vitamin d': 'Vitamin D',
  'vit d': 'Vitamin D',
  '25-oh vitamin d': 'Vitamin D',
  '25 hydroxy vitamin d': 'Vitamin D',
  'calcium': 'Calcium',
  'ca': 'Calcium',
  'pth': 'PTH',
  'parathyroid hormone': 'PTH',
  'parathyroid': 'PTH',
  'magnesium': 'Magnesium',
  'mag': 'Magnesium',
  'mg': 'Magnesium',

  // Hormones
  'testosterone': 'Testosterone',
  'total testosterone': 'Testosterone',
  'test': 'Testosterone',
  'free testosterone': 'Free Testosterone',
  'estradiol': 'Estradiol',
  'e2': 'Estradiol',
  'cortisol': 'Cortisol',
  'am cortisol': 'Cortisol',
  'dhea-s': 'DHEA-S',
  'dheas': 'DHEA-S',

  // CBC
  'hemoglobin': 'Hemoglobin',
  'hgb': 'Hemoglobin',
  'hb': 'Hemoglobin',
  'hematocrit': 'Hematocrit',
  'hct': 'Hematocrit',
  'wbc': 'WBC',
  'white blood cell': 'WBC',
  'white count': 'WBC',
  'leukocytes': 'WBC',
  'platelets': 'Platelet Count',
  'platelet count': 'Platelet Count',
  'plt': 'Platelet Count',

  // Liver
  'alt': 'ALT',
  'sgpt': 'ALT',
  'alanine aminotransferase': 'ALT',
  'ast': 'AST',
  'sgot': 'AST',
  'aspartate aminotransferase': 'AST',
  'alk phos': 'Alkaline Phosphatase',
  'alkaline phosphatase': 'Alkaline Phosphatase',
  'bilirubin': 'Bilirubin Total',
  'total bilirubin': 'Bilirubin Total',
  'albumin': 'Albumin',

  // Electrolytes
  'sodium': 'Sodium',
  'na': 'Sodium',
  'potassium': 'Potassium',
  'k': 'Potassium',
  'chloride': 'Chloride',
  'cl': 'Chloride',
  'co2': 'CO2',
  'bicarbonate': 'CO2',
  'bicarb': 'CO2',
  'phosphorus': 'Phosphorus',
  'phos': 'Phosphorus'
};

// Fallback LOINC mappings if database lookup fails
const FALLBACK_LOINC: Record<string, LOINCResult> = {
  'A1C': { loinc_code: '4548-4', component: 'Hemoglobin A1c/Hemoglobin.total', common_name: 'A1C', units: '%', category: 'diabetes' },
  'LDL': { loinc_code: '13457-7', component: 'Cholesterol in LDL', common_name: 'LDL', units: 'mg/dL', category: 'lipids' },
  'HDL': { loinc_code: '2085-9', component: 'Cholesterol in HDL', common_name: 'HDL', units: 'mg/dL', category: 'lipids' },
  'TSH': { loinc_code: '3016-3', component: 'Thyrotropin', common_name: 'TSH', units: 'mIU/L', category: 'thyroid' },
  'Free T4': { loinc_code: '3024-7', component: 'Thyroxine (T4) free', common_name: 'Free T4', units: 'ng/dL', category: 'thyroid' },
  'Creatinine': { loinc_code: '2160-0', component: 'Creatinine', common_name: 'Creatinine', units: 'mg/dL', category: 'renal' },
  'Glucose': { loinc_code: '2345-7', component: 'Glucose', common_name: 'Glucose', units: 'mg/dL', category: 'diabetes' },
  'Fasting Glucose': { loinc_code: '1558-6', component: 'Fasting glucose', common_name: 'Fasting Glucose', units: 'mg/dL', category: 'diabetes' },
  'Triglycerides': { loinc_code: '2571-8', component: 'Triglyceride', common_name: 'Triglycerides', units: 'mg/dL', category: 'lipids' },
  'Total Cholesterol': { loinc_code: '2093-3', component: 'Cholesterol', common_name: 'Total Cholesterol', units: 'mg/dL', category: 'lipids' },
  'BUN': { loinc_code: '3094-0', component: 'Urea nitrogen', common_name: 'BUN', units: 'mg/dL', category: 'renal' },
  'eGFR': { loinc_code: '33914-3', component: 'Glomerular filtration rate/1.73 sq M', common_name: 'eGFR', units: 'mL/min/1.73m2', category: 'renal' },
  'Vitamin D': { loinc_code: '1989-3', component: '25-Hydroxyvitamin D', common_name: 'Vitamin D', units: 'ng/mL', category: 'bone' },
  'Calcium': { loinc_code: '17861-6', component: 'Calcium', common_name: 'Calcium', units: 'mg/dL', category: 'bone' },
  'PTH': { loinc_code: '2731-8', component: 'Parathyrin', common_name: 'PTH', units: 'pg/mL', category: 'bone' },
  'Hemoglobin': { loinc_code: '718-7', component: 'Hemoglobin', common_name: 'Hemoglobin', units: 'g/dL', category: 'hematology' },
  'WBC': { loinc_code: '6690-2', component: 'Leukocytes', common_name: 'WBC', units: '10*3/uL', category: 'hematology' },
  'ALT': { loinc_code: '1742-6', component: 'Alanine aminotransferase', common_name: 'ALT', units: 'U/L', category: 'liver' },
  'AST': { loinc_code: '1920-8', component: 'Aspartate aminotransferase', common_name: 'AST', units: 'U/L', category: 'liver' },
  'Sodium': { loinc_code: '2951-2', component: 'Sodium', common_name: 'Sodium', units: 'mEq/L', category: 'electrolytes' },
  'Potassium': { loinc_code: '2823-3', component: 'Potassium', common_name: 'Potassium', units: 'mEq/L', category: 'electrolytes' },
  'Thyroglobulin': { loinc_code: '3013-0', component: 'Thyroglobulin', common_name: 'Thyroglobulin', units: 'ng/mL', category: 'thyroid' },
  'Free T3': { loinc_code: '3051-0', component: 'Triiodothyronine (T3) free', common_name: 'Free T3', units: 'pg/mL', category: 'thyroid' },
  'Testosterone': { loinc_code: '2986-8', component: 'Testosterone', common_name: 'Testosterone', units: 'ng/dL', category: 'hormones' },
  'Urine Microalbumin': { loinc_code: '14957-5', component: 'Microalbumin', common_name: 'Urine Microalbumin', units: 'mg/L', category: 'renal' },
  'Urine Microalbumin/Creatinine Ratio': { loinc_code: '14959-1', component: 'Microalbumin/Creatinine', common_name: 'UACR', units: 'mg/g', category: 'renal' }
};

class LOINCLookupService {
  private supabase: any = null;

  /**
   * Initialize with Supabase client
   */
  initialize(supabaseClient: any): void {
    this.supabase = supabaseClient;
    logger.info('LOINCLookup', 'Service initialized with Supabase client');
  }

  /**
   * Look up a lab test by name
   */
  async lookupLabTest(testName: string): Promise<LOINCSearchResult> {
    const normalizedName = this.normalizeLabName(testName);

    // Try database lookup first
    if (this.supabase) {
      try {
        const dbResult = await this.lookupFromDatabase(normalizedName);
        if (dbResult.found) {
          return dbResult;
        }
      } catch (error: any) {
        logger.warn('LOINCLookup', 'Database lookup failed, using fallback', { error: error.message });
      }
    }

    // Fall back to in-memory lookup
    return this.lookupFromFallback(normalizedName);
  }

  /**
   * Normalize lab name to standard form
   */
  private normalizeLabName(name: string): string {
    const normalized = name.toLowerCase().trim();

    // Check aliases first
    if (LAB_ALIASES[normalized]) {
      return LAB_ALIASES[normalized];
    }

    // Try to find partial match in aliases
    for (const [alias, standardName] of Object.entries(LAB_ALIASES)) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return standardName;
      }
    }

    // Return with first letter capitalized
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  /**
   * Look up from database
   */
  private async lookupFromDatabase(testName: string): Promise<LOINCSearchResult> {
    // Try exact match first
    let { data, error } = await this.supabase
      .from('loinc_common_labs')
      .select('*')
      .ilike('common_name', testName)
      .limit(1);

    if (!error && data && data.length > 0) {
      return {
        found: true,
        result: {
          loinc_code: data[0].loinc_code,
          component: data[0].component,
          common_name: data[0].common_name,
          units: data[0].units,
          category: data[0].category
        }
      };
    }

    // Try fuzzy match
    const { data: fuzzyData } = await this.supabase
      .from('loinc_common_labs')
      .select('*')
      .ilike('common_name', `%${testName}%`)
      .limit(5);

    if (fuzzyData && fuzzyData.length > 0) {
      return {
        found: true,
        result: {
          loinc_code: fuzzyData[0].loinc_code,
          component: fuzzyData[0].component,
          common_name: fuzzyData[0].common_name,
          units: fuzzyData[0].units,
          category: fuzzyData[0].category
        },
        suggestions: fuzzyData.slice(1).map((r: any) => r.common_name)
      };
    }

    return { found: false };
  }

  /**
   * Look up from fallback in-memory data
   */
  private lookupFromFallback(testName: string): LOINCSearchResult {
    // Exact match
    if (FALLBACK_LOINC[testName]) {
      return {
        found: true,
        result: FALLBACK_LOINC[testName]
      };
    }

    // Case-insensitive match
    const lowerName = testName.toLowerCase();
    for (const [key, value] of Object.entries(FALLBACK_LOINC)) {
      if (key.toLowerCase() === lowerName) {
        return { found: true, result: value };
      }
    }

    // Partial match
    const suggestions: string[] = [];
    for (const key of Object.keys(FALLBACK_LOINC)) {
      if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
        suggestions.push(key);
      }
    }

    if (suggestions.length > 0) {
      return {
        found: true,
        result: FALLBACK_LOINC[suggestions[0]],
        suggestions: suggestions.slice(1)
      };
    }

    return { found: false };
  }

  /**
   * Get all labs for a category
   */
  async getLabsByCategory(category: string): Promise<LOINCResult[]> {
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('loinc_common_labs')
          .select('*')
          .eq('category', category);

        if (data) {
          return data.map((r: any) => ({
            loinc_code: r.loinc_code,
            component: r.component,
            common_name: r.common_name,
            units: r.units,
            category: r.category
          }));
        }
      } catch (error) {
        // Fall through to fallback
      }
    }

    // Fallback
    return Object.values(FALLBACK_LOINC).filter(lab => lab.category === category);
  }

  /**
   * Get units for a lab test
   */
  async getUnitsForLab(testName: string): Promise<string | null> {
    const result = await this.lookupLabTest(testName);
    return result.found ? result.result?.units || null : null;
  }
}

// Export singleton instance
export const loincLookupService = new LOINCLookupService();

export default loincLookupService;
