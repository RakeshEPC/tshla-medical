/**
 * Verify access_logs table structure
 */

const mysql = require('mysql2/promise');

const azureConfig = {
  host: 'tshla-mysql-prod.mysql.database.azure.com',
  port: 3306,
  user: 'tshlaadmin',
  password: 'TshlaSecure2025!',
  database: 'tshla_medical',
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectTimeout: 30000
};

async function verifyTable() {
  let connection;

  try {
    connection = await mysql.createConnection(azureConfig);
    console.log('✅ Connected to Azure MySQL Production\n');

    // Check table structure
    console.log('📋 access_logs table structure:');
    const [columns] = await connection.query('DESCRIBE access_logs');
    columns.forEach(col => {
      console.log(`   ${col.Field} - ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });

    // Count existing records
    const [[{count}]] = await connection.query('SELECT COUNT(*) as count FROM access_logs');
    console.log(`\n📊 Current records in access_logs: ${count}`);

    // Check pump_users table
    console.log('\n👥 Checking pump_users table:');
    const [[{userCount}]] = await connection.query('SELECT COUNT(*) as userCount FROM pump_users');
    console.log(`   Total users: ${userCount}`);

    if (userCount > 0) {
      const [users] = await connection.query('SELECT id, email, username, created_at FROM pump_users LIMIT 5');
      console.log('\n   Sample users:');
      users.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.email} (${user.username}) - Created: ${user.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyTable();
