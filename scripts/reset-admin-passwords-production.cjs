/**
 * Reset Admin Passwords in Production
 *
 * Changes admin passwords to remove problematic special characters:
 * - admin@tshla.ai: TshlaSecure2025! → TshlaSecure2025#
 * - rakesh@tshla.ai: Indianswing44$ → Indianswing44#
 *
 * Run: node scripts/reset-admin-passwords-production.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Production database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'tshla-mysql-prod.mysql.database.azure.com',
  user: process.env.DB_USER || 'tshlaadmin',
  password: process.env.DB_PASSWORD || 'TshlaSecure2025!',
  database: process.env.DB_DATABASE || 'tshla_medical',
  ssl: {
    rejectUnauthorized: false
  }
};

// New admin passwords (using # instead of ! and $)
const ADMIN_ACCOUNTS = [
  {
    email: 'admin@tshla.ai',
    newPassword: 'TshlaSecure2025#',
    oldPassword: 'TshlaSecure2025!',
    reason: 'Remove ! character (causes JSON parse errors)'
  },
  {
    email: 'rakesh@tshla.ai',
    newPassword: 'Indianswing44#',
    oldPassword: 'Indianswing44$',
    reason: 'Remove $ character (causes shell escaping issues)'
  }
];

async function resetAdminPasswords() {
  let connection;

  try {
    console.log('🔐 Admin Password Reset Utility');
    console.log('================================\n');
    console.log('⚠️  WARNING: This will update passwords in PRODUCTION!\n');

    console.log('🔌 Connecting to production database...');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}\n`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to production database\n');

    // Check if pump_users table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'pump_users'"
    );

    if (tables.length === 0) {
      console.error('❌ Table pump_users does not exist!');
      return;
    }

    console.log('📋 Resetting admin passwords...\n');

    for (const account of ADMIN_ACCOUNTS) {
      try {
        // Check if account exists
        const [users] = await connection.execute(
          'SELECT id, email, username, created_at FROM pump_users WHERE email = ?',
          [account.email]
        );

        if (users.length === 0) {
          console.log(`⚠️  Account not found: ${account.email}`);
          console.log(`   This account needs to be created first.\n`);
          continue;
        }

        const user = users[0];
        console.log(`🔄 Resetting password for: ${account.email}`);
        console.log(`   User ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Reason: ${account.reason}`);

        // Hash new password
        const passwordHash = await bcrypt.hash(account.newPassword, 12);

        // Update password
        await connection.execute(
          `UPDATE pump_users
           SET password_hash = ?,
               is_active = 1,
               current_payment_status = 'active',
               updated_at = NOW()
           WHERE email = ?`,
          [passwordHash, account.email]
        );

        console.log(`   ✅ Password updated successfully!`);
        console.log(`   Old password: ${account.oldPassword}`);
        console.log(`   New password: ${account.newPassword}\n`);

      } catch (error) {
        console.error(`❌ Error updating ${account.email}:`, error.message);
      }
    }

    // Verify updated accounts
    console.log('\n📊 Verification - Admin Accounts:');
    console.log('=====================================');

    const [adminUsers] = await connection.execute(
      `SELECT id, email, username, first_name, last_name,
              current_payment_status, is_active, created_at, updated_at
       FROM pump_users
       WHERE email IN (?, ?)
       ORDER BY email`,
      ['admin@tshla.ai', 'rakesh@tshla.ai']
    );

    if (adminUsers.length === 0) {
      console.log('⚠️  No admin accounts found in database!');
    } else {
      adminUsers.forEach(user => {
        console.log(`\n📧 ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Status: ${user.current_payment_status}`);
        console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Updated: ${user.updated_at}`);
        console.log(`   Role: admin (hardcoded by email)`);
      });
    }

    console.log('\n\n✅ Password reset complete!');
    console.log('\n🔑 New Admin Credentials:');
    console.log('=====================================');
    ADMIN_ACCOUNTS.forEach(account => {
      console.log(`\n📧 ${account.email}`);
      console.log(`   Password: ${account.newPassword}`);
    });

    console.log('\n\n⚠️  IMPORTANT: Update your .env file with new passwords!');
    console.log('   VITE_ADMIN_PASSWORD=TshlaSecure2025#');
    console.log('   DB_PASSWORD=TshlaSecure2025#\n');

  } catch (error) {
    console.error('\n❌ Password reset failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('   Cannot connect to database. Check:');
      console.error('   1. Database host is correct');
      console.error('   2. Database is running');
      console.error('   3. Firewall allows your IP');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Invalid database credentials. Check:');
      console.error('   1. DB_USER is correct');
      console.error('   2. DB_PASSWORD is correct');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   Database host not found. Check:');
      console.error('   1. DB_HOST is correct');
      console.error('   2. Internet connection is active');
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run the password reset
console.log('\n');
resetAdminPasswords();
