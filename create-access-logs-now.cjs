#!/usr/bin/env node

/**
 * Quick script to create access_logs table in production database
 */

const mysql = require('mysql2/promise');

async function createTable() {
  console.log('🔧 Connecting to production database...');

  const connection = await mysql.createConnection({
    host: 'tshla-mysql-prod.mysql.database.azure.com',
    user: 'tshlaadmin',
    password: 'TshlaSecure2025!',
    database: 'tshla_medical',
    ssl: {
      rejectUnauthorized: false
    }
  });

  console.log('✅ Connected successfully!');
  console.log('📝 Creating access_logs table...');

  const createTableSQL = `
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
  `;

  try {
    await connection.execute(createTableSQL);
    console.log('✅ access_logs table created successfully!');

    // Verify the table
    const [tables] = await connection.execute("SHOW TABLES LIKE 'access_logs'");
    console.log(`📊 Table verification: ${tables.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);

    // Show table structure
    const [columns] = await connection.execute("DESCRIBE access_logs");
    console.log('\n📋 Table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 Database connection closed.');
  }
}

createTable()
  .then(() => {
    console.log('\n✨ Done! The access_logs table is now ready.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
