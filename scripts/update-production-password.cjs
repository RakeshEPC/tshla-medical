/**
 * Update production database password for eggandsperm@yahoo.com
 * This script connects to Azure MySQL and updates the password hash
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function updatePassword() {
  const connection = await mysql.createConnection({
    host: 'tshla-mysql-prod.mysql.database.azure.com',
    user: 'tshlaadmin',
    password: 'TshlaSecure2025!',
    database: 'tshla_medical',
    ssl: {
      rejectUnauthorized: false,
      require: true,
    },
  });

  try {
    console.log('✅ Connected to production database');

    // Check if user exists
    const [users] = await connection.execute(
      'SELECT id, email, username FROM pump_users WHERE email = ?',
      ['eggandsperm@yahoo.com']
    );

    if (users.length === 0) {
      console.log('❌ User not found in production database');
      return;
    }

    console.log('✅ User found:', users[0]);

    // Generate new password hash for "TestPass123#"
    const newPassword = 'TestPass123#';
    const passwordHash = await bcrypt.hash(newPassword, 10);

    console.log('🔐 Generated new password hash');

    // Update password
    const [result] = await connection.execute(
      'UPDATE pump_users SET password_hash = ?, updated_at = NOW() WHERE email = ?',
      [passwordHash, 'eggandsperm@yahoo.com']
    );

    console.log('✅ Password updated successfully');
    console.log('   Rows affected:', result.affectedRows);
    console.log('');
    console.log('You can now login with:');
    console.log('   Email: eggandsperm@yahoo.com');
    console.log('   Password: TestPass123#');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

updatePassword();
