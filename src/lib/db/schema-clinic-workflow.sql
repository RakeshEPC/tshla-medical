-- TSHLA Medical Clinic Workflow Schema Extensions
-- Adds support for dual ID system (AVA/TSH), action items, and audit logging

-- Modify patients table to support dual ID system
ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS tsh_id VARCHAR(20) UNIQUE;
ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS clinic_id VARCHAR(50);
ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS created_by_staff VARCHAR(100);

-- Create charts table for patient charts
CREATE TABLE IF NOT EXISTS charts (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(36) REFERENCES patients(id) ON DELETE CASCADE,
  ava_id VARCHAR(20) NOT NULL UNIQUE,
  tsh_id VARCHAR(20) NOT NULL UNIQUE,
  clinic_id VARCHAR(50),
  old_notes TEXT,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ava_id UNIQUE (ava_id),
  CONSTRAINT unique_tsh_id UNIQUE (tsh_id)
);

-- Create notes table with action items support
CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(36) REFERENCES patients(id) ON DELETE CASCADE,
  chart_id VARCHAR(36) REFERENCES charts(id) ON DELETE CASCADE,
  author_id VARCHAR(100) NOT NULL,
  author_name VARCHAR(200),
  author_role VARCHAR(50),
  body TEXT NOT NULL,
  old_notes TEXT,
  action_items JSONB,
  is_signed BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(36) REFERENCES patients(id) ON DELETE CASCADE,
  chart_id VARCHAR(36) REFERENCES charts(id),
  provider_id VARCHAR(100),
  provider_name VARCHAR(200),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit logs table for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id VARCHAR(100),
  actor_name VARCHAR(200),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  entity_details JSONB,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create action items table for extracted meds/labs
CREATE TABLE IF NOT EXISTS action_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id VARCHAR(36) REFERENCES notes(id) ON DELETE CASCADE,
  patient_id VARCHAR(36) REFERENCES patients(id) ON DELETE CASCADE,
  chart_id VARCHAR(36) REFERENCES charts(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'medication' or 'lab'
  action VARCHAR(50) NOT NULL, -- 'start', 'stop', 'refill', 'order', etc.
  details JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  processed_by VARCHAR(100),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_charts_patient_id ON charts(patient_id);
CREATE INDEX IF NOT EXISTS idx_charts_ava_id ON charts(ava_id);
CREATE INDEX IF NOT EXISTS idx_charts_tsh_id ON charts(tsh_id);
CREATE INDEX IF NOT EXISTS idx_notes_patient_id ON notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_notes_chart_id ON notes(chart_id);
CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_action_items_patient_id ON action_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_charts_updated_at BEFORE UPDATE ON charts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();