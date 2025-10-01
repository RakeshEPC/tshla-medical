/**
 * Database Migration Runner
 * Run this to set up the appointments table
 */

import { getDb } from './client';
import fs from 'fs';
import path from 'path';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

export async function runMigrations() {
  const db = getDb();
  
  try {
    logDebug('App', 'Debug message', {});
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_appointments_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL statements by semicolon and execute each
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await db.execute(statement + ';');
        logInfo('App', 'Info message', {}); + '...');
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message?.includes('already exists')) {
          logError('App', 'Error message', {});
        }
      }
    }
    
    logInfo('App', 'Info message', {});
    
    // Verify the table was created
    const tables = await db.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`
    );
    
    if (tables.length > 0) {
      logInfo('App', 'Info message', {});
      
      // Get table info
      const columns = await db.query('PRAGMA table_info(appointments)');
      logDebug('App', 'Debug message', {}); => c.name).join(', '));
    } else {
      logError('App', 'Error message', {});
    }
    
  } catch (error) {
    logError('App', 'Error message', {});
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logDebug('App', 'Debug message', {});
      process.exit(0);
    })
    .catch(err => {
      logError('App', 'Error message', {});
      process.exit(1);
    });
}