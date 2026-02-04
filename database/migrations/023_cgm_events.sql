-- Migration 023: CGM Events table
-- Run this in the Supabase SQL Editor
-- Stores patient-logged events: meals, insulin, exercise, notes

CREATE TABLE IF NOT EXISTS cgm_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_phone VARCHAR(50) NOT NULL,
  unified_patient_id UUID,
  event_type VARCHAR(30) NOT NULL,  -- 'meal', 'insulin', 'exercise', 'note', 'sleep'
  event_timestamp TIMESTAMPTZ NOT NULL,
  -- Meal fields
  carbs_grams INT,
  meal_label VARCHAR(100),
  -- Insulin fields
  insulin_units DECIMAL(5,1),
  insulin_type VARCHAR(50),
  -- Exercise fields
  exercise_minutes INT,
  exercise_type VARCHAR(50),
  exercise_intensity VARCHAR(20),
  -- General
  notes TEXT,
  recorded_by VARCHAR(20) DEFAULT 'patient',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cgm_events_phone ON cgm_events(patient_phone);
CREATE INDEX IF NOT EXISTS idx_cgm_events_timestamp ON cgm_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cgm_events_patient_id ON cgm_events(unified_patient_id);
