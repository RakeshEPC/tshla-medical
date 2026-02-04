-- ============================================
-- Migration 026: Nutrition Note Reviews
-- AI-assisted nutrition note processing with
-- dietician feedback loop for RAG learning
-- Created: 2026-02-04
-- ============================================

-- Table: nutrition_note_reviews
-- Stores nutrition notes, AI-generated summaries/recommendations,
-- and dietician feedback for RAG-based AI improvement
CREATE TABLE IF NOT EXISTS nutrition_note_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Original note pasted by nutritionist
  original_note TEXT NOT NULL,

  -- AI-generated output
  ai_summary TEXT,
  ai_recommendations TEXT,
  ai_model VARCHAR(100) DEFAULT 'gpt-4o',
  ai_tokens_used INTEGER,

  -- Dietician review
  status VARCHAR(20) DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'revised')),
  dietician_agrees BOOLEAN,
  dietician_feedback TEXT,            -- Why they disagreed
  dietician_revised_summary TEXT,     -- Their corrected summary (if any)
  dietician_revised_recommendations TEXT, -- Their corrected recommendations (if any)
  dietician_name VARCHAR(255),        -- Who reviewed it
  reviewed_at TIMESTAMPTZ,

  -- RAG context: how many past examples were used
  rag_examples_used INTEGER DEFAULT 0,

  -- Metadata
  note_type VARCHAR(50) DEFAULT 'general',  -- 'diabetes', 'general', 'weight_management', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for RAG retrieval: find approved reviews for context
CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_approved
  ON nutrition_note_reviews (status, created_at DESC)
  WHERE status IN ('approved', 'revised');

-- Index for searching by note type
CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_note_type
  ON nutrition_note_reviews (note_type, status);

-- Full-text search on original notes for finding similar past notes
CREATE INDEX IF NOT EXISTS idx_nutrition_reviews_note_text
  ON nutrition_note_reviews USING gin(to_tsvector('english', original_note));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_nutrition_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nutrition_review_updated_at ON nutrition_note_reviews;
CREATE TRIGGER trigger_nutrition_review_updated_at
  BEFORE UPDATE ON nutrition_note_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_nutrition_review_updated_at();

-- RLS: Allow public access (no login required for this feature)
ALTER TABLE nutrition_note_reviews ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts and selects (open access as requested)
CREATE POLICY "nutrition_reviews_public_insert" ON nutrition_note_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "nutrition_reviews_public_select" ON nutrition_note_reviews
  FOR SELECT USING (true);

CREATE POLICY "nutrition_reviews_public_update" ON nutrition_note_reviews
  FOR UPDATE USING (true) WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE nutrition_note_reviews IS
  'Stores nutrition notes processed by AI with dietician feedback. Used for RAG-based learning to improve future AI recommendations.';
