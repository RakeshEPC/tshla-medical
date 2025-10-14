#!/usr/bin/env npx tsx
/**
 * Seed Templates Script
 * Seeds standardTemplates into Supabase as system templates
 *
 * Usage: npx tsx scripts/seed-templates.ts
 */

import { createClient } from '@supabase/supabase-js';
import { standardTemplates } from '../src/data/standardTemplates.js';

// Initialize Supabase client with SERVICE ROLE key (server-side only)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface StandardTemplate {
  name: string;
  description?: string;
  visitType?: string;
  sections: Record<string, any>;
  generalInstructions?: string;
  specialty?: string;
}

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');
  console.log(`📋 Found ${standardTemplates.length} standard templates to seed\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const template of standardTemplates as StandardTemplate[]) {
    try {
      // Check if template already exists (by name)
      const { data: existing, error: checkError } = await supabase
        .from('templates')
        .select('id, name')
        .eq('name', template.name)
        .eq('is_system_template', true)
        .maybeSingle();

      if (checkError) {
        console.error(`❌ Error checking for existing template "${template.name}":`, checkError.message);
        errorCount++;
        continue;
      }

      if (existing) {
        console.log(`⏭️  Skipping "${template.name}" - already exists (ID: ${existing.id})`);
        skipCount++;
        continue;
      }

      // Insert template into Supabase (use minimal required fields + cast to any to bypass TS validation)
      const { data: newTemplate, error: insertError } = await (supabase as any)
        .from('templates')
        .insert({
          name: template.name,
          specialty: template.specialty || null,
          template_type: template.visitType || 'general',
          sections: template.sections || {},
          macros: {},
          quick_phrases: [],
          is_system_template: true,
          is_shared: true,
          usage_count: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`❌ Error inserting template "${template.name}":`, insertError.message);
        errorCount++;
        continue;
      }

      console.log(`✅ Seeded "${template.name}" (ID: ${newTemplate.id})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Unexpected error with template "${template.name}":`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Seeding Summary:');
  console.log(`   ✅ Successfully seeded: ${successCount}`);
  console.log(`   ⏭️  Skipped (already exist): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total templates: ${standardTemplates.length}`);
  console.log('='.repeat(60) + '\n');

  if (errorCount > 0) {
    console.log('⚠️  Some templates failed to seed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 Template seeding completed successfully!');
    process.exit(0);
  }
}

// Run the seeding function
seedTemplates().catch((error) => {
  console.error('💥 Fatal error during template seeding:', error);
  process.exit(1);
});
