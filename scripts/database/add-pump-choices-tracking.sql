-- Add tracking columns for pump recommendations
-- This allows us to track which pumps are being recommended (top 3 choices)
-- and when recommendations were made

USE tshla_medical;

-- Add columns to pump_reports table
ALTER TABLE pump_reports
ADD COLUMN top_choice_pump VARCHAR(100) AFTER recommendations,
ADD COLUMN second_choice_pump VARCHAR(100) AFTER top_choice_pump,
ADD COLUMN third_choice_pump VARCHAR(100) AFTER second_choice_pump,
ADD COLUMN recommendation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER third_choice_pump;

-- Add indexes for analytics queries
CREATE INDEX idx_top_choice ON pump_reports(top_choice_pump);
CREATE INDEX idx_second_choice ON pump_reports(second_choice_pump);
CREATE INDEX idx_third_choice ON pump_reports(third_choice_pump);
CREATE INDEX idx_recommendation_date ON pump_reports(recommendation_date);

-- Display success message
SELECT 'Pump choices tracking columns added successfully!' AS Status;

-- Example analytics query (commented out - for reference)
/*
-- Most recommended pumps (top choice)
SELECT
    top_choice_pump,
    COUNT(*) as recommendation_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pump_reports WHERE top_choice_pump IS NOT NULL), 2) as percentage
FROM pump_reports
WHERE top_choice_pump IS NOT NULL
GROUP BY top_choice_pump
ORDER BY recommendation_count DESC;

-- Recommendation trends over time
SELECT
    DATE(recommendation_date) as date,
    top_choice_pump,
    COUNT(*) as count
FROM pump_reports
WHERE recommendation_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(recommendation_date), top_choice_pump
ORDER BY date DESC, count DESC;

-- Top 3 pump combination patterns
SELECT
    top_choice_pump,
    second_choice_pump,
    third_choice_pump,
    COUNT(*) as combo_count
FROM pump_reports
WHERE top_choice_pump IS NOT NULL
GROUP BY top_choice_pump, second_choice_pump, third_choice_pump
ORDER BY combo_count DESC
LIMIT 10;
*/
