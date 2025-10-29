/**
 * Script to fetch providers from Supabase and update the Athena parser mapping
 * Run with: node scripts/update-provider-mapping.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchProviders() {
  console.log('🔍 Fetching providers from Supabase...');

  // Use RPC to bypass RLS
  const { data, error } = await supabase.rpc('get_all_medical_staff');

  // If RPC doesn't exist, try direct query with service role
  if (error && error.code === '42883') {
    console.log('⚠️  RPC not found, trying direct query...');
    const result = await supabase
      .from('medical_staff')
      .select('id, first_name, last_name, email, specialty, role, is_active')
      .order('last_name');

    if (result.error) {
      console.error('❌ Error fetching providers:', result.error);
      console.log('\n💡 RLS is blocking the query. Providers exist but query cannot access them.');
      console.log('Solution: Manually update the provider mapping or disable RLS temporarily.\n');
      throw result.error;
    }

    const activeProviders = (result.data || []).filter(p => p.is_active);

    if (activeProviders.length === 0) {
      console.warn('⚠️  No active providers found in medical_staff table');
      return [];
    }

    console.log(`✅ Found ${activeProviders.length} active providers`);
    return activeProviders;
  }

  if (error) {
    console.error('❌ Error fetching providers:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('⚠️  No providers found in medical_staff table');
    return [];
  }

  console.log(`✅ Found ${data.length} active providers`);
  return data;
}

function generateProviderMapping(providers) {
  const mappingEntries = providers.map(provider => {
    const firstName = provider.first_name || '';
    const lastName = provider.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const specialty = provider.specialty || provider.role || 'General Practice';

    // Generate different name format variations for flexible matching
    const lastFirst = `${lastName.toLowerCase()}, ${firstName.toLowerCase()}`.trim();
    const firstLast = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`.trim();

    return `  // ${fullName}
  '${lastFirst}': { id: '${provider.id}', fullName: 'Dr. ${fullName}', specialty: '${specialty}' },
  '${firstLast}': { id: '${provider.id}', fullName: 'Dr. ${fullName}', specialty: '${specialty}' },`;
  }).join('\n');

  return `const PROVIDER_NAME_MAPPING: Record<string, { id: string; fullName: string; specialty?: string }> = {
${mappingEntries}
};`;
}

async function updateParserFile(providers) {
  const parserFilePath = path.join(
    __dirname,
    '../src/services/athenaScheduleParser.service.ts'
  );

  console.log('📝 Reading parser file...');
  let content = fs.readFileSync(parserFilePath, 'utf-8');

  // Generate new mapping
  const newMapping = generateProviderMapping(providers);

  // Replace the PROVIDER_NAME_MAPPING constant (more flexible regex)
  const mappingRegex = /const PROVIDER_NAME_MAPPING:\s*Record<[^>]+>\s*=\s*\{[^}]*\};/s;

  if (!mappingRegex.test(content)) {
    console.error('❌ Could not find PROVIDER_NAME_MAPPING in parser file');
    console.log('Trying alternative pattern...');

    // Try simpler pattern
    const simpleRegex = /\/\/ Provider name mapping[\s\S]*?const PROVIDER_NAME_MAPPING[\s\S]*?\};/;

    if (!simpleRegex.test(content)) {
      console.error('❌ Still could not find mapping. Manual update required.');
      console.log('\nProviders found:');
      providers.forEach(p => console.log(`  - ${p.first_name} ${p.last_name}`));
      process.exit(1);
    }

    content = content.replace(simpleRegex, `// Provider name mapping (customize for your practice)\n${newMapping}`);
  } else {
    content = content.replace(mappingRegex, newMapping);
  }

  // Write back to file
  console.log('💾 Updating parser file...');
  fs.writeFileSync(parserFilePath, content, 'utf-8');

  console.log('✅ Provider mapping updated successfully!');
  console.log(`\n📋 Updated mappings for ${providers.length} providers:`);
  providers.forEach(p => {
    console.log(`   - Dr. ${p.first_name} ${p.last_name} (${p.specialty || p.role})`);
  });
}

async function main() {
  try {
    console.log('🚀 Starting provider mapping update...\n');

    const providers = await fetchProviders();

    if (providers.length === 0) {
      console.log('\n⚠️  No providers to update. Please add providers to medical_staff table first.');
      console.log('\nYou can add providers via:');
      console.log('1. Admin Account Creation page (/admin/create-accounts)');
      console.log('2. Directly in Supabase Table Editor');
      process.exit(0);
    }

    await updateParserFile(providers);

    console.log('\n✨ Done! The athenaScheduleParser.service.ts file has been updated.');
    console.log('\n💡 Next steps:');
    console.log('1. Review the updated file to ensure mappings look correct');
    console.log('2. Test by uploading an Athena schedule file');
    console.log('3. The parser will now recognize your providers automatically');

  } catch (error) {
    console.error('\n❌ Error updating provider mapping:', error);
    process.exit(1);
  }
}

main();
