#!/bin/bash

# =====================================================
# Run DTSQs Migration (005) on Supabase
# =====================================================

set -e  # Exit on error

echo "🔧 Running DTSQs Migration 005..."
echo ""

# Supabase connection details (from .env)
SUPABASE_URL="https://minvvjdflezibmgkplqb.supabase.co"
SUPABASE_PROJECT_REF="minvvjdflezibmgkplqb"
SUPABASE_DB_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
SUPABASE_DB_PORT="5432"
SUPABASE_DB_NAME="postgres"
SUPABASE_DB_USER="postgres"

echo "📋 Migration: Add DTSQs questionnaire fields"
echo "📂 File: src/lib/db/migrations/005_add_dtsqs_questionnaire.sql"
echo ""

# Check if migration file exists
if [ ! -f "src/lib/db/migrations/005_add_dtsqs_questionnaire.sql" ]; then
    echo "❌ Error: Migration file not found!"
    echo "   Expected: src/lib/db/migrations/005_add_dtsqs_questionnaire.sql"
    exit 1
fi

echo "⚠️  You will need your Supabase database password."
echo "   To find it:"
echo "   1. Go to https://supabase.com/dashboard"
echo "   2. Select project: ${SUPABASE_PROJECT_REF}"
echo "   3. Settings → Database → Database Password"
echo ""
echo "🔐 Connecting to Supabase PostgreSQL..."
echo ""

# Run migration via psql
PGPASSWORD="" psql \
  "postgresql://${SUPABASE_DB_USER}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}?sslmode=require" \
  -f src/lib/db/migrations/005_add_dtsqs_questionnaire.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 What was added:"
    echo "   - patients.dtsqs_completed (BOOLEAN)"
    echo "   - patients.dtsqs_completed_at (TIMESTAMPTZ)"
    echo "   - patients.dtsqs_responses (JSONB)"
    echo "   - pump_assessments.dtsqs_baseline (JSONB)"
    echo "   - Validation triggers and helper functions"
    echo "   - RLS policies for patient access"
    echo ""
    echo "🚀 You're ready to test the DTSQs questionnaire!"
else
    echo ""
    echo "❌ Migration failed. Check the error messages above."
    exit 1
fi
