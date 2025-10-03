-- Add primary_pump and secondary_pump columns to pump_reports table
ALTER TABLE pump_reports
ADD COLUMN primary_pump VARCHAR(100) AFTER recommendations,
ADD COLUMN secondary_pump VARCHAR(100) AFTER primary_pump;

-- Verify columns were added
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'pump_reports'
  AND COLUMN_NAME IN ('primary_pump', 'secondary_pump');
