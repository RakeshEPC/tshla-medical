const mysql = require('mysql2/promise');

async function createTables() {
  const connection = await mysql.createConnection({
    host: 'tshla-mysql-prod.mysql.database.azure.com',
    user: 'tshlaadmin',
    password: 'TshlaSecure2025!',
    database: 'tshla_medical',
    ssl: { rejectUnauthorized: false },
  });

  const tables = [
    `CREATE TABLE IF NOT EXISTS pump_users (
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
      INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    
    `CREATE TABLE IF NOT EXISTS research_participants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      consent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      consent_version VARCHAR(20) DEFAULT '1.0',
      study_group VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES pump_users(id) ON DELETE CASCADE,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    
    `CREATE TABLE IF NOT EXISTS pump_reports (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    
    `CREATE TABLE IF NOT EXISTS pump_assessments (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  console.log('Creating tables...\n');
  
  for (let i = 0; i < tables.length; i++) {
    try {
      await connection.execute(tables[i]);
      console.log(`✓ Table ${i + 1}/4 created`);
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERR') {
        console.log(`✓ Table ${i + 1}/4 already exists`);
      } else {
        console.error(`✗ Table ${i + 1}/4 failed:`, err.message);
      }
    }
  }

  const [tablesList] = await connection.execute('SHOW TABLES');
  console.log('\n📋 All tables in database:');
  tablesList.forEach(row => console.log('   -', Object.values(row)[0]));

  await connection.end();
  console.log('\n✅ Done!');
}

createTables().catch(console.error);
