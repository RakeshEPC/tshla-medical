/**
 * Script to fetch providers from Supabase and update the Athena parser mapping
 * Run with: npx tsx scripts/update-provider-mapping.ts
 */

import { supabase } from '../src/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialty?: string;
  role: string;
}

async function fetchProviders(): Promise<Provider[]> {
  console.log('🔍 Fetching providers from Supabase...');

  const { data, error } = await supabase
    .from('medical_staff')
    .select('id, first_name, last_name, email, specialty, role')
    .eq('is_active', true)
    .order('last_name');

  if (error) {
    console.error('❌ Error fetching providers:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('⚠️  No providers found in medical_staff table');
    return [];
  }

  console.log(`✅ Found ${data.length} active providers`);
  return data as Provider[];
}

function generateProviderMapping(providers: Provider[]): string {
  const mappingEntries = providers.map(provider => {
    const firstName = provider.first_name || '';
    const lastName = provider.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const specialty = provider.specialty || provider.role || 'General Practice';

    // Generate different name format variations for flexible matching
    const lastFirst = `${lastName.toLowerCase()}, ${firstName.toLowerCase()}`.trim();
    const firstLast = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`.trim();
    const lastOnly = lastName.toLowerCase();

    return `  // ${fullName}
  '${lastFirst}': { id: '${provider.id}', fullName: 'Dr. ${fullName}', specialty: '${specialty}' },
  '${firstLast}': { id: '${provider.id}', fullName: 'Dr. ${fullName}', specialty: '${specialty}' },`;
  }).join('\n');

  return `const PROVIDER_NAME_MAPPING: Record<string, { id: string; fullName: string; specialty?: string }> = {
${mappingEntries}
};`;
}

async function updateParserFile(providers: Provider[]) {
  const parserFilePath = path.join(
    __dirname,
    '../src/services/athenaScheduleParser.service.ts'
  );

  console.log('📝 Reading parser file...');
  let content = fs.readFileSync(parserFilePath, 'utf-8');

  // Generate new mapping
  const newMapping = generateProviderMapping(providers);

  // Replace the PROVIDER_NAME_MAPPING constant
  const mappingRegex = /const PROVIDER_NAME_MAPPING[^}]+\};/s;

  if (!mappingRegex.test(content)) {
    console.error('❌ Could not find PROVIDER_NAME_MAPPING in parser file');
    process.exit(1);
  }

  content = content.replace(mappingRegex, newMapping);

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
