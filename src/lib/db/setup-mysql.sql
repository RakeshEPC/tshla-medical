-- HIPAA-Compliant Database Setup for MySQL (Azure Database for MySQL)
-- Run this script after creating your Azure MySQL database

-- Use the database
USE tshla_medical;

-- Set character encoding
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create audit log table (immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    actor_id VARCHAR(255) NOT NULL,
    patient_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),
    success BOOLEAN DEFAULT TRUE,
    metadata JSON,
    previous_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_actor (actor_id),
    INDEX idx_patient (patient_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create trigger to prevent updates and deletes on audit_logs
DELIMITER $$
CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Audit logs cannot be updated';
END$$

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Audit logs cannot be deleted';
END$$
DELIMITER ;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    absolute_expiry TIMESTAMP NOT NULL,
    idle_expiry TIMESTAMP NOT NULL,
    ip VARCHAR(45),
    user_agent TEXT,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_expiry (absolute_expiry, idle_expiry),
    INDEX idx_active_sessions (active, idle_expiry)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    npi VARCHAR(10) UNIQUE,
    dea VARCHAR(20),
    license_number VARCHAR(50),
    license_state CHAR(2),
    specialty VARCHAR(100),
    practice_name VARCHAR(255),
    practice_address TEXT,
    phone VARCHAR(20),
    role ENUM('doctor', 'admin', 'nurse', 'staff') DEFAULT 'doctor',
    is_active BOOLEAN DEFAULT TRUE,
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    settings JSON DEFAULT '{}',
    INDEX idx_email (email),
    INDEX idx_npi (npi),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create patients table (all PHI encrypted at application level)
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    ava_id VARCHAR(50) UNIQUE,
    encrypted_data JSON NOT NULL COMMENT 'All PHI encrypted before storage',
    encryption_key_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    consent_date DATE,
    consent_version VARCHAR(20),
    INDEX idx_ava (ava_id),
    INDEX idx_created_by (created_by),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create patient_charts table
CREATE TABLE IF NOT EXISTS patient_charts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    doctor_id CHAR(36) NOT NULL,
    patient_id VARCHAR(50) NOT NULL,
    encrypted_patient_name TEXT,
    encrypted_patient_dob TEXT,
    encounter_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    encrypted_chief_complaint TEXT,
    encrypted_transcript TEXT,
    encrypted_soap_note JSON,
    encrypted_diagnoses JSON DEFAULT '[]',
    encrypted_medications JSON DEFAULT '[]',
    prior_auth_required BOOLEAN DEFAULT FALSE,
    encrypted_prior_auth_data JSON,
    template_used VARCHAR(100),
    is_finalized BOOLEAN DEFAULT FALSE,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP NULL,
    signed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY)),
    deleted_at TIMESTAMP NULL,
    deletion_reason VARCHAR(255),
    INDEX idx_doctor (doctor_id),
    INDEX idx_patient (patient_id),
    INDEX idx_encounter (encounter_date),
    INDEX idx_expires (expires_at),
    INDEX idx_deleted (deleted_at),
    UNIQUE KEY unique_encounter (doctor_id, patient_id, encounter_date),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create visits table
CREATE TABLE IF NOT EXISTS visits (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    patient_id VARCHAR(50) NOT NULL,
    visit_date DATE NOT NULL,
    encrypted_dictation TEXT,
    encrypted_soap_note JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    INDEX idx_patient (patient_id),
    INDEX idx_date (visit_date),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create mental health scores table
CREATE TABLE IF NOT EXISTS mental_health_scores (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    patient_id VARCHAR(50) NOT NULL,
    assessment_type ENUM('PHQ9', 'GAD7', 'PHQ2', 'GAD2', 'MDQ', 'ASRS') NOT NULL,
    encrypted_score JSON NOT NULL COMMENT 'Encrypted scores and responses',
    encrypted_responses JSON,
    assessment_date DATE NOT NULL,
    administered_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    INDEX idx_patient (patient_id),
    INDEX idx_type (assessment_type),
    INDEX idx_date (assessment_date),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    doctor_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100),
    template_type VARCHAR(50),
    is_shared BOOLEAN DEFAULT FALSE,
    is_system_template BOOLEAN DEFAULT FALSE,
    sections JSON NOT NULL,
    macros JSON DEFAULT '{}',
    quick_phrases JSON DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usage_count INT DEFAULT 0,
    last_used TIMESTAMP NULL,
    INDEX idx_doctor (doctor_id),
    INDEX idx_specialty (specialty),
    INDEX idx_shared (is_shared),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create prior authorizations table
CREATE TABLE IF NOT EXISTS prior_authorizations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    chart_id CHAR(36),
    doctor_id CHAR(36) NOT NULL,
    patient_id VARCHAR(50) NOT NULL,
    encrypted_medication TEXT NOT NULL,
    diagnosis_codes JSON DEFAULT '[]',
    encrypted_insurance_info JSON,
    encrypted_clinical_data JSON NOT NULL,
    questions_answered JSON,
    covermymeds_id VARCHAR(100),
    status ENUM('pending', 'approved', 'denied', 'expired', 'cancelled') DEFAULT 'pending',
    submitted_at TIMESTAMP NULL,
    response_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY)),
    INDEX idx_chart (chart_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_patient (patient_id),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (chart_id) REFERENCES patient_charts(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create encryption keys table (for key rotation)
CREATE TABLE IF NOT EXISTS encryption_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_id VARCHAR(50) UNIQUE NOT NULL,
    encrypted_key TEXT NOT NULL COMMENT 'Master key encrypted with Azure Key Vault',
    algorithm VARCHAR(20) DEFAULT 'AES-256-GCM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP NULL,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_key_id (key_id),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create doctor access table for sharing
CREATE TABLE IF NOT EXISTS doctor_access (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    doctor_id CHAR(36) NOT NULL,
    shared_with_doctor_id CHAR(36) NOT NULL,
    access_level ENUM('read', 'write', 'admin') DEFAULT 'read',
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    INDEX idx_doctor (doctor_id),
    INDEX idx_shared_with (shared_with_doctor_id),
    INDEX idx_expires (expires_at),
    UNIQUE KEY unique_access (doctor_id, shared_with_doctor_id, resource_type, resource_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create backup tracking table
CREATE TABLE IF NOT EXISTS backup_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_type ENUM('full', 'incremental', 'differential') NOT NULL,
    backup_location VARCHAR(500) NOT NULL,
    backup_size_mb DECIMAL(10,2),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    status ENUM('running', 'completed', 'failed') DEFAULT 'running',
    error_message TEXT,
    retention_days INT DEFAULT 2555 COMMENT '7 years for HIPAA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_completed (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit trigger for patient data access
DELIMITER $$
CREATE TRIGGER audit_patient_access
AFTER SELECT ON patients
FOR EACH ROW
BEGIN
    -- Note: MySQL doesn't support SELECT triggers
    -- This is a placeholder - use application-level auditing
    -- Or use MySQL Enterprise Audit plugin
END$$

-- Create trigger for automatic chart expiration
CREATE EVENT IF NOT EXISTS expire_old_charts
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    UPDATE patient_charts 
    SET deleted_at = CURRENT_TIMESTAMP,
        deletion_reason = 'Auto-expired after 14 days'
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND deleted_at IS NULL;
END$$

-- Create event for session cleanup
CREATE EVENT IF NOT EXISTS cleanup_expired_sessions
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    UPDATE sessions 
    SET active = FALSE
    WHERE (idle_expiry < CURRENT_TIMESTAMP OR absolute_expiry < CURRENT_TIMESTAMP)
    AND active = TRUE;
END$$
DELIMITER ;

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Create application users with limited permissions
-- Note: Replace passwords before running in production

-- Read-only user for reporting
CREATE USER IF NOT EXISTS 'tshla_reporter'@'%' IDENTIFIED BY 'CHANGE_THIS_PASSWORD_REPORTER_2024!';
GRANT SELECT ON tshla_medical.audit_logs TO 'tshla_reporter'@'%';
GRANT SELECT ON tshla_medical.backup_history TO 'tshla_reporter'@'%';

-- Application user with necessary permissions
CREATE USER IF NOT EXISTS 'tshla_app'@'%' IDENTIFIED BY 'CHANGE_THIS_PASSWORD_APP_2024!';
GRANT SELECT, INSERT, UPDATE ON tshla_medical.* TO 'tshla_app'@'%';
-- Explicitly deny DELETE on audit_logs (extra protection)
REVOKE DELETE ON tshla_medical.audit_logs FROM 'tshla_app'@'%';

-- Admin user for maintenance
CREATE USER IF NOT EXISTS 'tshla_admin'@'%' IDENTIFIED BY 'CHANGE_THIS_PASSWORD_ADMIN_2024!';
GRANT ALL PRIVILEGES ON tshla_medical.* TO 'tshla_admin'@'%';

-- Require SSL for all users
ALTER USER 'tshla_reporter'@'%' REQUIRE SSL;
ALTER USER 'tshla_app'@'%' REQUIRE SSL;
ALTER USER 'tshla_admin'@'%' REQUIRE SSL;

-- Flush privileges
FLUSH PRIVILEGES;

-- Insert default encryption key (replace with actual key from Azure Key Vault)
INSERT INTO encryption_keys (key_id, encrypted_key, algorithm, active)
VALUES ('default-key-2024', 'ENCRYPTED_KEY_FROM_AZURE_KEY_VAULT', 'AES-256-GCM', TRUE);

-- Insert authorized doctors (with hashed passwords)
-- Passwords should be hashed using bcrypt or similar in application
INSERT INTO doctors (email, password_hash, first_name, last_name, specialty, role)
VALUES 
    ('patelcyfair@yahoo.com', SHA2('Indianswing44$', 256), 'Dr.', 'Patel', 'Internal Medicine', 'doctor'),
    ('rakesh@tshla.ai', SHA2('Indianswing44$', 256), 'Dr.', 'Rakesh', 'General Practice', 'admin'),
    ('docparikh@gmail.com', SHA2('NFLsports99$', 256), 'Dr.', 'Parikh', 'Cardiology', 'doctor')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Create initial audit log entry
INSERT INTO audit_logs (
    actor_id, 
    patient_id, 
    action, 
    ip, 
    metadata,
    previous_hash,
    hash
) VALUES (
    'system',
    'system',
    'DATABASE_INITIALIZED',
    '127.0.0.1',
    JSON_OBJECT('event', 'Database schema created', 'version', '1.0.0'),
    '0',
    SHA2('system|system|DATABASE_INITIALIZED|127.0.0.1', 256)
);

-- Display important information
SELECT '===============================================' AS '';
SELECT 'Azure MySQL Database Setup Complete!' AS 'Status';
SELECT '===============================================' AS '';
SELECT 'IMPORTANT: Complete these steps:' AS 'Next Steps';
SELECT '1. Change all default passwords immediately' AS '';
SELECT '2. Configure Azure Key Vault for encryption keys' AS '';
SELECT '3. Enable Private Endpoint for production' AS '';
SELECT '4. Sign BAA with Microsoft' AS '';
SELECT '5. Configure automated backups to Azure Storage' AS '';
SELECT '6. Set up monitoring and alerts' AS '';
SELECT '7. Run security audit before going live' AS '';
SELECT '===============================================' AS '';