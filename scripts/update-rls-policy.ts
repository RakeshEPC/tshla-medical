#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateRLSPolicy() {
  console.log('🔐 Updating RLS policies to allow admin inserts...\n');

  try {
    // Drop existing INSERT policy if it exists
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Allow authenticated admins to insert" ON medical_staff;
      `
    });

    // Create new INSERT policy that allows authenticated admins
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Allow authenticated admins to insert"
        ON medical_staff
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM medical_staff ms
            WHERE ms.auth_user_id = auth.uid()
            AND (ms.role = 'admin' OR ms.role = 'super_admin')
          )
        );
      `
    });

    console.log('✅ RLS policy updated successfully!');
    console.log('   Authenticated admins can now insert medical_staff records.\n');
  } catch (error: any) {
    console.error('❌ Failed to update policy:', error.message);
    console.log('\n💡 Alternative: Use the admin-account-api.js backend instead.');
    console.log('   Start it with: PORT=3004 node server/admin-account-api.js\n');
  }
}

updateRLSPolicy();
