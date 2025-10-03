#!/usr/bin/env node
/**
 * Database Setup Script
 * Creates pump_users and related tables in Azure MySQL
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'tshla-mysql-prod.mysql.database.azure.com',
  user: 'tshlaadmin',
  password: 'TshlaSecure2025!',
  database: 'tshla_medical',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000,
};

async function setupDatabase() {
  let connection;

  try {
    console.log('🔌 Connecting to Azure MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully!\n');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'create-pump-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt) {
        try {
          await connection.execute(stmt);
          console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERR') {
            console.log(`⚠ Statement ${i + 1}: Table already exists (skipping)`);
          } else {
            console.error(`✗ Statement ${i + 1} failed:`, error.message);
          }
        }
      }
    }

    console.log('\n✅ Database setup completed!');
    console.log('\nTables created:');
    console.log('  - pump_users');
    console.log('  - research_participants');
    console.log('  - pump_reports');
    console.log('  - pump_assessments');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n👋 Connection closed');
    }
  }
}

// Run setup
setupDatabase();
