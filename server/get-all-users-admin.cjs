/**
 * Admin Script: Get All PumpDrive Users
 * Run this on the Azure Container App or locally with database access
 */

const mysql = require('mysql2/promise');

// Database configuration - uses Azure production
const dbConfig = {
  host: process.env.DB_HOST || 'tshla-mysql-prod.mysql.database.azure.com',
  user: process.env.DB_USER || 'tshlaadmin',
  password: process.env.DB_PASSWORD || 'TshlaSecure2025!',
  database: process.env.DB_DATABASE || 'tshla_medical',
  ssl: {
    rejectUnauthorized: false
  },
  connectTimeout: 30000
};

async function getAllUsers() {
  let connection;

  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected!\n');

    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.created_at,
        u.has_paid,
        u.payment_amount_cents,
        a.pump_name as primary_pump,
        a.pump_manufacturer as primary_manufacturer,
        a.confidence_score as primary_confidence,
        a.secondary_recommendation as secondary_pump,
        a.secondary_manufacturer,
        a.secondary_confidence
      FROM pump_users u
      LEFT JOIN pump_assessments a ON u.id = a.user_id
      ORDER BY u.created_at DESC
    `;

    const [rows] = await connection.execute(query);

    console.log('='.repeat(150));
    console.log('PUMPDRIVE USERS & PUMP SELECTIONS');
    console.log('='.repeat(150));
    console.log(`\nTotal Users: ${rows.length}\n`);

    // Create formatted table
    console.log(
      'ID'.padEnd(5) +
      'Email'.padEnd(35) +
      'Username'.padEnd(20) +
      'Name'.padEnd(25) +
      'Phone'.padEnd(15) +
      'Paid'.padEnd(6) +
      'Created'
    );
    console.log('-'.repeat(150));

    rows.forEach(row => {
      const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'N/A';
      const created = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : 'N/A';

      console.log(
        String(row.id).padEnd(5) +
        (row.email || 'N/A').padEnd(35) +
        (row.username || 'N/A').padEnd(20) +
        name.padEnd(25) +
        (row.phone_number || 'N/A').padEnd(15) +
        (row.has_paid ? 'YES' : 'NO').padEnd(6) +
        created
      );
    });

    console.log('\n' + '='.repeat(150));
    console.log('PUMP RECOMMENDATIONS');
    console.log('='.repeat(150) + '\n');

    console.log(
      'Email'.padEnd(35) +
      'Primary Pump'.padEnd(45) +
      'Conf.'.padEnd(8) +
      'Secondary Pump'.padEnd(45) +
      'Conf.'
    );
    console.log('-'.repeat(150));

    rows.forEach(row => {
      if (row.primary_pump || row.secondary_pump) {
        const primary = row.primary_pump
          ? `${row.primary_manufacturer || ''} ${row.primary_pump}`.trim()
          : 'None';
        const secondary = row.secondary_pump
          ? `${row.secondary_manufacturer || ''} ${row.secondary_pump}`.trim()
          : 'None';

        console.log(
          (row.email || 'N/A').padEnd(35) +
          primary.substring(0, 43).padEnd(45) +
          (row.primary_confidence ? `${Math.round(row.primary_confidence)}%` : 'N/A').padEnd(8) +
          secondary.substring(0, 43).padEnd(45) +
          (row.secondary_confidence ? `${Math.round(row.secondary_confidence)}%` : 'N/A')
        );
      }
    });

    console.log('\n' + '='.repeat(150));
    console.log('\n📋 PASSWORD NOTE: Passwords are bcrypt hashed and cannot be retrieved.');
    console.log('   Users can reset passwords via the "Forgot Password" feature.\n');

    // Export to CSV format
    console.log('\n' + '='.repeat(150));
    console.log('CSV FORMAT (copy below)');
    console.log('='.repeat(150) + '\n');

    console.log('Email,Username,First Name,Last Name,Phone,Primary Pump,Primary Manufacturer,Primary Confidence,Secondary Pump,Secondary Manufacturer,Secondary Confidence,Has Paid,Created Date');

    rows.forEach(row => {
      const csvRow = [
        row.email || '',
        row.username || '',
        row.first_name || '',
        row.last_name || '',
        row.phone_number || '',
        row.primary_pump || '',
        row.primary_manufacturer || '',
        row.primary_confidence || '',
        row.secondary_pump || '',
        row.secondary_manufacturer || '',
        row.secondary_confidence || '',
        row.has_paid ? 'YES' : 'NO',
        row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : ''
      ].map(val => `"${val}"`).join(',');

      console.log(csvRow);
    });

    console.log('\n✅ Data export complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('Error Code:', error.code);
  } finally {
    if (connection) await connection.end();
  }
}

getAllUsers();
