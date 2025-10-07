# Enhanced Schedule Notes API - Supabase Migration TODO

**File**: `server/enhanced-schedule-notes-api.js`
**Status**: ⚠️ Partially Migrated
**Date**: October 7, 2025

## ✅ Completed

1. Replaced `mysql2/promise` import with `unified-supabase.service`
2. Updated `initializeDatabase()` function to use Supabase
3. Migrated `/api/health` endpoint to use Supabase health check
4. Removed MySQL connection pool configuration

## ⚠️ Remaining Work

This file has **1221 lines** with approximately **159+ SQL queries** that need conversion from MySQL to Supabase.

### Pattern to Replace

**OLD (MySQL):**
```javascript
const [rows] = await pool.execute(query, params);
```

**NEW (Supabase):**
```javascript
// Option 1: Simple queries
const { data, error } = await unifiedSupabase
  .from('table_name')
  .select('*')
  .eq('column', value);
if (error) throw error;

// Option 2: Complex queries - use helper methods
const result = await unifiedSupabase.query('table_name', {
  select: '*',
  where: { column: value },
  orderBy: 'column',
  limit: 10
});
```

### Endpoints That Need Migration

All endpoints in this file use `pool.execute()` and need to be converted:

#### Schedule Endpoints
- `GET /api/providers/:providerId/schedule` - Fetch provider schedule
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment
- `GET /api/appointments/:id` - Get single appointment
- `GET /api/schedule/conflicts` - Check scheduling conflicts
- `POST /api/schedule/availability` - Check provider availability

#### Notes Endpoints
- `GET /api/providers/:providerId/notes` - Fetch provider notes
- `POST /api/notes` - Create dictated note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `GET /api/notes/:id` - Get single note
- `POST /api/notes/:id/attach` - Attach note to appointment

#### Provider Endpoints
- `GET /api/providers` - List all providers
- `GET /api/providers/:id` - Get provider details
- `POST /api/providers/:id/preferences` - Update provider preferences
- `GET /api/providers/:id/stats` - Provider statistics

#### Patient Endpoints
- `GET /api/patients/search` - Search patients
- `GET /api/patients/:id/history` - Patient appointment history
- `GET /api/patients/:id/notes` - Patient notes history

#### Analytics Endpoints
- `GET /api/analytics/appointments` - Appointment analytics
- `GET /api/analytics/providers` - Provider performance
- `GET /api/analytics/utilization` - Schedule utilization

### Migration Strategy

1. **Test Coverage**: Add tests for each endpoint before migration
2. **Incremental**: Migrate 5-10 endpoints at a time
3. **Validation**: Test each batch thoroughly before proceeding
4. **Rollback Plan**: Keep MySQL queries commented for quick rollback

### SQL to Supabase Conversion Guide

**SELECT Queries:**
```javascript
// MySQL
const [rows] = await pool.execute(
  'SELECT * FROM table WHERE column = ?',
  [value]
);

// Supabase
const { data: rows, error } = await unifiedSupabase
  .from('table')
  .select('*')
  .eq('column', value);
if (error) throw error;
```

**INSERT Queries:**
```javascript
// MySQL
const [result] = await pool.execute(
  'INSERT INTO table (col1, col2) VALUES (?, ?)',
  [val1, val2]
);
const insertId = result.insertId;

// Supabase
const { data, error } = await unifiedSupabase
  .from('table')
  .insert({ col1: val1, col2: val2 })
  .select()
  .single();
if (error) throw error;
const insertId = data.id;
```

**UPDATE Queries:**
```javascript
// MySQL
await pool.execute(
  'UPDATE table SET col1 = ? WHERE id = ?',
  [value, id]
);

// Supabase
const { error } = await unifiedSupabase
  .from('table')
  .update({ col1: value })
  .eq('id', id);
if (error) throw error;
```

**DELETE Queries:**
```javascript
// MySQL
await pool.execute('DELETE FROM table WHERE id = ?', [id]);

// Supabase
const { error } = await unifiedSupabase
  .from('table')
  .delete()
  .eq('id', id);
if (error) throw error;
```

**Complex Queries with JOINs:**
For complex queries with JOINs, use Supabase's foreign key relationships:
```javascript
const { data, error } = await unifiedSupabase
  .from('appointments')
  .select(`
    *,
    patients (
      first_name,
      last_name,
      phone_number
    ),
    providers (
      name,
      specialty
    )
  `)
  .eq('status', 'scheduled');
```

## Next Steps

1. Review each endpoint's SQL queries
2. Convert to Supabase query builder syntax
3. Test thoroughly
4. Update fallback storage logic if needed
5. Remove old MySQL code once validated

## Estimated Time

- **High Priority Endpoints** (Schedule, Appointments): 3-4 hours
- **Medium Priority** (Notes, Providers): 2-3 hours
- **Low Priority** (Analytics, Search): 2 hours
- **Testing & Validation**: 2 hours

**Total**: ~10 hours of focused work

## Notes

- The file currently falls back to in-memory storage if database fails
- Consider keeping this fallback for development
- All timestamps should use ISO format for PostgreSQL compatibility
- UUIDs are used as primary keys in Supabase (not auto-increment integers)
