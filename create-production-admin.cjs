/**
 * Production Admin Account Setup
 * Creates admin account for rakesh@tshla.ai in production database
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createProductionAdmin() {
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

    // Check if admin account exists
    const [existing] = await connection.execute(
      'SELECT id, email, role FROM medical_staff WHERE email = ?',
      ['rakesh@tshla.ai']
    );

    if (existing.length > 0) {
      console.log('⚠️  Admin account already exists:');
      console.log('   ID:', existing[0].id);
      console.log('   Email:', existing[0].email);
      console.log('   Role:', existing[0].role);

      // Update to admin role if not already
      if (existing[0].role !== 'admin') {
        console.log('\nUpdating role to admin...');
        await connection.execute(
          'UPDATE medical_staff SET role = ? WHERE email = ?',
          ['admin', 'rakesh@tshla.ai']
        );
        console.log('✓ Role updated to admin');
      } else {
        console.log('\n✓ Account already has admin role');
      }

      // Update password to ensure it matches
      console.log('\nUpdating password...');
      const password = 'TshlaSecure2025!';
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute(
        'UPDATE medical_staff SET password_hash = ? WHERE email = ?',
        [passwordHash, 'rakesh@tshla.ai']
      );
      console.log('✓ Password updated');

    } else {
      // Create new admin account
      console.log('Creating admin account for rakesh@tshla.ai...');

      const password = 'TshlaSecure2025!';
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      await connection.execute(
        `INSERT INTO medical_staff (
          email, username, password_hash, first_name, last_name,
          role, practice, specialty, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'rakesh@tshla.ai',
          'rakesh',
          passwordHash,
          'Rakesh',
          'Patel',
          'admin',
          'TSHLA Medical',
          'Administration',
          1
        ]
      );

      console.log('✓ Admin account created successfully');
    }

    // Verify the account
    const [result] = await connection.execute(
      'SELECT id, username, email, role, first_name, last_name FROM medical_staff WHERE email = ?',
      ['rakesh@tshla.ai']
    );

    console.log('\n=== Production Admin Account ===');
    console.log('Email:', result[0].email);
    console.log('Username:', result[0].username);
    console.log('Role:', result[0].role);
    console.log('Name:', result[0].first_name, result[0].last_name);
    console.log('\n🔐 Credentials:');
    console.log('Email: rakesh@tshla.ai');
    console.log('Password: TshlaSecure2025!');
    console.log('\n✅ Production admin account ready!');
    console.log('\n📍 Login at: https://www.tshla.ai/login');
    console.log('📍 Dashboard: https://www.tshla.ai/admin/pumpdrive-users');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Check database credentials');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Tip: Check database host name');
    } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Add your IP to Azure MySQL firewall:');
      console.error('   1. Go to Azure Portal');
      console.error('   2. Find MySQL server: tshla-mysql-staging');
      console.error('   3. Go to Networking > Firewall rules');
      console.error('   4. Add your current IP address');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

createProductionAdmin();
