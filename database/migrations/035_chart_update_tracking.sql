-- Migration: 035_chart_update_tracking.sql
-- Purpose: Add completeness tracking for voice chart updates and LOINC lookup table
-- Date: 2026-02-07

-- ============================================
-- 1. Add completeness tracking to patient_comprehensive_chart
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'patient_comprehensive_chart'
  ) THEN
    -- Add medication completeness tracking
    ALTER TABLE patient_comprehensive_chart
      ADD COLUMN IF NOT EXISTS medication_completeness JSONB DEFAULT '{}';

    -- Add lab completeness tracking
    ALTER TABLE patient_comprehensive_chart
      ADD COLUMN IF NOT EXISTS lab_completeness JSONB DEFAULT '{}';

    -- Add pending completions (items needing staff attention)
    ALTER TABLE patient_comprehensive_chart
      ADD COLUMN IF NOT EXISTS pending_completions JSONB DEFAULT '[]';

    -- Track last voice update
    ALTER TABLE patient_comprehensive_chart
      ADD COLUMN IF NOT EXISTS last_voice_update TIMESTAMPTZ;

    RAISE NOTICE 'Added completeness tracking columns to patient_comprehensive_chart';
  ELSE
    RAISE NOTICE 'patient_comprehensive_chart does not exist - skipping';
  END IF;
END $$;

-- ============================================
-- 2. Create LOINC common labs lookup table
-- ============================================

CREATE TABLE IF NOT EXISTS loinc_common_labs (
  id SERIAL PRIMARY KEY,
  common_name VARCHAR(100) NOT NULL,
  loinc_code VARCHAR(20) NOT NULL,
  component VARCHAR(200),
  units VARCHAR(50),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(common_name)
);

CREATE INDEX IF NOT EXISTS idx_loinc_common_labs_code ON loinc_common_labs(loinc_code);
CREATE INDEX IF NOT EXISTS idx_loinc_common_labs_category ON loinc_common_labs(category);

-- ============================================
-- 3. Seed common lab mappings
-- ============================================

INSERT INTO loinc_common_labs (common_name, loinc_code, component, units, category) VALUES
-- Diabetes Labs
('A1C', '4548-4', 'Hemoglobin A1c/Hemoglobin.total', '%', 'diabetes'),
('Hemoglobin A1C', '4548-4', 'Hemoglobin A1c/Hemoglobin.total', '%', 'diabetes'),
('HbA1c', '4548-4', 'Hemoglobin A1c/Hemoglobin.total', '%', 'diabetes'),
('Glycated Hemoglobin', '4548-4', 'Hemoglobin A1c/Hemoglobin.total', '%', 'diabetes'),
('Fasting Glucose', '1558-6', 'Fasting glucose', 'mg/dL', 'diabetes'),
('Glucose', '2345-7', 'Glucose', 'mg/dL', 'diabetes'),
('Blood Sugar', '2345-7', 'Glucose', 'mg/dL', 'diabetes'),
('Random Glucose', '2345-7', 'Glucose', 'mg/dL', 'diabetes'),

-- Lipid Panel
('LDL', '13457-7', 'Cholesterol in LDL', 'mg/dL', 'lipids'),
('LDL Cholesterol', '13457-7', 'Cholesterol in LDL', 'mg/dL', 'lipids'),
('LDL-C', '13457-7', 'Cholesterol in LDL', 'mg/dL', 'lipids'),
('HDL', '2085-9', 'Cholesterol in HDL', 'mg/dL', 'lipids'),
('HDL Cholesterol', '2085-9', 'Cholesterol in HDL', 'mg/dL', 'lipids'),
('HDL-C', '2085-9', 'Cholesterol in HDL', 'mg/dL', 'lipids'),
('Total Cholesterol', '2093-3', 'Cholesterol', 'mg/dL', 'lipids'),
('Cholesterol', '2093-3', 'Cholesterol', 'mg/dL', 'lipids'),
('Triglycerides', '2571-8', 'Triglyceride', 'mg/dL', 'lipids'),
('TG', '2571-8', 'Triglyceride', 'mg/dL', 'lipids'),

-- Thyroid Labs
('TSH', '3016-3', 'Thyrotropin', 'mIU/L', 'thyroid'),
('Thyroid Stimulating Hormone', '3016-3', 'Thyrotropin', 'mIU/L', 'thyroid'),
('Free T4', '3024-7', 'Thyroxine (T4) free', 'ng/dL', 'thyroid'),
('FT4', '3024-7', 'Thyroxine (T4) free', 'ng/dL', 'thyroid'),
('T4 Free', '3024-7', 'Thyroxine (T4) free', 'ng/dL', 'thyroid'),
('Free T3', '3051-0', 'Triiodothyronine (T3) free', 'pg/mL', 'thyroid'),
('FT3', '3051-0', 'Triiodothyronine (T3) free', 'pg/mL', 'thyroid'),
('T3 Free', '3051-0', 'Triiodothyronine (T3) free', 'pg/mL', 'thyroid'),
('Total T4', '3026-2', 'Thyroxine (T4)', 'mcg/dL', 'thyroid'),
('Total T3', '3053-6', 'Triiodothyronine (T3)', 'ng/dL', 'thyroid'),
('Thyroglobulin', '3013-0', 'Thyroglobulin', 'ng/mL', 'thyroid'),
('Tg', '3013-0', 'Thyroglobulin', 'ng/mL', 'thyroid'),
('TPO Antibodies', '8099-4', 'Thyroid peroxidase Ab', 'IU/mL', 'thyroid'),
('Anti-TPO', '8099-4', 'Thyroid peroxidase Ab', 'IU/mL', 'thyroid'),
('Thyroglobulin Antibodies', '5380-5', 'Thyroglobulin Ab', 'IU/mL', 'thyroid'),
('Anti-Tg', '5380-5', 'Thyroglobulin Ab', 'IU/mL', 'thyroid'),

-- Kidney Function
('Creatinine', '2160-0', 'Creatinine', 'mg/dL', 'renal'),
('Serum Creatinine', '2160-0', 'Creatinine', 'mg/dL', 'renal'),
('BUN', '3094-0', 'Urea nitrogen', 'mg/dL', 'renal'),
('Blood Urea Nitrogen', '3094-0', 'Urea nitrogen', 'mg/dL', 'renal'),
('eGFR', '33914-3', 'Glomerular filtration rate/1.73 sq M', 'mL/min/1.73m2', 'renal'),
('GFR', '33914-3', 'Glomerular filtration rate/1.73 sq M', 'mL/min/1.73m2', 'renal'),
('Urine Microalbumin', '14957-5', 'Microalbumin', 'mg/L', 'renal'),
('Microalbumin', '14957-5', 'Microalbumin', 'mg/L', 'renal'),
('Urine Albumin', '14957-5', 'Microalbumin', 'mg/L', 'renal'),
('Urine Microalbumin/Creatinine Ratio', '14959-1', 'Microalbumin/Creatinine', 'mg/g', 'renal'),
('UACR', '14959-1', 'Microalbumin/Creatinine', 'mg/g', 'renal'),
('Albumin Creatinine Ratio', '14959-1', 'Microalbumin/Creatinine', 'mg/g', 'renal'),

-- Bone Health
('Vitamin D', '1989-3', '25-Hydroxyvitamin D', 'ng/mL', 'bone'),
('25-OH Vitamin D', '1989-3', '25-Hydroxyvitamin D', 'ng/mL', 'bone'),
('Vitamin D 25-Hydroxy', '1989-3', '25-Hydroxyvitamin D', 'ng/mL', 'bone'),
('Calcium', '17861-6', 'Calcium', 'mg/dL', 'bone'),
('Serum Calcium', '17861-6', 'Calcium', 'mg/dL', 'bone'),
('PTH', '2731-8', 'Parathyrin', 'pg/mL', 'bone'),
('Parathyroid Hormone', '2731-8', 'Parathyrin', 'pg/mL', 'bone'),

-- Hormones
('Testosterone', '2986-8', 'Testosterone', 'ng/dL', 'hormones'),
('Total Testosterone', '2986-8', 'Testosterone', 'ng/dL', 'hormones'),
('Free Testosterone', '2991-8', 'Testosterone.free', 'pg/mL', 'hormones'),
('Estradiol', '2243-4', 'Estradiol (E2)', 'pg/mL', 'hormones'),
('E2', '2243-4', 'Estradiol (E2)', 'pg/mL', 'hormones'),
('DHEA-S', '2191-5', 'Dehydroepiandrosterone sulfate', 'mcg/dL', 'hormones'),
('Cortisol', '2143-6', 'Cortisol', 'mcg/dL', 'hormones'),
('AM Cortisol', '2143-6', 'Cortisol', 'mcg/dL', 'hormones'),

-- CBC Components
('Hemoglobin', '718-7', 'Hemoglobin', 'g/dL', 'hematology'),
('Hgb', '718-7', 'Hemoglobin', 'g/dL', 'hematology'),
('Hematocrit', '4544-3', 'Hematocrit', '%', 'hematology'),
('Hct', '4544-3', 'Hematocrit', '%', 'hematology'),
('WBC', '6690-2', 'Leukocytes', '10*3/uL', 'hematology'),
('White Blood Cell Count', '6690-2', 'Leukocytes', '10*3/uL', 'hematology'),
('Platelet Count', '777-3', 'Platelets', '10*3/uL', 'hematology'),
('Platelets', '777-3', 'Platelets', '10*3/uL', 'hematology'),

-- Liver Function
('ALT', '1742-6', 'Alanine aminotransferase', 'U/L', 'liver'),
('SGPT', '1742-6', 'Alanine aminotransferase', 'U/L', 'liver'),
('AST', '1920-8', 'Aspartate aminotransferase', 'U/L', 'liver'),
('SGOT', '1920-8', 'Aspartate aminotransferase', 'U/L', 'liver'),
('Alkaline Phosphatase', '6768-6', 'Alkaline phosphatase', 'U/L', 'liver'),
('Alk Phos', '6768-6', 'Alkaline phosphatase', 'U/L', 'liver'),
('Bilirubin Total', '1975-2', 'Bilirubin.total', 'mg/dL', 'liver'),
('Total Bilirubin', '1975-2', 'Bilirubin.total', 'mg/dL', 'liver'),
('Albumin', '1751-7', 'Albumin', 'g/dL', 'liver'),

-- Electrolytes
('Sodium', '2951-2', 'Sodium', 'mEq/L', 'electrolytes'),
('Na', '2951-2', 'Sodium', 'mEq/L', 'electrolytes'),
('Potassium', '2823-3', 'Potassium', 'mEq/L', 'electrolytes'),
('K', '2823-3', 'Potassium', 'mEq/L', 'electrolytes'),
('Chloride', '2075-0', 'Chloride', 'mEq/L', 'electrolytes'),
('Cl', '2075-0', 'Chloride', 'mEq/L', 'electrolytes'),
('CO2', '2028-9', 'Carbon dioxide', 'mEq/L', 'electrolytes'),
('Bicarbonate', '2028-9', 'Carbon dioxide', 'mEq/L', 'electrolytes'),
('Magnesium', '19123-9', 'Magnesium', 'mg/dL', 'electrolytes'),
('Mg', '19123-9', 'Magnesium', 'mg/dL', 'electrolytes'),
('Phosphorus', '2777-1', 'Phosphate', 'mg/dL', 'electrolytes')

ON CONFLICT (common_name) DO UPDATE SET
  loinc_code = EXCLUDED.loinc_code,
  component = EXCLUDED.component,
  units = EXCLUDED.units,
  category = EXCLUDED.category;

RAISE NOTICE 'LOINC common labs table created and seeded with % entries', (SELECT COUNT(*) FROM loinc_common_labs);

-- ============================================
-- 4. Create chart update history table
-- ============================================

CREATE TABLE IF NOT EXISTS chart_update_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_patient_id UUID REFERENCES unified_patients(id) ON DELETE CASCADE,
  tshla_id VARCHAR(20),

  -- What was updated
  update_type VARCHAR(50) NOT NULL, -- 'voice', 'manual', 'import'
  raw_transcript TEXT,

  -- Extracted data
  extracted_medications JSONB DEFAULT '[]',
  extracted_labs JSONB DEFAULT '[]',
  extracted_vitals JSONB DEFAULT '[]',
  extracted_conditions JSONB DEFAULT '[]',
  extracted_allergies JSONB DEFAULT '[]',
  extracted_family_history JSONB DEFAULT '[]',
  extracted_social_history JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'applied', 'rejected'
  applied_at TIMESTAMPTZ,
  applied_by VARCHAR(100),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),
  processing_time_ms INTEGER,
  ai_model VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_chart_update_history_patient ON chart_update_history(unified_patient_id);
CREATE INDEX IF NOT EXISTS idx_chart_update_history_tshla ON chart_update_history(tshla_id);
CREATE INDEX IF NOT EXISTS idx_chart_update_history_status ON chart_update_history(status);
CREATE INDEX IF NOT EXISTS idx_chart_update_history_created ON chart_update_history(created_at DESC);

-- ============================================
-- 5. Create RxNorm cache table
-- ============================================

CREATE TABLE IF NOT EXISTS rxnorm_cache (
  id SERIAL PRIMARY KEY,
  medication_name VARCHAR(200) NOT NULL,
  rxcui VARCHAR(20),
  name_normalized VARCHAR(200),
  tty VARCHAR(20), -- Term Type (SCD, SBD, etc.)
  strength VARCHAR(100),
  dose_form VARCHAR(100),
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(medication_name)
);

CREATE INDEX IF NOT EXISTS idx_rxnorm_cache_rxcui ON rxnorm_cache(rxcui);
CREATE INDEX IF NOT EXISTS idx_rxnorm_cache_name ON rxnorm_cache(medication_name);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
