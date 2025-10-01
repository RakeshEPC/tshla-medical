#!/usr/bin/env node

/**
 * Database migration runner
 * Run with: npx ts-node src/lib/db/migrate.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from './config';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

async function runMigration() {
  logDebug('App', 'Debug message', {});
  
  const pool = getPool();
  
  try {
    // Read the schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements (basic approach)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    logDebug('App', 'Debug message', {});
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await pool.query(statement);
        logDebug('App', 'Debug message', {});
      } catch (error: any) {
        // Skip if table/extension already exists
        if (error.code === '42P07' || error.code === '42710') {
          logDebug('App', 'Debug message', {});
        } else {
          logError('App', 'Error message', {});
          logError('App', 'Error message', {}); + '...');
          throw error;
        }
      }
    }
    
    logDebug('App', 'Debug message', {});
    
  } catch (error) {
    logError('App', 'Error message', {});
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

export { runMigration };