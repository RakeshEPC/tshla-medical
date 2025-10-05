/**
 * Check what tables exist in Azure MySQL Production database
 * Run with: node scripts/check-azure-tables.js
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

async function checkTables() {
  let connection;

  try {
    console.log('🔌 Connecting to Azure MySQL Production...');
    console.log(`   Host: ${azureConfig.host}`);
    console.log(`   Database: ${azureConfig.database}`);

    connection = await mysql.createConnection(azureConfig);
    console.log('✅ Connected successfully!\n');

    // Get list of all tables
    console.log('📋 Tables in database:');
    const [tables] = await connection.query('SHOW TABLES');

    if (tables.length === 0) {
      console.log('   ⚠️  No tables found in database');
    } else {
      tables.forEach((row, index) => {
        const tableName = Object.values(row)[0];
        console.log(`   ${index + 1}. ${tableName}`);
      });
    }

    console.log(`\n📊 Total tables: ${tables.length}`);

    // Check for critical tables
    console.log('\n🔍 Checking for critical tables:');
    const criticalTables = [
      'access_logs',
      'pump_users',
      'pump_assessments',
      'pump_comparison_data',
      'pump_manufacturers'
    ];

    for (const tableName of criticalTables) {
      const [result] = await connection.query(`SHOW TABLES LIKE '${tableName}'`);
      if (result.length > 0) {
        console.log(`   ✅ ${tableName} - EXISTS`);
      } else {
        console.log(`   ❌ ${tableName} - MISSING`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connection closed');
    }
  }
}

checkTables();
