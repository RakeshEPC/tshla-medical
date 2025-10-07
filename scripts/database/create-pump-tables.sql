-- PumpDrive Database Schema for MySQL
-- Tables needed for pump report functionality

USE tshla_medical;

-- Create pump_users table
CREATE TABLE IF NOT EXISTS pump_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    current_payment_status ENUM('pending', 'active', 'expired', 'cancelled') DEFAULT 'pending',
    is_research_participant BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    login_count INT DEFAULT 0,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_payment_status (current_payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create research_participants table
CREATE TABLE IF NOT EXISTS research_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    consent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consent_version VARCHAR(20) DEFAULT '1.0',
    study_group VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create pump_reports table
CREATE TABLE IF NOT EXISTS pump_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    report_data JSON NOT NULL,
    questionnaire_responses JSON,
    recommendations JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',
    payment_amount DECIMAL(10,2),
    payment_date TIMESTAMP NULL,
    stripe_payment_intent_id VARCHAR(255),
    provider_email VARCHAR(255),
    provider_sent_date TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create pump_assessments table (for detailed assessment tracking)
CREATE TABLE IF NOT EXISTS pump_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    report_id INT,
    assessment_type VARCHAR(50) DEFAULT 'questionnaire',
    questions_answered INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    time_taken_seconds INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE,
    FOREIGN KEY (report_id) REFERENCES pump_reports(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_report (report_id),
    INDEX idx_completed (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'PumpDrive tables created successfully!' AS Status;
