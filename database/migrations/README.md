# Analytics Database Migration Guide

This guide explains how to apply the analytics schema migration to your Supabase database.

## Overview

The `analytics_schema.sql` file contains the complete database schema for the analytics system, including:
- Template performance tracking
- Prompt version control with A/B testing
- Note quality ratings and feedback
- Model performance comparisons
- Token usage and cost tracking

## Prerequisites

- Access to your Supabase project dashboard
- Admin or database permissions

## Migration Steps

### Option 1: Using Supabase Dashboard (Recommended)

1. **Navigate to SQL Editor**
   - Go to your Supabase project: https://minvvjdflezibmgkplqb.supabase.co
   - Click on "SQL Editor" in the left sidebar

2. **Create New Query**
   - Click "New query" button
   - Name it: "Analytics Schema Migration"

3. **Copy and Paste SQL**
   - Open `analytics_schema.sql` file
   - Copy the entire contents (all 500+ lines)
   - Paste into the SQL Editor

4. **Execute Migration**
   - Review the SQL to ensure it's correct
   - Click "Run" or press Ctrl+Enter (Cmd+Enter on Mac)
   - Wait for execution to complete

5. **Verify Success**
   - Check for "Success" message
   - No error messages should appear
   - You should see confirmation of tables, indexes, and views created

### Option 2: Using psql Command Line

If you have psql installed and database credentials:

```bash
# Set your database password as environment variable
export PGPASSWORD="your_db_password_here"

# Run the migration
psql "postgresql://postgres.minvvjdflezibmgkplqb.supabase.co:5432/postgres?sslmode=require" \
  -f database/migrations/analytics_schema.sql
```

## Verification

After running the migration, verify the following tables exist:

### Core Tables
- `template_analytics` - Template performance metrics
- `prompt_versions` - Version control for prompts
- `note_quality_ratings` - User feedback on notes
- `model_performance` - Model comparison data
- `token_usage_log` - Token tracking
- `prompt_usage_log` - Prompt usage tracking

### Views
- `template_performance_summary` - Aggregated template stats
- `model_comparison` - Model performance comparison
- `daily_quality_trend` - Quality over time

You can verify with this query in SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'template_analytics',
    'prompt_versions',
    'note_quality_ratings',
    'model_performance',
    'token_usage_log',
    'prompt_usage_log'
  )
ORDER BY table_name;
```

Expected result: All 6 tables should be listed.

## Troubleshooting

### Error: "relation already exists"
- This means the table was already created
- Safe to ignore if you're re-running the migration
- The schema includes `IF NOT EXISTS` clauses to handle this

### Error: "permission denied"
- Ensure you're logged in with admin/owner permissions
- Contact your Supabase project admin

### Error: "syntax error"
- Ensure you copied the entire SQL file
- Check for any clipboard truncation
- Try copying in smaller chunks if needed

## Rollback (if needed)

If you need to remove the analytics schema:

```sql
-- WARNING: This will delete all analytics data!

DROP TABLE IF EXISTS prompt_usage_log CASCADE;
DROP TABLE IF EXISTS token_usage_log CASCADE;
DROP TABLE IF EXISTS note_quality_ratings CASCADE;
DROP TABLE IF EXISTS model_performance CASCADE;
DROP TABLE IF EXISTS prompt_versions CASCADE;
DROP TABLE IF EXISTS template_analytics CASCADE;

DROP VIEW IF EXISTS template_performance_summary;
DROP VIEW IF EXISTS model_comparison;
DROP VIEW IF EXISTS daily_quality_trend;

DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS aggregate_template_analytics CASCADE;
```

## Next Steps

After successful migration:

1. **Test the Integration**
   - Generate a note in QuickNote
   - Rate the note quality
   - Check that the rating appears in `/analytics` dashboard

2. **Verify Data Flow**
   - Open browser dev tools console
   - Look for log messages: "Quality rating saved to database"
   - Check Supabase dashboard table editor for `note_quality_ratings` entries

3. **Monitor Performance**
   - The analytics system collects data automatically
   - Visit `/analytics` page after 7-30 days for meaningful insights
   - Export data to CSV for external analysis if needed

## Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Review browser console for JavaScript errors
3. Verify environment variables are set correctly
4. Ensure network connectivity to Supabase

## Schema Version

- **Version**: 1.0.0
- **Created**: 2025-01-XX (based on deployment date)
- **Compatible with**: TSHLA Medical v2.0+
