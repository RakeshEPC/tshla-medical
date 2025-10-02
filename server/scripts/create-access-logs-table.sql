-- Create access_logs table for PumpDrive user access tracking
-- This table tracks user registrations, renewals, and access events

CREATE TABLE IF NOT EXISTS access_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  access_type VARCHAR(50) NOT NULL COMMENT 'initial_purchase, renewal, research_access, etc.',
  payment_amount_cents INT DEFAULT 0 COMMENT 'Payment amount in cents (999 = $9.99)',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IPv4 or IPv6 address',
  user_agent TEXT DEFAULT NULL COMMENT 'Browser user agent string',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_access_type (access_type),
  INDEX idx_created_at (created_at),

  FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks user access events and payment history for PumpDrive';
