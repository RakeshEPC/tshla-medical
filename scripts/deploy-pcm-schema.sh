#!/bin/bash

# ============================================
# PCM Database Schema Deployment Script
# ============================================
# This script deploys the PCM database schema to Supabase
# It uses the Supabase REST API to execute SQL migrations

set -e  # Exit on error

echo "🚀 PCM Database Schema Deployment"
echo "=================================="
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Check for required environment variables
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ Error: VITE_SUPABASE_URL not set"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set"
  exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $VITE_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
echo "📦 Supabase Project: $PROJECT_REF"
echo ""

# Check if SQL migration file exists
MIGRATION_FILE="src/lib/db/migrations/004_pcm_tables.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Found migration file: $MIGRATION_FILE"
echo "📊 Size: $(wc -l < $MIGRATION_FILE) lines"
echo ""

# Read SQL file
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Deploy using psql (more reliable than REST API for large SQL)
echo "🔧 Deploying schema using psql..."
echo ""

# Use psql to execute the migration
PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
  "postgresql://postgres.${PROJECT_REF}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -f "$MIGRATION_FILE" \
  -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Database schema deployed successfully!"
  echo ""
  echo "📋 Verifying tables created..."

  # Verify tables exist
  PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
    "postgresql://postgres.${PROJECT_REF}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
    -c "\dt pcm_*" \
    -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'pcm_%';"

  echo ""
  echo "🎉 PCM Database Deployment Complete!"
  echo ""
  echo "Next Steps:"
  echo "1. Run data migration: npm run migrate:pcm-data"
  echo "2. Update App.tsx to add /staff-dashboard route"
  echo "3. Test the new dashboard at /staff-dashboard"
else
  echo ""
  echo "❌ Database schema deployment failed!"
  exit 1
fi
