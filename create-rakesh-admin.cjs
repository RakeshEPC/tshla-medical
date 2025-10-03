/**
 * Create Admin Account for Rakesh
 * This script creates an admin account in the medical_staff table
 * so rakesh@tshla.ai can access the admin dashboard with proper JWT tokens
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createAdminAccount() {
  const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'tshla_medical_local'
  };

  let connection;

  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database');

    // Check if rakesh@tshla.ai already exists
    const [existing] = await connection.execute(
      'SELECT id, email, role FROM medical_staff WHERE email = ?',
      ['rakesh@tshla.ai']
    );

    if (existing.length > 0) {
      console.log('⚠️  rakesh@tshla.ai already exists:');
      console.log('   ID:', existing[0].id);
      console.log('   Email:', existing[0].email);
      console.log('   Role:', existing[0].role);

      // Update to admin if not already
      if (existing[0].role !== 'admin') {
        await connection.execute(
          'UPDATE medical_staff SET role = ? WHERE email = ?',
          ['admin', 'rakesh@tshla.ai']
        );
        console.log('✓ Updated role to admin');
      } else {
        console.log('✓ Already has admin role');
      }
    } else {
      // Create new admin account
      console.log('\nCreating admin account for rakesh@tshla.ai...');

      const password = 'TshlaSecure2025!'; // Same as VITE_ADMIN_PASSWORD
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

    console.log('\n=== Admin Account Details ===');
    console.log('Email:', result[0].email);
    console.log('Username:', result[0].username);
    console.log('Role:', result[0].role);
    console.log('Name:', result[0].first_name, result[0].last_name);
    console.log('Password: TshlaSecure2025!');
    console.log('\n✓ You can now login at http://localhost:5173/login with these credentials');
    console.log('✓ After login, access admin dashboard at: http://localhost:5173/admin/pumpdrive-users');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

createAdminAccount();
