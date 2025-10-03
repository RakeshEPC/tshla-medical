/**
 * Production Database Setup - Create Required Tables
 * Creates pump_reports table and adds missing columns to pump_users
 */

const mysql = require('mysql2/promise');

async function setupProductionTables() {
  const dbConfig = {
    host: 'tshla-mysql-staging.mysql.database.azure.com',
    user: 'tshlaadmin',
    password: 'TshlaSecure2025!',
    database: 'tshla_medical_staging',
    ssl: {
      rejectUnauthorized: false
    }
  };

  let connection;

  try {
    console.log('Connecting to production database...');
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Database: ${dbConfig.database}`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected successfully\n');

    // Check existing tables
    console.log('Checking existing tables...');
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'pump%'"
    );
    console.log('Existing pump tables:', tables.map(t => Object.values(t)[0]).join(', ') || 'None');

    // Create pump_reports table
    console.log('\nCreating pump_reports table...');
    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ pump_reports table created/verified');

    // Add email_verified column if missing
    console.log('\nAdding email_verified column to pump_users...');
    try {
      await connection.execute(`
        ALTER TABLE pump_users
        ADD COLUMN email_verified BOOLEAN DEFAULT FALSE
      `);
      console.log('✓ email_verified column added');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ email_verified column already exists');
      } else {
        throw error;
      }
    }

    // Verify is_active column exists
    console.log('\nVerifying is_active column...');
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM pump_users LIKE 'is_active'
    `);
    if (columns.length > 0) {
      console.log('✓ is_active column exists');
    } else {
      await connection.execute(`
        ALTER TABLE pump_users
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE
      `);
      console.log('✓ is_active column added');
    }

    // Final verification
    console.log('\n=== Final Database Status ===');
    const [finalTables] = await connection.execute(
      "SHOW TABLES LIKE 'pump%'"
    );
    console.log('Tables:', finalTables.map(t => Object.values(t)[0]).join(', '));

    const [pumpUsersColumns] = await connection.execute(
      "SHOW COLUMNS FROM pump_users"
    );
    console.log('\npump_users columns:', pumpUsersColumns.map(c => c.Field).join(', '));

    console.log('\n✅ Production database setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Check database credentials in .env.production');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Tip: Check database host name');
    } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Check if your IP is allowed in Azure MySQL firewall');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

setupProductionTables();
