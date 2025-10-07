-- =====================================================
-- TSHLA Medical - Pump Comparison Data Migration to Supabase
-- =====================================================
-- Converts MySQL pump comparison tables to PostgreSQL/Supabase
-- Includes 23-dimension pump data and manufacturer information
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PUMP COMPARISON DATA (23 Dimensions)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pump_comparison_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dimension_number INTEGER NOT NULL UNIQUE,
  dimension_name VARCHAR(255) NOT NULL,
  dimension_description TEXT,
  importance_scale VARCHAR(50) DEFAULT '1-10',
  pump_details JSONB NOT NULL,          -- Stores all 6 pumps details for this dimension
  category VARCHAR(100),                -- e.g., Power, Controls, Design, Automation
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pump_comparison_category ON public.pump_comparison_data(category);
CREATE INDEX IF NOT EXISTS idx_pump_comparison_display_order ON public.pump_comparison_data(display_order);
CREATE INDEX IF NOT EXISTS idx_pump_comparison_active ON public.pump_comparison_data(is_active);

-- RLS Policies
ALTER TABLE public.pump_comparison_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pump comparison data" ON public.pump_comparison_data
  FOR SELECT
  USING (TRUE);  -- Public data, anyone can view

CREATE POLICY "Admins can insert pump comparison data" ON public.pump_comparison_data
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

CREATE POLICY "Admins can update pump comparison data" ON public.pump_comparison_data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

CREATE POLICY "Admins can delete pump comparison data" ON public.pump_comparison_data
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 2. PUMP MANUFACTURERS & REPRESENTATIVE CONTACTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pump_manufacturers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pump_name VARCHAR(255) NOT NULL UNIQUE,
  manufacturer VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  rep_name VARCHAR(255),                -- Sales representative name
  rep_contact VARCHAR(255),             -- Phone number or contact method
  rep_email VARCHAR(255),
  support_phone VARCHAR(50),            -- General customer support phone
  support_email VARCHAR(255),
  notes TEXT,                           -- Additional notes about pump or manufacturer
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pump_manufacturers_pump_name ON public.pump_manufacturers(pump_name);
CREATE INDEX IF NOT EXISTS idx_pump_manufacturers_manufacturer ON public.pump_manufacturers(manufacturer);
CREATE INDEX IF NOT EXISTS idx_pump_manufacturers_active ON public.pump_manufacturers(is_active);

-- RLS Policies
ALTER TABLE public.pump_manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pump manufacturers" ON public.pump_manufacturers
  FOR SELECT
  USING (TRUE);  -- Public data, anyone can view

CREATE POLICY "Admins can manage pump manufacturers" ON public.pump_manufacturers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

-- =====================================================
-- 3. PUMP COMPARISON CHANGE LOG (Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pump_comparison_changelog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,     -- pump_comparison_data or pump_manufacturers
  record_id UUID NOT NULL,              -- ID of the changed record
  change_type VARCHAR(20) NOT NULL,     -- INSERT, UPDATE, DELETE
  changed_by UUID REFERENCES auth.users(id),
  old_value JSONB,                      -- Previous value (for UPDATE/DELETE)
  new_value JSONB,                      -- New value (for INSERT/UPDATE)
  change_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pump_changelog_table_record ON public.pump_comparison_changelog(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_pump_changelog_type ON public.pump_comparison_changelog(change_type);
CREATE INDEX IF NOT EXISTS idx_pump_changelog_created ON public.pump_comparison_changelog(created_at);

-- RLS Policies
ALTER TABLE public.pump_comparison_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view changelog" ON public.pump_comparison_changelog
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_staff
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =====================================================
CREATE TRIGGER update_pump_comparison_data_updated_at
  BEFORE UPDATE ON public.pump_comparison_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pump_manufacturers_updated_at
  BEFORE UPDATE ON public.pump_manufacturers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA: Pump Manufacturers
-- =====================================================
INSERT INTO public.pump_manufacturers (pump_name, manufacturer, website, rep_name, support_phone, notes)
VALUES
  ('Medtronic 780G', 'Medtronic', 'https://www.medtronicdiabetes.com', 'Bobby/Laura', '1-800-646-4633', 'MiniMed 780G with SmartGuard technology'),
  ('Tandem t:slim X2', 'Tandem Diabetes Care', 'https://www.tandemdiabetes.com', 'Meghan', '1-877-801-6901', 't:slim X2 with Control-IQ technology'),
  ('Tandem Mobi', 'Tandem Diabetes Care', 'https://www.tandemdiabetes.com/products/tandem-mobi', 'Meghan', '1-877-801-6901', 'Smallest tubed pump with Control-IQ'),
  ('Omnipod 5', 'Insulet Corporation', 'https://www.omnipod.com', 'Celeste', '1-800-591-3455', 'Tubeless pod system with automated insulin delivery'),
  ('Beta Bionics iLet', 'Beta Bionics', 'https://www.betabionics.com', 'Katherine', '1-844-443-8123', 'Bionic pancreas with no carb counting'),
  ('Twiist', 'Sequel Med Tech', 'https://www.sequelmedtech.com', 'Brittney B', NULL, 'New automated insulin delivery system with Apple Watch integration')
ON CONFLICT (pump_name) DO UPDATE SET
  manufacturer = EXCLUDED.manufacturer,
  website = EXCLUDED.website,
  rep_name = EXCLUDED.rep_name,
  support_phone = EXCLUDED.support_phone,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Pump comparison tables created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - pump_comparison_data (23 dimensions)';
  RAISE NOTICE '  - pump_manufacturers (6 manufacturers seeded)';
  RAISE NOTICE '  - pump_comparison_changelog (audit trail)';
  RAISE NOTICE '';
  RAISE NOTICE 'All tables have Row Level Security enabled';
  RAISE NOTICE 'Admins can manage data, all users can view';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Import 23 dimensions data';
END $$;
