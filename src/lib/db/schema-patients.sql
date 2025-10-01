-- Patient Management Schema for Doctor Dictation System
-- Created: 2025-01-17

-- Core patient table
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,           -- pt-xxxxxx format
  ava_id TEXT UNIQUE,            -- AVA-xxx-xxx format for patient portal
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  insurance_info TEXT,
  emergency_contact TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'musk',
  is_active BOOLEAN DEFAULT 1
);

-- Patient conditions/diagnoses
CREATE TABLE IF NOT EXISTS patient_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  condition_name TEXT NOT NULL,
  icd10_code TEXT,
  diagnosis_date DATE,
  resolved_date DATE,
  status TEXT DEFAULT 'active', -- active, resolved, chronic
  severity TEXT,                -- mild, moderate, severe
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Medication history with effectiveness tracking
CREATE TABLE IF NOT EXISTS patient_medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  route TEXT DEFAULT 'oral',
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active', -- active, discontinued, hold
  discontinue_reason TEXT,       -- ineffective, side_effects, resolved, switched
  effectiveness TEXT,            -- excellent, good, partial, poor, none
  side_effects TEXT,
  prescriber TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Lab results tracking
CREATE TABLE IF NOT EXISTS patient_labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  lab_name TEXT NOT NULL,
  result_value TEXT,
  unit TEXT,
  normal_range TEXT,
  abnormal_flag TEXT,           -- H, L, HH, LL, Critical
  lab_date DATE,
  ordering_provider TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Visit records
CREATE TABLE IF NOT EXISTS patient_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  visit_date DATE NOT NULL,
  visit_type TEXT,              -- follow_up, new_patient, urgent, annual
  chief_complaint TEXT,
  provider TEXT DEFAULT 'musk',
  template_used TEXT,           -- Links to template system
  note_content TEXT,            -- Full SOAP note
  assessment TEXT,              -- Current assessment
  plan TEXT,                    -- Current plan
  medications_reviewed BOOLEAN DEFAULT 0,
  vitals TEXT,                  -- JSON: BP, HR, Weight, etc.
  follow_up_date DATE,
  follow_up_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Daily schedule slots
CREATE TABLE IF NOT EXISTS schedule_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_date DATE NOT NULL,
  slot_number INTEGER NOT NULL,  -- 1-20
  slot_time TEXT,                -- "9:00 AM"
  patient_id TEXT,
  patient_name TEXT,             -- Denormalized for quick display
  visit_type TEXT,
  status TEXT DEFAULT 'empty',   -- empty, scheduled, in_progress, completed
  temp_note TEXT,                -- Working dictation
  provider TEXT DEFAULT 'musk',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  UNIQUE(slot_date, slot_number, provider)
);

-- Disease progression tracking
CREATE TABLE IF NOT EXISTS disease_progression (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  condition_name TEXT NOT NULL,
  measurement_date DATE,
  metric_name TEXT,             -- A1C, TSH, T-Score, LDL, etc.
  metric_value TEXT,
  trend TEXT,                   -- improving, stable, worsening
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Import tracking for old EMR data
CREATE TABLE IF NOT EXISTS emr_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_system TEXT,           -- Epic, Cerner, etc.
  import_type TEXT,             -- full, medications, labs, notes
  raw_data TEXT,                -- Original data
  processed_data TEXT,          -- Parsed data
  status TEXT DEFAULT 'pending', -- pending, processed, failed
  error_message TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON patient_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_status ON patient_conditions(status);
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_status ON patient_medications(status);
CREATE INDEX IF NOT EXISTS idx_patient_labs_patient ON patient_labs(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_labs_date ON patient_labs(lab_date);
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_date ON patient_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_date ON schedule_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_provider ON schedule_slots(provider);
CREATE INDEX IF NOT EXISTS idx_disease_progression_patient ON disease_progression(patient_id);