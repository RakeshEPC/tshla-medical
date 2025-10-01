-- Appointments table for multi-doctor scheduling
-- Production-ready schema with HIPAA compliance

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  -- Core appointment data
  doctor_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_mrn TEXT NOT NULL,
  patient_phone TEXT,
  patient_email TEXT,
  patient_dob DATE,
  
  -- Scheduling
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL, -- Format: "HH:MM AM/PM"
  appointment_slot TEXT NOT NULL, -- Format: "YYYY-MM-DD HH:MM" for sorting
  duration_minutes INTEGER DEFAULT 30,
  
  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')),
  
  -- Visit details
  visit_type TEXT DEFAULT 'follow-up' CHECK(visit_type IN ('new-patient', 'follow-up', 'urgent', 'telehealth', 'procedure')),
  chief_complaint TEXT,
  notes TEXT,
  
  -- Multi-practice support
  practice_id TEXT,
  location TEXT,
  room_number TEXT,
  
  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL, -- doctor_id who created
  updated_by TEXT,
  
  -- Soft delete for audit trail
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,
  deleted_by TEXT,
  
  -- Constraints
  UNIQUE(doctor_id, appointment_slot), -- Prevent double-booking
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments(appointment_slot);

-- View for today's appointments
CREATE VIEW IF NOT EXISTS today_appointments AS
SELECT 
  a.*,
  d.first_name || ' ' || d.last_name as doctor_name,
  d.specialty as doctor_specialty
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
WHERE a.appointment_date = DATE('now', 'localtime')
  AND a.is_deleted = 0
ORDER BY a.appointment_slot;

-- View for upcoming appointments
CREATE VIEW IF NOT EXISTS upcoming_appointments AS
SELECT 
  a.*,
  d.first_name || ' ' || d.last_name as doctor_name
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
WHERE a.appointment_date >= DATE('now', 'localtime')
  AND a.is_deleted = 0
ORDER BY a.appointment_slot;

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_appointments_timestamp 
AFTER UPDATE ON appointments
BEGIN
  UPDATE appointments 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;