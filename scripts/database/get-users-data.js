/**
 * Script to retrieve all PumpDrive users with their credentials and pump selections
 * Connects directly to Azure MySQL database
 */

import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config();

// Azure Production Database Configuration
const dbConfig = {
  host: 'tshla-mysql-prod.mysql.database.azure.com',
  user: 'tshlaadmin',
  password: 'TshlaSecure2025!',
  database: 'tshla_medical',
  ssl: {
    rejectUnauthorized: false
  },
  connectTimeout: 30000
};

async function getUsersData() {
  let connection;

  try {
    console.log('Connecting to Azure MySQL database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Query to get all users with their pump selections
    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.password_hash,
        u.created_at,
        u.has_paid,
        u.payment_amount_cents,
        a.pump_name as primary_pump,
        a.pump_manufacturer as primary_manufacturer,
        a.confidence_score as primary_confidence,
        a.secondary_recommendation as secondary_pump,
        a.secondary_manufacturer,
        a.secondary_confidence,
        a.created_at as assessment_date
      FROM pump_users u
      LEFT JOIN pump_assessments a ON u.id = a.user_id
      ORDER BY u.created_at DESC
    `;

    const [rows] = await connection.execute(query);

    if (rows.length === 0) {
      console.log('❌ No users found in database\n');
      return;
    }

    console.log(`📊 Found ${rows.length} user record(s)\n`);
    console.log('=' .repeat(150));
    console.log('USER DATA TABLE');
    console.log('=' .repeat(150));

    // Header
    console.log(
      'ID'.padEnd(5) +
      'Username'.padEnd(15) +
      'Email'.padEnd(30) +
      'Name'.padEnd(25) +
      'Phone'.padEnd(15) +
      'Password Hash'.padEnd(70) +
      'Paid'.padEnd(6) +
      'Created'
    );
    console.log('-'.repeat(150));

    // User rows
    rows.forEach(row => {
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
      const createdDate = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : 'N/A';

      console.log(
        String(row.id || '').padEnd(5) +
        String(row.username || '').padEnd(15) +
        String(row.email || '').padEnd(30) +
        fullName.padEnd(25) +
        String(row.phone_number || '').padEnd(15) +
        String(row.password_hash || '').substring(0, 60).padEnd(70) +
        String(row.has_paid ? 'YES' : 'NO').padEnd(6) +
        createdDate
      );
    });

    console.log('\n' + '=' .repeat(150));
    console.log('PUMP SELECTIONS');
    console.log('=' .repeat(150));

    // Pump selection header
    console.log(
      'User ID'.padEnd(10) +
      'Email'.padEnd(30) +
      'Primary Pump'.padEnd(35) +
      'Confidence'.padEnd(12) +
      'Secondary Pump'.padEnd(35) +
      'Confidence'.padEnd(12) +
      'Assessment Date'
    );
    console.log('-'.repeat(150));

    // Pump selection rows
    rows.forEach(row => {
      if (row.primary_pump || row.secondary_pump) {
        const assessmentDate = row.assessment_date ? new Date(row.assessment_date).toISOString().split('T')[0] : 'N/A';
        const primaryPump = row.primary_pump ? `${row.primary_manufacturer} ${row.primary_pump}` : 'None';
        const secondaryPump = row.secondary_pump ? `${row.secondary_manufacturer || ''} ${row.secondary_pump}`.trim() : 'None';

        console.log(
          String(row.id || '').padEnd(10) +
          String(row.email || '').padEnd(30) +
          primaryPump.substring(0, 33).padEnd(35) +
          String(row.primary_confidence ? `${Math.round(row.primary_confidence)}%` : 'N/A').padEnd(12) +
          secondaryPump.substring(0, 33).padEnd(35) +
          String(row.secondary_confidence ? `${Math.round(row.secondary_confidence)}%` : 'N/A').padEnd(12) +
          assessmentDate
        );
      }
    });

    console.log('\n' + '=' .repeat(150));
    console.log('CREDENTIAL DETAILS');
    console.log('=' .repeat(150));
    console.log('\nℹ️  Password hashes are bcrypt hashed and cannot be reversed.');
    console.log('ℹ️  Users can reset their password through the "Forgot Password" feature.\n');

    // Show actual credentials table
    console.log('LOGIN CREDENTIALS TABLE:');
    console.log('-'.repeat(100));
    console.log(
      'Email'.padEnd(35) +
      'Username'.padEnd(20) +
      'Password Status'.padEnd(25) +
      'Account Status'
    );
    console.log('-'.repeat(100));

    rows.forEach(row => {
      const passwordStatus = row.password_hash ? 'Set (bcrypt hashed)' : 'Not Set';
      const accountStatus = row.has_paid ? 'Paid User' : 'Free/Unpaid';

      console.log(
        String(row.email || '').padEnd(35) +
        String(row.username || '').padEnd(20) +
        passwordStatus.padEnd(25) +
        accountStatus
      );
    });

    console.log('\n' + '=' .repeat(100));
    console.log('\n✅ Data retrieval complete!\n');

  } catch (error) {
    console.error('❌ Error retrieving user data:');
    console.error(error.message);

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection issue detected. Possible solutions:');
      console.error('   1. Check if your IP is whitelisted in Azure MySQL firewall');
      console.error('   2. Verify the database server is running');
      console.error('   3. Check network connectivity to Azure');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the script
getUsersData();
