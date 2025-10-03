const mysql = require('mysql2/promise');

async function addColumns() {
  const connection = await mysql.createConnection({
    host: 'tshla-mysql-prod.mysql.database.azure.com',
    user: 'tshlaadmin',
    password: 'TshlaSecure2025!',
    database: 'tshla_medical',
    ssl: { rejectUnauthorized: false },
  });

  const alterStatements = [
    'ALTER TABLE pump_users ADD COLUMN is_active BOOLEAN DEFAULT TRUE',
    'ALTER TABLE pump_users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE',
    'ALTER TABLE pump_users ADD COLUMN verification_token VARCHAR(255)',
  ];

  console.log('Adding missing columns to pump_users table...\n');

  for (const stmt of alterStatements) {
    try {
      await connection.execute(stmt);
      console.log('✓', stmt.substring(0, 70) + '...');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠', stmt.substring(28, 60), '- already exists');
      } else {
        console.error('✗ Failed:', err.message);
      }
    }
  }

  // Show current table structure
  const [columns] = await connection.execute('DESCRIBE pump_users');
  console.log('\n📋 pump_users table columns:');
  columns.forEach(col => console.log(`   - ${col.Field} (${col.Type})`));

  await connection.end();
  console.log('\n✅ Done!');
}

addColumns().catch(console.error);
