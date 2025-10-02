#!/usr/bin/env python3
"""
Quick script to create access_logs table in Azure MySQL production database
"""

import mysql.connector
import sys

print("🔧 Connecting to production database...")

try:
    # Connect to database
    connection = mysql.connector.connect(
        host='tshla-mysql-prod.mysql.database.azure.com',
        user='tshlaadmin',
        password='TshlaSecure2025!',
        database='tshla_medical',
        ssl_ca=None,  # Accept Azure SSL
        ssl_disabled=False
    )

    print("✅ Connected successfully!")

    cursor = connection.cursor()

    # Create table SQL
    create_table_sql = """
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
    COMMENT='Tracks user access events and payment history for PumpDrive'
    """

    print("📝 Creating access_logs table...")
    cursor.execute(create_table_sql)
    connection.commit()

    print("✅ Table created successfully!")

    # Verify table exists
    cursor.execute("SHOW TABLES LIKE 'access_logs'")
    result = cursor.fetchall()

    if result:
        print(f"📊 Verification: Table exists! Found {len(result)} match(es)")

        # Show table structure
        cursor.execute("DESCRIBE access_logs")
        columns = cursor.fetchall()
        print("\n📋 Table structure:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]} {'NOT NULL' if col[2] == 'NO' else 'NULL'}")
    else:
        print("❌ ERROR: Table not found after creation!")
        sys.exit(1)

    cursor.close()
    connection.close()

    print("\n✨ Done! The access_logs table is now ready.")
    sys.exit(0)

except mysql.connector.Error as err:
    print(f"❌ MySQL Error: {err}")
    sys.exit(1)
except Exception as e:
    print(f"💥 Error: {e}")
    sys.exit(1)
