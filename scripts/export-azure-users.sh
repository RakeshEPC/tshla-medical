#!/bin/bash

# ============================================
# Export Users from Azure MySQL to CSV
# For migration to Supabase
# ============================================

set -e  # Exit on error

echo "🔄 Exporting users from Azure MySQL..."
echo

# Database connection details
DB_HOST="tshla-mysql-prod.mysql.database.azure.com"
DB_USER="tshlaadmin"
DB_PASSWORD="TshlaSecure2025!"
DB_DATABASE="tshla_medical"

# Output directory
OUTPUT_DIR="./migration-data"
mkdir -p "$OUTPUT_DIR"

echo "📁 Output directory: $OUTPUT_DIR"
echo

# Function to export table to CSV
export_table() {
  TABLE_NAME=$1
  OUTPUT_FILE="$OUTPUT_DIR/${TABLE_NAME}_export.csv"

  echo "📊 Exporting $TABLE_NAME..."

  mysql -h "$DB_HOST" \
    -u "$DB_USER" \
    -p"$DB_PASSWORD" \
    -D "$DB_DATABASE" \
    --skip-column-names \
    -e "SELECT * FROM $TABLE_NAME" \
    > "$OUTPUT_FILE" 2>&1

  if [ $? -eq 0 ]; then
    ROWS=$(wc -l < "$OUTPUT_FILE")
    echo "   ✅ Exported $ROWS rows to $OUTPUT_FILE"
  else
    echo "   ❌ Failed to export $TABLE_NAME"
    echo "   Error output:"
    cat "$OUTPUT_FILE"
  fi
  echo
}

# Function to export table with headers
export_table_with_headers() {
  TABLE_NAME=$1
  OUTPUT_FILE="$OUTPUT_DIR/${TABLE_NAME}_with_headers.csv"

  echo "📊 Exporting $TABLE_NAME with headers..."

  mysql -h "$DB_HOST" \
    -u "$DB_USER" \
    -p"$DB_PASSWORD" \
    -D "$DB_DATABASE" \
    -e "SELECT * FROM $TABLE_NAME" \
    > "$OUTPUT_FILE" 2>&1

  if [ $? -eq 0 ]; then
    ROWS=$(wc -l < "$OUTPUT_FILE")
    echo "   ✅ Exported $ROWS rows (including header) to $OUTPUT_FILE"
  else
    echo "   ❌ Failed to export $TABLE_NAME"
  fi
  echo
}

# Export both tables
export_table_with_headers "medical_staff"
export_table_with_headers "pump_users"

# Also export as JSON for easier Supabase import
echo "📦 Creating JSON exports..."

mysql -h "$DB_HOST" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  -D "$DB_DATABASE" \
  -e "SELECT JSON_ARRAYAGG(JSON_OBJECT(
    'id', id,
    'email', email,
    'username', username,
    'first_name', first_name,
    'last_name', last_name,
    'role', role,
    'specialty', specialty,
    'practice', practice,
    'is_active', is_active,
    'created_at', created_at,
    'last_login', last_login
  )) FROM medical_staff" \
  > "$OUTPUT_DIR/medical_staff.json" 2>&1

if [ $? -eq 0 ]; then
  echo "   ✅ medical_staff.json created"
else
  echo "   ❌ Failed to create medical_staff.json"
fi

mysql -h "$DB_HOST" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  -D "$DB_DATABASE" \
  -e "SELECT JSON_ARRAYAGG(JSON_OBJECT(
    'id', id,
    'email', email,
    'username', username,
    'first_name', first_name,
    'last_name', last_name,
    'phone_number', phone_number,
    'is_admin', is_admin,
    'is_active', is_active,
    'current_payment_status', current_payment_status,
    'created_at', created_at,
    'last_login', last_login
  )) FROM pump_users" \
  > "$OUTPUT_DIR/pump_users.json" 2>&1

if [ $? -eq 0 ]; then
  echo "   ✅ pump_users.json created"
else
  echo "   ❌ Failed to create pump_users.json"
fi

echo
echo "✅ Export complete!"
echo
echo "📂 Files created in $OUTPUT_DIR/:"
ls -lh "$OUTPUT_DIR"
echo
echo "⚠️  IMPORTANT: These files contain user data. Keep them secure!"
echo "    Delete them after successful migration to Supabase."
echo

# Create summary
echo "📊 Summary:"
echo "   medical_staff: $(grep -c ^ "$OUTPUT_DIR/medical_staff_with_headers.csv" || echo 0) rows"
echo "   pump_users: $(grep -c ^ "$OUTPUT_DIR/pump_users_with_headers.csv" || echo 0) rows"
echo

echo "🎯 Next steps:"
echo "   1. Review the exported data in $OUTPUT_DIR/"
echo "   2. Create corresponding users in Supabase Auth"
echo "   3. Use the JSON files to bulk import to Supabase tables"
echo "   4. See SUPABASE_MIGRATION_GUIDE.md for detailed instructions"
