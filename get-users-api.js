/**
 * Script to retrieve all PumpDrive users via Azure Container App API
 * This connects through the already-running pump API
 */

import fetch from 'node-fetch';

const API_BASE = 'https://tshla-pump-api-container.redpebble-e4551b7a.eastus.azurecontainerapps.io';

async function getUsersViaAPI() {
  try {
    console.log('Fetching users data from Pump API...\n');

    // First, let's check the health endpoint
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const health = await healthRes.json();
    console.log('✅ API Status:', health.status);
    console.log('✅ Database:', health.services?.database?.status || 'unknown');
    console.log('');

    // Try to get users data - we need to check available endpoints
    console.log('Note: This API may not have a public users list endpoint for security.');
    console.log('Attempting to query through Azure Portal instead...\n');

    // Alternative: Show SQL queries to run manually
    console.log('=' .repeat(100));
    console.log('MANUAL QUERY INSTRUCTIONS');
    console.log('=' .repeat(100));
    console.log('\n📋 To get users data, run these SQL queries in Azure Portal:\n');

    console.log('1️⃣  Go to: https://portal.azure.com');
    console.log('2️⃣  Navigate to: tshla-mysql-prod → Query editor (preview)');
    console.log('3️⃣  Login credentials:');
    console.log('    • Server: tshla-mysql-prod.mysql.database.azure.com');
    console.log('    • Username: tshlaadmin');
    console.log('    • Password: TshlaSecure2025!');
    console.log('    • Database: tshla_medical\n');

    console.log('4️⃣  Run this SQL query:\n');

    const userQuery = `
-- Get all users with their pump selections
SELECT
  u.id,
  u.username,
  u.email,
  u.first_name,
  u.last_name,
  u.phone_number,
  SUBSTRING(u.password_hash, 1, 20) as password_sample,
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
ORDER BY u.created_at DESC;
`;

    console.log(userQuery);

    console.log('\n5️⃣  For CSV export, you can also run:\n');

    const csvQuery = `
-- Export as CSV-friendly format
SELECT
  CONCAT(u.email, ',',
         u.username, ',',
         COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''), ',',
         COALESCE(u.phone_number, ''), ',',
         COALESCE(a.pump_manufacturer, ''), ' ', COALESCE(a.pump_name, ''), ',',
         COALESCE(CAST(a.confidence_score AS CHAR), ''), ',',
         COALESCE(a.secondary_manufacturer, ''), ' ', COALESCE(a.secondary_recommendation, ''), ',',
         COALESCE(CAST(a.secondary_confidence AS CHAR), ''), ',',
         IF(u.has_paid, 'YES', 'NO'), ',',
         DATE_FORMAT(u.created_at, '%Y-%m-%d')
        ) as csv_row
FROM pump_users u
LEFT JOIN pump_assessments a ON u.id = a.user_id
ORDER BY u.created_at DESC;
`;

    console.log(csvQuery);

    console.log('\n' + '=' .repeat(100));
    console.log('ALTERNATIVE: Use Azure CLI');
    console.log('=' .repeat(100));
    console.log('\nIf you have Azure CLI installed, run:\n');

    const azCliCommand = `az mysql flexible-server execute \\
  --name tshla-mysql-prod \\
  --admin-user tshlaadmin \\
  --admin-password "TshlaSecure2025!" \\
  --database-name tshla_medical \\
  --querytext "SELECT u.id, u.username, u.email, u.first_name, u.last_name, a.pump_name as primary_pump, a.secondary_recommendation as secondary_pump FROM pump_users u LEFT JOIN pump_assessments a ON u.id = a.user_id ORDER BY u.created_at DESC;"`;

    console.log(azCliCommand);

    console.log('\n' + '=' .repeat(100));
    console.log('SECURITY NOTE');
    console.log('=' .repeat(100));
    console.log('\n⚠️  Password hashes are bcrypt encrypted and CANNOT be reversed.');
    console.log('⚠️  To see actual passwords, users must reset them via "Forgot Password"');
    console.log('⚠️  For admin access, you can create a new admin user with known credentials.\n');

    console.log('✅ Instructions complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getUsersViaAPI();
