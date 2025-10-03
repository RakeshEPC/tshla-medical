/**
 * Add is_admin column to pump_users table
 * Only specific users should have admin access
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function addAdminColumn() {
  const config = {
    host: process.env.DB_HOST || 'tshla-mysql-prod.mysql.database.azure.com',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'tshlaadmin',
    password: process.env.DB_PASSWORD || 'TshlaSecure2025!',
    database: process.env.DB_DATABASE || 'tshla_medical',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };

  console.log(`Connecting to ${config.host}:${config.port}/${config.database}...`);

  const connection = await mysql.createConnection(config);

  try {
    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'pump_users'
      AND COLUMN_NAME = 'is_admin'
    `, [config.database]);

    if (columns.length > 0) {
      console.log('✓ Column is_admin already exists in pump_users table');
    } else {
      // Add is_admin column
      await connection.execute(`
        ALTER TABLE pump_users
        ADD COLUMN is_admin BOOLEAN DEFAULT FALSE AFTER is_research_participant
      `);
      console.log('✓ Added is_admin column to pump_users table');
    }

    // Set admin flag for specific user
    const [result] = await connection.execute(`
      UPDATE pump_users
      SET is_admin = TRUE
      WHERE email IN ('rakesh@tshla.ai', 'admin@tshla.ai')
    `);
    console.log(`✓ Updated ${result.affectedRows} user(s) with admin privileges`);

    // Show admin users
    const [admins] = await connection.execute(`
      SELECT id, email, username, is_admin
      FROM pump_users
      WHERE is_admin = TRUE
    `);
    console.log('\nAdmin users:');
    console.table(admins);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addAdminColumn().then(() => {
  console.log('\n✅ Admin column setup complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
