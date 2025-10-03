/**
 * Production Database Setup - Create medical_staff Table
 * This table is required for medical staff authentication (separate from pump users)
 */

const mysql = require('mysql2/promise');

async function createMedicalStaffTable() {
  const dbConfig = {
    host: 'tshla-mysql-prod.mysql.database.azure.com',
    user: 'tshlaadmin',
    password: 'TshlaSecure2025!',
    database: 'tshla_medical',
    ssl: {
      rejectUnauthorized: false
    }
  };

  let connection;

  try {
    console.log('Connecting to production database...');
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Database: ${dbConfig.database}\n`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected successfully\n');

    // Check if table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'medical_staff'"
    );

    if (tables.length > 0) {
      console.log('⚠️  medical_staff table already exists');
      console.log('Skipping creation...\n');
    } else {
      console.log('Creating medical_staff table...');

      await connection.execute(`
        CREATE TABLE medical_staff (
          id INT NOT NULL AUTO_INCREMENT,
          email VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          username VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          password_hash VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          first_name VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          last_name VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          role ENUM('doctor','nurse','staff','medical_assistant','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'doctor',
          practice VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          specialty VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          is_active TINYINT(1) DEFAULT 1,
          requires_password_change TINYINT(1) DEFAULT 0,
          last_login TIMESTAMP NULL DEFAULT NULL,
          login_count INT DEFAULT 0,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY email (email),
          KEY idx_email_active (email, is_active),
          KEY idx_role (role),
          KEY idx_login_tracking (last_login, login_count)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Medical professionals authentication - separate from PumpDrive users'
      `);

      console.log('✓ medical_staff table created successfully\n');
    }

    // Verify table structure
    const [columns] = await connection.execute(
      'SHOW COLUMNS FROM medical_staff'
    );

    console.log('=== Table Structure ===');
    console.log('Columns:', columns.map(c => c.Field).join(', '));
    console.log('\n✅ medical_staff table ready!');
    console.log('\nNext step: Run create-production-admin.cjs to create admin account');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Check database credentials');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Tip: Check database host name');
    } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Add your IP to Azure MySQL firewall');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

createMedicalStaffTable();
