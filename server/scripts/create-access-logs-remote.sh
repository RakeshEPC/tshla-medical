#!/bin/bash

# Create access_logs table in production Azure MySQL database
# This script connects to the production database and creates the missing table

set -e

echo "🔧 Creating access_logs table in production database..."

# Database connection details
DB_HOST="tshla-mysql-prod.mysql.database.azure.com"
DB_USER="tshlaadmin"
DB_PASSWORD="TshlaSecure2025!"
DB_NAME="tshla_medical"

# SQL to create the table
SQL=$(cat << 'EOF'
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
EOF
)

# Execute the SQL
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -D "$DB_NAME" --ssl-mode=REQUIRED -e "$SQL"

if [ $? -eq 0 ]; then
  echo "✅ access_logs table created successfully!"

  # Verify the table was created
  echo "📊 Verifying table structure..."
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -D "$DB_NAME" --ssl-mode=REQUIRED -e "SHOW TABLES LIKE 'access_logs';"
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -D "$DB_NAME" --ssl-mode=REQUIRED -e "DESCRIBE access_logs;"
else
  echo "❌ Failed to create access_logs table"
  exit 1
fi
