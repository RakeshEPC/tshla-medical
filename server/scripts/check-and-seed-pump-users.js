/**
 * Check and Seed Script for PumpDrive Users
 * Connects to production database and creates users if they don't exist
 * Safe to run multiple times
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Production database configuration
const dbConfig = {
  host: 'tshla-mysql-prod.mysql.database.azure.com',
  user: 'tshlaadmin',
  password: 'TshlaSecure2025!',
  database: 'tshla_medical',
  ssl: {
    rejectUnauthorized: false
  }
};

const TEST_USERS = [
  {
    email: 'demo@pumpdrive.com',
    password: 'pumpdrive2025',
    username: 'demo',
    firstName: 'Demo',
    lastName: 'User',
    phoneNumber: '555-0100',
    isResearchParticipant: false
  },
  {
    email: 'rakesh@tshla.ai',
    password: 'Indianswing44$',
    username: 'rakesh',
    firstName: 'Rakesh',
    lastName: 'Patel',
    phoneNumber: '555-0101',
    isResearchParticipant: false
  },
  {
    email: 'test@pumpdrive.com',
    password: 'test123',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '555-0102',
    isResearchParticipant: true
  }
];

async function checkAndSeedUsers() {
  let connection;

  try {
    console.log('🔌 Connecting to PRODUCTION database...');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}\n`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    // First, check current users
    console.log('📊 Checking existing users...');
    const [existingUsers] = await connection.execute(
      'SELECT id, email, username, is_active FROM pump_users'
    );

    console.log(`Found ${existingUsers.length} existing user(s)\n`);

    if (existingUsers.length > 0) {
      console.log('Current users:');
      existingUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.username}) - Active: ${user.is_active}`);
      });
      console.log('');
    }

    // Now create/update test users
    console.log('📋 Creating/updating test users...\n');

    for (const user of TEST_USERS) {
      try {
        // Check if user already exists
        const [existing] = await connection.execute(
          'SELECT id, email FROM pump_users WHERE email = ?',
          [user.email]
        );

        if (existing.length > 0) {
          console.log(`⚠️  User already exists: ${user.email}`);

          // Update password if user exists (useful for testing)
          const passwordHash = await bcrypt.hash(user.password, 12);
          await connection.execute(
            `UPDATE pump_users
             SET password_hash = ?,
                 first_name = ?,
                 last_name = ?,
                 is_active = 1,
                 current_payment_status = 'active'
             WHERE email = ?`,
            [passwordHash, user.firstName, user.lastName, user.email]
          );
          console.log(`   ✓ Updated password for ${user.email}\n`);
          continue;
        }

        // Create new user
        const passwordHash = await bcrypt.hash(user.password, 12);

        await connection.execute(
          `INSERT INTO pump_users (
            email,
            username,
            password_hash,
            first_name,
            last_name,
            phone_number,
            current_payment_status,
            is_research_participant,
            is_active,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            user.email,
            user.username,
            passwordHash,
            user.firstName,
            user.lastName,
            user.phoneNumber,
            'active',
            user.isResearchParticipant ? 1 : 0,
            1
          ]
        );

        console.log(`✅ Created user: ${user.email}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Password: ${user.password}`);
        console.log(`   Status: active\n`);
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error.message);
      }
    }

    // Show final user list
    console.log('\n📊 All pump users in PRODUCTION database:');
    console.log('=====================================');
    const [allUsers] = await connection.execute(
      `SELECT
        id,
        email,
        username,
        first_name,
        last_name,
        current_payment_status,
        is_active,
        created_at
       FROM pump_users
       ORDER BY created_at DESC`
    );

    if (allUsers.length === 0) {
      console.log('❌ WARNING: No users found in database!');
      console.log('   The INSERT queries may have failed silently.');
    } else {
      allUsers.forEach(user => {
        console.log(`\n📧 ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Status: ${user.current_payment_status}`);
        console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
        console.log(`   Created: ${user.created_at}`);
      });
    }

    console.log('\n\n✅ Check and seed complete!');
    console.log('\n🔑 Test Credentials:');
    console.log('=====================================');
    TEST_USERS.forEach(user => {
      console.log(`\n📧 ${user.email}`);
      console.log(`   Password: ${user.password}`);
    });

  } catch (error) {
    console.error('\n❌ Operation failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Cannot connect to database. Check:');
      console.error('   1. Database host is correct');
      console.error('   2. Database is running');
      console.error('   3. Firewall allows your IP');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Invalid database credentials. Check:');
      console.error('   1. DB_USER is correct');
      console.error('   2. DB_PASSWORD is correct');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   Connection timeout. Possible causes:');
      console.error('   1. Azure MySQL firewall blocking your IP');
      console.error('   2. Network connectivity issues');
      console.error('   Solution: Run this from Azure Container or add IP to firewall');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run checker/seeder
console.log('🌱 PumpDrive Users - Check and Seed');
console.log('=====================================\n');
checkAndSeedUsers();
