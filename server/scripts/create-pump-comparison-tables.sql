-- =====================================================
-- TSHLA Medical - Pump Comparison Database Schema
-- Created: October 3, 2025
-- Purpose: Store 23-dimension pump comparison data
--          for AI-powered recommendations
-- =====================================================

-- Table 1: Pump Comparison Data (23 Dimensions)
CREATE TABLE IF NOT EXISTS pump_comparison_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dimension_number INT NOT NULL,
  dimension_name VARCHAR(255) NOT NULL,
  dimension_description TEXT,
  importance_scale VARCHAR(50) DEFAULT '1-10',
  pump_details JSON NOT NULL COMMENT 'Stores all 6 pumps details for this dimension as JSON',
  category VARCHAR(100) COMMENT 'e.g., Power, Controls, Design, Automation',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dimension (dimension_number),
  INDEX idx_category (category),
  INDEX idx_display_order (display_order),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores 23-dimension pump comparison data for AI recommendations';

-- Table 2: Pump Manufacturers & Representative Contacts
CREATE TABLE IF NOT EXISTS pump_manufacturers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pump_name VARCHAR(255) NOT NULL UNIQUE,
  manufacturer VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  rep_name VARCHAR(255) COMMENT 'Sales representative name',
  rep_contact VARCHAR(255) COMMENT 'Phone number or contact method',
  rep_email VARCHAR(255),
  support_phone VARCHAR(50) COMMENT 'General customer support phone',
  support_email VARCHAR(255),
  notes TEXT COMMENT 'Additional notes about pump or manufacturer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pump_name (pump_name),
  INDEX idx_manufacturer (manufacturer),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores pump manufacturer details and representative contact information';

-- Table 3: Pump Comparison Change Log (Audit Trail)
CREATE TABLE IF NOT EXISTS pump_comparison_changelog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL COMMENT 'pump_comparison_data or pump_manufacturers',
  record_id INT NOT NULL COMMENT 'ID of the changed record',
  change_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  changed_by VARCHAR(255) COMMENT 'User who made the change',
  old_value JSON COMMENT 'Previous value (for UPDATE/DELETE)',
  new_value JSON COMMENT 'New value (for INSERT/UPDATE)',
  change_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_change_type (change_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail for pump comparison data changes';

-- =====================================================
-- Initial Data: Pump Manufacturers
-- =====================================================
INSERT INTO pump_manufacturers (pump_name, manufacturer, website, rep_name, rep_contact, support_phone, notes) VALUES
('Medtronic 780G', 'Medtronic', 'https://www.medtronicdiabetes.com', 'Bobby/Laura', NULL, '1-800-646-4633', 'MiniMed 780G with SmartGuard technology'),
('Tandem t:slim X2', 'Tandem Diabetes Care', 'https://www.tandemdiabetes.com', 'Meghan', NULL, '1-877-801-6901', 't:slim X2 with Control-IQ technology'),
('Tandem Mobi', 'Tandem Diabetes Care', 'https://www.tandemdiabetes.com/products/tandem-mobi', 'Meghan', NULL, '1-877-801-6901', 'Smallest tubed pump with Control-IQ'),
('Omnipod 5', 'Insulet Corporation', 'https://www.omnipod.com', 'Celeste', NULL, '1-800-591-3455', 'Tubeless pod system with automated insulin delivery'),
('Beta Bionics iLet', 'Beta Bionics', 'https://www.betabionics.com', 'Katherine', NULL, '1-844-443-8123', 'Bionic pancreas with no carb counting'),
('Twiist', 'Sequel Med Tech', 'https://www.sequelmedtech.com', 'Brittney B', NULL, NULL, 'New automated insulin delivery system with Apple Watch integration')
ON DUPLICATE KEY UPDATE
  manufacturer = VALUES(manufacturer),
  website = VALUES(website),
  rep_name = VALUES(rep_name),
  updated_at = CURRENT_TIMESTAMP;
