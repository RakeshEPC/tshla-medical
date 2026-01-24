#!/bin/bash

# Patient Portal Database Migrations - Direct PostgreSQL Execution
# Created: 2026-01-23

# Supabase connection details
PROJECT_REF="minvvjdflezibmgkplqb"
SUPABASE_PASSWORD="${SUPABASE_DB_PASSWORD}"

if [ -z "$SUPABASE_PASSWORD" ]; then
  echo "❌ SUPABASE_DB_PASSWORD environment variable not set"
  echo "   Please set it to your Supabase database password"
  exit 1
fi

# Connection string
CONNECTION_STRING="postgresql://postgres.${PROJECT_REF}:${SUPABASE_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

echo "═══════════════════════════════════════════════════════════"
echo "🗄️  Patient Portal Database Migrations"
echo "═══════════════════════════════════════════════════════════"
echo "📍 Database: ${PROJECT_REF}"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "❌ psql command not found"
  echo "   Please install PostgreSQL client:"
  echo "   brew install postgresql"
  exit 1
fi

# Migration files
MIGRATIONS=(
  "add-comprehensive-hp.sql"
  "add-patient-portal-analytics.sql"
  "add-ai-chat-conversations.sql"
)

# Run each migration
for migration in "${MIGRATIONS[@]}"; do
  echo "🔄 Running migration: $migration"
  
  psql "$CONNECTION_STRING" -f "database/migrations/$migration"
  
  if [ $? -eq 0 ]; then
    echo "✅ Migration completed: $migration"
  else
    echo "❌ Migration failed: $migration"
    exit 1
  fi
  echo ""
done

echo "═══════════════════════════════════════════════════════════"
echo "✨ All migrations completed successfully!"
echo "═══════════════════════════════════════════════════════════"
echo "📋 Next Steps:"
echo "   1. ✅ Database migrations (complete)"
echo "   2. Configure Azure environment variables"
echo "   3. Create Supabase storage buckets"
echo "   4. Run: node scripts/seed-patient-portal-data.js"
echo "═══════════════════════════════════════════════════════════"
