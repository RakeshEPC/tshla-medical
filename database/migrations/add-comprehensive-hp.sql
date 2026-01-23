-- =====================================================
-- Comprehensive Patient H&P (History & Physical)
-- =====================================================
-- Created: 2026-01-23
-- Purpose: Store structured patient medical chart that grows
--          with each visit, used as context for AI chat educator
-- =====================================================

-- =====================================================
-- 1. COMPREHENSIVE PATIENT CHART (Main Table)
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_comprehensive_chart (
  patient_phone VARCHAR(20) PRIMARY KEY,
  tshla_id VARCHAR(11) NOT NULL,

  -- ========================================
  -- DEMOGRAPHICS
  -- ========================================
  demographics JSONB DEFAULT '{}',
  -- {
  --   "name": "John Smith",
  --   "dob": "1975-03-15",
  --   "mrn": "MRN-1234567",
  --   "phone": "5551234567",
  --   "address": "123 Main St",
  --   "insurance": "Blue Cross PPO"
  -- }

  -- ========================================
  -- CLINICAL DATA (Structured)
  -- ========================================

  -- Medications
  medications JSONB DEFAULT '[]',
  -- [
  --   {
  --     "name": "Metformin",
  --     "dose": "1000mg",
  --     "frequency": "BID",
  --     "route": "PO",
  --     "start_date": "2024-01-01",
  --     "end_date": null,
  --     "active": true,
  --     "indication": "Type 2 Diabetes",
  --     "notes": "Take with meals"
  --   }
  -- ]

  -- Diagnoses
  diagnoses JSONB DEFAULT '[]',
  -- [
  --   {
  --     "diagnosis": "Type 2 Diabetes Mellitus",
  --     "icd10": "E11.9",
  --     "date_diagnosed": "2023-06-15",
  --     "status": "active",
  --     "notes": "A1C improving with treatment"
  --   }
  -- ]

  -- Allergies
  allergies JSONB DEFAULT '[]',
  -- [
  --   {
  --     "allergen": "Penicillin",
  --     "reaction": "Hives",
  --     "severity": "moderate",
  --     "date_added": "2023-06-15",
  --     "added_by": "patient-manual"
  --   }
  -- ]

  -- Family History
  family_history JSONB DEFAULT '[]',
  -- [
  --   {
  --     "condition": "Type 2 Diabetes",
  --     "relationship": "Father",
  --     "age_onset": 55,
  --     "notes": "Managed with diet and Metformin"
  --   }
  -- ]

  -- Social History
  social_history JSONB DEFAULT '{}',
  -- {
  --   "smoking": {"status": "never", "notes": ""},
  --   "alcohol": {"status": "occasional", "drinks_per_week": 2},
  --   "occupation": "Software Engineer",
  --   "living_situation": "Lives with spouse",
  --   "exercise": {"frequency": "3x/week", "type": "Walking"}
  -- }

  -- ========================================
  -- LABS (Special structure for trends)
  -- ========================================
  labs JSONB DEFAULT '{}',
  -- {
  --   "A1C": [
  --     {"value": 7.2, "date": "2024-03-14", "unit": "%"},
  --     {"value": 7.5, "date": "2024-01-10", "unit": "%"},
  --     {"value": 7.8, "date": "2023-11-05", "unit": "%"}
  --   ],
  --   "LDL": [
  --     {"value": 95, "date": "2024-03-14", "unit": "mg/dL"},
  --     {"value": 102, "date": "2024-01-10", "unit": "mg/dL"}
  --   ],
  --   "Urine Microalbumin/Creatinine Ratio": [
  --     {"value": 18, "date": "2024-03-14", "unit": "mg/g"}
  --   ],
  --   "Serum Creatinine": [
  --     {"value": 1.1, "date": "2024-03-14", "unit": "mg/dL"}
  --   ],
  --   "TSH": [
  --     {"value": 2.4, "date": "2024-03-14", "unit": "mIU/L"}
  --   ],
  --   "Free T4": [
  --     {"value": 1.2, "date": "2024-03-14", "unit": "ng/dL"}
  --   ]
  -- }

  -- ========================================
  -- VITALS (For trending)
  -- ========================================
  vitals JSONB DEFAULT '{}',
  -- {
  --   "Blood Pressure": [
  --     {"systolic": 128, "diastolic": 82, "date": "2024-03-14"},
  --     {"systolic": 130, "diastolic": 85, "date": "2024-01-10"}
  --   ],
  --   "Weight": [
  --     {"value": 178, "date": "2024-03-14", "unit": "lbs"},
  --     {"value": 180, "date": "2024-01-10", "unit": "lbs"}
  --   ]
  -- }

  -- ========================================
  -- CURRENTLY WORKING ON (Patient Goals)
  -- ========================================
  current_goals JSONB DEFAULT '[]',
  -- [
  --   {
  --     "category": "Diet",
  --     "goal": "Reduce carbs to 150g/day",
  --     "status": "in_progress",
  --     "started": "2024-03-01",
  --     "target_date": null,
  --     "notes": ""
  --   },
  --   {
  --     "category": "Exercise",
  --     "goal": "Walk 30 minutes daily",
  --     "status": "in_progress",
  --     "started": "2024-03-10",
  --     "streak_days": 3
  --   }
  -- ]

  -- ========================================
  -- EXTERNAL DOCUMENTS
  -- ========================================
  external_documents JSONB DEFAULT '[]',
  -- [
  --   {
  --     "file_url": "https://blob.../cardiology-report.pdf",
  --     "provider_name": "Dr. Johnson - Cardiology",
  --     "specialty": "Cardiology",
  --     "upload_date": "2024-03-15",
  --     "extracted_data": {
  --       "diagnoses": ["Atrial fibrillation"],
  --       "medications": ["Eliquis 5mg BID"],
  --       "recommendations": ["Follow up in 6 months"]
  --     }
  --   }
  -- ]

  -- ========================================
  -- GENERATED NARRATIVE H&P (For AI context)
  -- ========================================
  full_hp_narrative TEXT,
  -- "Patient is a 49-year-old male with Type 2 Diabetes Mellitus,
  -- diagnosed in June 2023. Current A1C is 7.2%, improved from 7.8%
  -- at diagnosis. Managed with Metformin 1000mg BID and lifestyle
  -- modifications. Blood pressure well-controlled at 128/82. Weight
  -- has decreased from 185 to 178 lbs. Currently working on reducing
  -- carbohydrate intake and increasing exercise. Family history
  -- significant for diabetes in father. No known drug allergies..."

  -- ========================================
  -- METADATA
  -- ========================================
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  last_ai_generated TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  patient_editable_sections TEXT[] DEFAULT ARRAY['allergies', 'family_history', 'social_history', 'current_goals'],
  pending_staff_review BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. AUDIT TRAIL (Track all changes)
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_chart_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone VARCHAR(20) NOT NULL,
  section_name VARCHAR(50),  -- 'medications', 'diagnoses', 'labs', 'vitals', 'allergies', etc.
  change_type VARCHAR(20),   -- 'add', 'update', 'delete'
  old_value JSONB,
  new_value JSONB,
  changed_by VARCHAR(50),    -- 'ai-auto', 'patient-manual', 'staff-edit', 'external-upload'
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  staff_reviewed BOOLEAN DEFAULT FALSE,
  staff_reviewer_id UUID,
  review_notes TEXT
);

-- =====================================================
-- 3. VISIT DICTATIONS ARCHIVE
-- =====================================================
-- Store dictations but don't use in AI prompts (use H&P only)

CREATE TABLE IF NOT EXISTS visit_dictations_archive (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20),
  visit_date DATE,
  dictation_text TEXT,
  dictation_id INTEGER,  -- Link to original dictated_notes table
  extracted_to_hp BOOLEAN DEFAULT FALSE,
  extraction_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_patient_chart_phone
  ON patient_comprehensive_chart(patient_phone);

CREATE INDEX IF NOT EXISTS idx_patient_chart_tshla_id
  ON patient_comprehensive_chart(tshla_id);

CREATE INDEX IF NOT EXISTS idx_chart_history_patient
  ON patient_chart_history(patient_phone, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_chart_history_section
  ON patient_chart_history(section_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_chart_history_review
  ON patient_chart_history(staff_reviewed, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dictations_archive_patient
  ON visit_dictations_archive(patient_phone, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_dictations_archive_extracted
  ON visit_dictations_archive(extracted_to_hp, created_at DESC);

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE patient_comprehensive_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_chart_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_dictations_archive ENABLE ROW LEVEL SECURITY;

-- Policies (placeholder - adjust based on your auth setup)
-- Patients can only see their own data
-- Staff can see all data

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_patient_chart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_patient_chart_timestamp ON patient_comprehensive_chart;
CREATE TRIGGER trigger_update_patient_chart_timestamp
  BEFORE UPDATE ON patient_comprehensive_chart
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_chart_timestamp();

-- =====================================================
-- NOTES
-- =====================================================
-- This schema supports:
-- 1. Structured data storage (easy querying, AI-friendly)
-- 2. Complete audit trail (HIPAA compliance)
-- 3. Patient editing with staff review
-- 4. Document uploads with extracted data
-- 5. Lab trending and graphing
-- 6. AI chat context (full H&P narrative)
-- 7. Goal tracking ("Currently Working On")
-- =====================================================
