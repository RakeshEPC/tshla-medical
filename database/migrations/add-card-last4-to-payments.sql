/**
 * Add card_last_4 column to patient_payment_requests
 * Stores last 4 digits of credit card for receipt display
 * Created: 2026-01-19
 */

-- Add card_last_4 column
ALTER TABLE patient_payment_requests
ADD COLUMN IF NOT EXISTS card_last_4 VARCHAR(4);

COMMENT ON COLUMN patient_payment_requests.card_last_4 IS 'Last 4 digits of credit card used for payment (for receipt display)';
