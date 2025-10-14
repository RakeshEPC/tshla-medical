-- =====================================================
-- Analytics Schema for TSHLA Medical Application
-- =====================================================
-- This schema supports comprehensive analytics tracking for:
-- - Template performance and usage
-- - Prompt version A/B testing
-- - Note quality ratings and feedback
-- - Model performance comparisons
-- - Token usage and cost tracking
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Template Analytics Table
-- =====================================================
CREATE TABLE IF NOT EXISTS template_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES medical_staff(id) ON DELETE SET NULL,

  -- Usage Metrics
  total_uses INTEGER DEFAULT 0,
  successful_uses INTEGER DEFAULT 0,
  failed_uses INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0, -- Percentage

  -- Quality Metrics
  average_quality_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 stars
  total_ratings INTEGER DEFAULT 0,
  thumbs_up_count INTEGER DEFAULT 0,
  thumbs_down_count INTEGER DEFAULT 0,

  -- Performance Metrics
  avg_processing_time_ms INTEGER DEFAULT 0,
  avg_token_usage INTEGER DEFAULT 0,
  avg_token_cost DECIMAL(10,6) DEFAULT 0,

  -- Complexity Metrics
  complexity_score INTEGER DEFAULT 0, -- 0-100
  complexity_level VARCHAR(20), -- simple, moderate, complex, very_complex
  recommended_model VARCHAR(50),

  -- Time Aggregation
  period_type VARCHAR(10) NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT template_analytics_period_check CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  CONSTRAINT template_analytics_unique_period UNIQUE (template_id, period_type, period_start)
);

-- Indexes for template analytics
CREATE INDEX idx_template_analytics_template ON template_analytics(template_id);
CREATE INDEX idx_template_analytics_staff ON template_analytics(staff_id);
CREATE INDEX idx_template_analytics_period ON template_analytics(period_type, period_start);
CREATE INDEX idx_template_analytics_quality ON template_analytics(average_quality_rating DESC);

-- =====================================================
-- 2. Prompt Versions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(20) NOT NULL, -- e.g., "1.0.0", "1.1.0"
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Version Details
  prompt_type VARCHAR(50) NOT NULL, -- 'system', 'custom-template', 'standard-template', 'conversational'
  prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Array of variable names

  -- Status and Lineage
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'testing', 'deprecated', 'archived'
  parent_version_id UUID REFERENCES prompt_versions(id),
  changes TEXT, -- Description of changes from parent

  -- Metadata
  target_models JSONB DEFAULT '[]'::jsonb, -- Array of model names
  estimated_tokens INTEGER DEFAULT 0,
  complexity VARCHAR(20), -- 'simple', 'moderate', 'complex'
  tags JSONB DEFAULT '[]'::jsonb,

  -- Performance Metrics
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  avg_quality_score DECIMAL(3,2) DEFAULT 0,
  avg_processing_time_ms INTEGER DEFAULT 0,
  avg_token_usage INTEGER DEFAULT 0,

  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_traffic_percentage INTEGER DEFAULT 0,
  ab_test_control_version_id UUID REFERENCES prompt_versions(id),
  ab_test_group CHAR(1), -- 'A', 'B', 'C'

  -- Audit
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT prompt_versions_status_check CHECK (status IN ('draft', 'active', 'testing', 'deprecated', 'archived')),
  CONSTRAINT prompt_versions_type_check CHECK (prompt_type IN ('system', 'custom-template', 'standard-template', 'conversational')),
  CONSTRAINT prompt_versions_traffic_check CHECK (ab_test_traffic_percentage BETWEEN 0 AND 100)
);

-- Indexes for prompt versions
CREATE INDEX idx_prompt_versions_type_status ON prompt_versions(prompt_type, status);
CREATE INDEX idx_prompt_versions_parent ON prompt_versions(parent_version_id);
CREATE INDEX idx_prompt_versions_performance ON prompt_versions(avg_quality_score DESC, usage_count DESC);

-- =====================================================
-- 3. Note Quality Ratings Table
-- =====================================================
CREATE TABLE IF NOT EXISTS note_quality_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id VARCHAR(255) NOT NULL, -- Reference to note in application

  -- User Context
  staff_id UUID REFERENCES medical_staff(id) ON DELETE SET NULL,
  patient_id VARCHAR(255), -- May not be in database

  -- Rating Data
  star_rating INTEGER NOT NULL, -- 1-5
  thumbs_up_down VARCHAR(10), -- 'up', 'down', or NULL
  issues JSONB DEFAULT '[]'::jsonb, -- Array of issue categories
  feedback_text TEXT,

  -- Context
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  prompt_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL,
  model_used VARCHAR(100),

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT note_quality_ratings_star_check CHECK (star_rating BETWEEN 1 AND 5),
  CONSTRAINT note_quality_ratings_thumbs_check CHECK (thumbs_up_down IN ('up', 'down') OR thumbs_up_down IS NULL)
);

-- Indexes for note quality ratings
CREATE INDEX idx_note_quality_ratings_note ON note_quality_ratings(note_id);
CREATE INDEX idx_note_quality_ratings_staff ON note_quality_ratings(staff_id);
CREATE INDEX idx_note_quality_ratings_template ON note_quality_ratings(template_id);
CREATE INDEX idx_note_quality_ratings_prompt_version ON note_quality_ratings(prompt_version_id);
CREATE INDEX idx_note_quality_ratings_timestamp ON note_quality_ratings(timestamp DESC);
CREATE INDEX idx_note_quality_ratings_rating ON note_quality_ratings(star_rating);

-- =====================================================
-- 4. Model Performance Table
-- =====================================================
CREATE TABLE IF NOT EXISTS model_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name VARCHAR(100) NOT NULL,

  -- Usage Metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,

  -- Performance Metrics
  avg_processing_time_ms INTEGER DEFAULT 0,
  min_processing_time_ms INTEGER,
  max_processing_time_ms INTEGER,
  p95_processing_time_ms INTEGER, -- 95th percentile

  -- Token Metrics
  total_tokens_used BIGINT DEFAULT 0,
  avg_tokens_per_request INTEGER DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,

  -- Cost Metrics
  total_cost DECIMAL(10,6) DEFAULT 0,
  avg_cost_per_request DECIMAL(10,6) DEFAULT 0,

  -- Quality Metrics
  avg_quality_rating DECIMAL(3,2) DEFAULT 0,
  total_quality_ratings INTEGER DEFAULT 0,

  -- Time Aggregation
  period_type VARCHAR(10) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT model_performance_period_check CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
  CONSTRAINT model_performance_unique_period UNIQUE (model_name, period_type, period_start)
);

-- Indexes for model performance
CREATE INDEX idx_model_performance_model ON model_performance(model_name);
CREATE INDEX idx_model_performance_period ON model_performance(period_type, period_start);
CREATE INDEX idx_model_performance_success_rate ON model_performance(success_rate DESC);

-- =====================================================
-- 5. Token Usage Tracking Table
-- =====================================================
CREATE TABLE IF NOT EXISTS token_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Request Context
  note_id VARCHAR(255),
  staff_id UUID REFERENCES medical_staff(id) ON DELETE SET NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  prompt_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL,

  -- Model Information
  model_name VARCHAR(100) NOT NULL,

  -- Token Counts
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,

  -- Token Estimates
  estimated_tokens INTEGER,
  token_estimate_accuracy DECIMAL(5,2), -- Percentage
  truncation_applied BOOLEAN DEFAULT false,
  tokens_truncated INTEGER DEFAULT 0,

  -- Cost Calculation
  input_cost DECIMAL(10,6),
  output_cost DECIMAL(10,6),
  total_cost DECIMAL(10,6),

  -- Performance
  processing_time_ms INTEGER,

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT token_usage_log_totals_check CHECK (total_tokens = input_tokens + output_tokens)
);

-- Indexes for token usage log
CREATE INDEX idx_token_usage_log_staff ON token_usage_log(staff_id);
CREATE INDEX idx_token_usage_log_template ON token_usage_log(template_id);
CREATE INDEX idx_token_usage_log_model ON token_usage_log(model_name);
CREATE INDEX idx_token_usage_log_timestamp ON token_usage_log(timestamp DESC);
CREATE INDEX idx_token_usage_log_cost ON token_usage_log(total_cost DESC);

-- =====================================================
-- 6. Prompt Usage Log Table
-- =====================================================
CREATE TABLE IF NOT EXISTS prompt_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,

  -- Request Context
  note_id VARCHAR(255),
  staff_id UUID REFERENCES medical_staff(id) ON DELETE SET NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,

  -- Execution Details
  success BOOLEAN NOT NULL,
  error_message TEXT,
  quality_score DECIMAL(3,2), -- 0-1 normalized score

  -- Performance
  processing_time_ms INTEGER NOT NULL,
  token_usage INTEGER NOT NULL,

  -- Model Used
  model_used VARCHAR(100),

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- A/B Test Context
  ab_test_group CHAR(1) -- Which test group this request belonged to
);

-- Indexes for prompt usage log
CREATE INDEX idx_prompt_usage_log_version ON prompt_usage_log(prompt_version_id);
CREATE INDEX idx_prompt_usage_log_staff ON prompt_usage_log(staff_id);
CREATE INDEX idx_prompt_usage_log_timestamp ON prompt_usage_log(timestamp DESC);
CREATE INDEX idx_prompt_usage_log_success ON prompt_usage_log(success);

-- =====================================================
-- 7. Create Update Timestamp Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at columns
CREATE TRIGGER update_template_analytics_updated_at
  BEFORE UPDATE ON template_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_versions_updated_at
  BEFORE UPDATE ON prompt_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_performance_updated_at
  BEFORE UPDATE ON model_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. Create Aggregate Views for Reporting
-- =====================================================

-- Template Performance Summary View
CREATE OR REPLACE VIEW template_performance_summary AS
SELECT
  t.id AS template_id,
  t.name AS template_name,
  t.template_type,
  ta.total_uses,
  ta.success_rate,
  ta.average_quality_rating,
  ta.avg_processing_time_ms,
  ta.avg_token_cost,
  ta.complexity_level,
  ta.recommended_model,
  ta.updated_at AS last_updated
FROM templates t
LEFT JOIN template_analytics ta ON t.id = ta.template_id AND ta.period_type = 'all_time'
ORDER BY ta.average_quality_rating DESC NULLS LAST;

-- Model Comparison View
CREATE OR REPLACE VIEW model_comparison AS
SELECT
  model_name,
  SUM(total_requests) AS total_requests,
  AVG(success_rate) AS avg_success_rate,
  AVG(avg_processing_time_ms) AS avg_processing_time,
  SUM(total_tokens_used) AS total_tokens,
  SUM(total_cost) AS total_cost,
  AVG(avg_quality_rating) AS avg_quality
FROM model_performance
WHERE period_type = 'daily'
  AND period_start >= NOW() - INTERVAL '30 days'
GROUP BY model_name
ORDER BY avg_quality DESC;

-- Daily Quality Trend View
CREATE OR REPLACE VIEW daily_quality_trend AS
SELECT
  DATE(timestamp) AS date,
  COUNT(*) AS rating_count,
  AVG(star_rating) AS avg_rating,
  SUM(CASE WHEN thumbs_up_down = 'up' THEN 1 ELSE 0 END) AS thumbs_up,
  SUM(CASE WHEN thumbs_up_down = 'down' THEN 1 ELSE 0 END) AS thumbs_down
FROM note_quality_ratings
WHERE timestamp >= NOW() - INTERVAL '90 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- =====================================================
-- 9. Create Helper Functions
-- =====================================================

-- Function to aggregate template analytics
CREATE OR REPLACE FUNCTION aggregate_template_analytics(
  p_template_id UUID,
  p_period_type VARCHAR,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS VOID AS $$
DECLARE
  v_total_uses INTEGER;
  v_avg_quality DECIMAL;
  v_avg_processing_time INTEGER;
BEGIN
  -- This would be called by a scheduled job to aggregate data
  -- Implementation depends on how notes and processing logs are stored
  -- Placeholder for future implementation
  RAISE NOTICE 'Template analytics aggregation function called for template %', p_template_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. Grant Permissions (adjust as needed)
-- =====================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- =====================================================
-- End of Analytics Schema
-- =====================================================
