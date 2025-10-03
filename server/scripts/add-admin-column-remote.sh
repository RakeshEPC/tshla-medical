#!/bin/bash

# Add is_admin column to pump_users table via container execution
# This runs inside the container which has database access

CONTAINER_NAME="tshla-pump-api-container"
RESOURCE_GROUP="tshla-backend-rg"

echo "Adding is_admin column to pump_users table..."

az containerapp exec \
  --name $CONTAINER_NAME \
  --resource-group $RESOURCE_GROUP \
  --command "node -e \"
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check if column exists
    const [cols] = await conn.execute(\\\`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pump_users' AND COLUMN_NAME = 'is_admin'
    \\\`, [process.env.DB_DATABASE]);

    if (cols.length === 0) {
      await conn.execute(\\\`ALTER TABLE pump_users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE\\\`);
      console.log('Added is_admin column');
    } else {
      console.log('Column already exists');
    }

    // Set admin for specific users
    const [result] = await conn.execute(\\\`
      UPDATE pump_users SET is_admin = TRUE WHERE email IN ('rakesh@tshla.ai', 'admin@tshla.ai')
    \\\`);
    console.log(\\\`Updated \\\${result.affectedRows} admin users\\\`);

    // Show admins
    const [admins] = await conn.execute(\\\`SELECT email, is_admin FROM pump_users WHERE is_admin = TRUE\\\`);
    console.log('Admin users:', JSON.stringify(admins));
  } finally {
    await conn.end();
    process.exit(0);
  }
})();
\""
