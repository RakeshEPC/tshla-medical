#!/bin/bash

# Run this in Azure Cloud Shell (https://shell.azure.com)
# This will execute the database migration to add is_admin column

echo "=== TSHLA Medical - Database Migration ==="
echo "Adding is_admin column to pump_users table..."
echo ""

# Install MySQL client if not available
if ! command -v mysql &> /dev/null; then
    echo "Installing MySQL client..."
    sudo apt-get update && sudo apt-get install -y mysql-client
fi

# Run the migration
mysql -h tshla-mysql-prod.mysql.database.azure.com \
      -P 3306 \
      -u tshlaadmin \
      -p'TshlaSecure2025!' \
      -D tshla_medical \
      -e "
ALTER TABLE pump_users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
AFTER is_research_participant;

UPDATE pump_users
SET is_admin = TRUE
WHERE email IN ('rakesh@tshla.ai', 'admin@tshla.ai');

SELECT id, email, username, is_admin, created_at
FROM pump_users
WHERE is_admin = TRUE;
"

echo ""
echo "✅ Migration complete!"
