#!/usr/bin/env node

/**
 * TSHLA Medical - Production Database Validator
 *
 * Verifies critical data exists in production database:
 * - Admin user (admin@tshla.ai)
 * - 23 dimensions in pump_comparison_data
 * - 6 manufacturers in pump_manufacturers
 * - Table structures are correct
 *
 * This would have caught Failure #1, #2, and #5 from DEPLOYMENT_FAILURES.md
 */

const mysql = require('mysql2/promise');

// Production database credentials
const DB_CONFIG = {
  host: 'tshla-mysql-prod.mysql.database.azure.com',
  port: 3306,
  user: 'tshlaadmin',
  password: 'TshlaSecure2025!',
  database: 'tshla_medical',
  ssl: { rejectUnauthorized: false }
};

const EXPECTED_DIMENSIONS = 23;
const EXPECTED_MANUFACTURERS = 6;

async function validateDatabase() {
  console.log('🔍 Validating Production Database...\n');

  let connection;
  let failed = 0;

  try {
    // Connect to database
    console.log('Connecting to production database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin User Validation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check admin user exists
    const [adminRows] = await connection.query(
      'SELECT id, email, username, role FROM medical_staff WHERE email = ?',
      ['admin@tshla.ai']
    );

    if (adminRows.length === 0) {
      console.log('❌ Admin user (admin@tshla.ai) NOT FOUND');
      console.log('   Login will fail with "Invalid email or password"');
      console.log('   Run: node server/scripts/create-admin-user.js');
      failed++;
    } else {
      const admin = adminRows[0];
      console.log('✅ Admin user exists');
      console.log(`   └─ ID: ${admin.id}`);
      console.log(`   └─ Email: ${admin.email}`);
      console.log(`   └─ Username: ${admin.username}`);
      console.log(`   └─ Role: ${admin.role}`);
    }
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pump Comparison Data Validation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check pump_comparison_data table exists
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'pump_comparison_data'"
    );

    if (tables.length === 0) {
      console.log('❌ Table pump_comparison_data NOT FOUND');
      console.log('   Run: node server/scripts/create-pump-comparison-tables.sql');
      failed++;
    } else {
      console.log('✅ Table pump_comparison_data exists');

      // Count dimensions
      const [dimensionRows] = await connection.query(
        'SELECT COUNT(*) as count FROM pump_comparison_data'
      );
      const dimensionCount = dimensionRows[0].count;

      if (dimensionCount === EXPECTED_DIMENSIONS) {
        console.log(`✅ Found ${dimensionCount} dimensions (expected ${EXPECTED_DIMENSIONS})`);
      } else {
        console.log(`❌ Found ${dimensionCount} dimensions (expected ${EXPECTED_DIMENSIONS})`);
        console.log('   Run: node server/scripts/import-pump-comparison-data.js');
        failed++;
      }

      // Show first 5 dimensions as sample
      const [sampleDimensions] = await connection.query(
        'SELECT dimension_name, category FROM pump_comparison_data LIMIT 5'
      );
      console.log('   Sample dimensions:');
      sampleDimensions.forEach(dim => {
        console.log(`   └─ ${dim.dimension_name} (${dim.category})`);
      });
    }
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pump Manufacturers Validation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check pump_manufacturers table exists
    const [mfgTables] = await connection.query(
      "SHOW TABLES LIKE 'pump_manufacturers'"
    );

    if (mfgTables.length === 0) {
      console.log('❌ Table pump_manufacturers NOT FOUND');
      console.log('   Run: node server/scripts/create-pump-comparison-tables.sql');
      failed++;
    } else {
      console.log('✅ Table pump_manufacturers exists');

      // Count manufacturers
      const [mfgRows] = await connection.query(
        'SELECT COUNT(*) as count FROM pump_manufacturers'
      );
      const mfgCount = mfgRows[0].count;

      if (mfgCount === EXPECTED_MANUFACTURERS) {
        console.log(`✅ Found ${mfgCount} manufacturers (expected ${EXPECTED_MANUFACTURERS})`);
      } else {
        console.log(`❌ Found ${mfgCount} manufacturers (expected ${EXPECTED_MANUFACTURERS})`);
        console.log('   Run: node server/scripts/import-pump-comparison-data.js');
        failed++;
      }

      // List all manufacturers
      const [manufacturers] = await connection.query(
        'SELECT name, code FROM pump_manufacturers ORDER BY name'
      );
      console.log('   Manufacturers:');
      manufacturers.forEach(mfg => {
        console.log(`   └─ ${mfg.name} (${mfg.code})`);
      });
    }
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Database Structure Validation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check medical_staff table has required columns
    const [staffColumns] = await connection.query(
      "SHOW COLUMNS FROM medical_staff LIKE 'password_hash'"
    );

    if (staffColumns.length === 0) {
      console.log('❌ Column medical_staff.password_hash NOT FOUND');
      console.log('   Password authentication will fail');
      failed++;
    } else {
      console.log('✅ medical_staff.password_hash exists');
    }

    // Check pump_comparison_data has required columns
    const [pumpColumns] = await connection.query(
      `SHOW COLUMNS FROM pump_comparison_data WHERE Field IN ('dimension_name', 'category', 'medtronic_670g')`
    );

    if (pumpColumns.length === 3) {
      console.log('✅ pump_comparison_data has required columns');
    } else {
      console.log('❌ pump_comparison_data missing required columns');
      console.log('   Expected: dimension_name, category, medtronic_670g');
      failed++;
    }

    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Final result
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (failed === 0) {
      console.log('✅ All database validation checks passed!\n');
      console.log('Production database is properly configured.\n');
      process.exit(0);
    } else {
      console.log(`❌ ${failed} validation check(s) failed!\n`);
      console.log('DO NOT mark deployment as successful.');
      console.log('Fix the database issues above and re-run this script.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Database validation failed with error:');
    console.error(error.message);
    console.error('\nCheck database credentials and connectivity.');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run validation
validateDatabase();
