/**
 * Test Dictation Audio Setup
 * Verifies all components are ready for audio generation
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSetup() {
  console.log('🧪 DICTATION AUDIO SETUP TEST\n');
  console.log('=' .repeat(70) + '\n');

  let allChecks = true;

  // Check 1: Database columns
  console.log('1️⃣  CHECKING DATABASE SCHEMA...\n');

  const { data: sample } = await supabase
    .from('dictated_notes')
    .select('*')
    .limit(1);

  const columns = sample && sample[0] ? Object.keys(sample[0]) : [];
  const requiredColumns = ['audio_url', 'audio_deleted', 'audio_deleted_at', 'audio_generated_at'];

  requiredColumns.forEach(col => {
    const exists = columns.includes(col);
    console.log(`   ${exists ? '✅' : '❌'} ${col}`);
    if (!exists) allChecks = false;
  });

  if (!allChecks) {
    console.log('\n   ⚠️  Missing columns! Run database migration first.');
    console.log('   URL: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql\n');
  } else {
    console.log('\n   ✅ All columns exist!\n');
  }

  // Check 2: Environment variables
  console.log('2️⃣  CHECKING ENVIRONMENT VARIABLES...\n');

  const envVars = {
    'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY
  };

  Object.entries(envVars).forEach(([key, value]) => {
    const exists = !!value;
    console.log(`   ${exists ? '✅' : '❌'} ${key}: ${exists ? 'Set (' + value.substring(0, 20) + '...)' : 'NOT SET'}`);
    if (!exists && key === 'ELEVENLABS_API_KEY') {
      allChecks = false;
    }
  });

  console.log();

  // Check 3: Supabase Storage bucket
  console.log('3️⃣  CHECKING SUPABASE STORAGE...\n');

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === 'patient-audio');

  console.log(`   ${bucketExists ? '✅' : '❌'} 'patient-audio' bucket`);

  if (!bucketExists) {
    console.log('\n   ⚠️  Bucket missing! Create it in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/storage/buckets\n');
    allChecks = false;
  } else {
    console.log('   ✅ Bucket exists!\n');
  }

  // Check 4: Dictation data
  console.log('4️⃣  CHECKING DICTATION DATA...\n');

  const { data: dictations } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, audio_url, processed_note, raw_transcript');

  console.log(`   📊 Total dictations: ${dictations?.length || 0}`);

  const withText = dictations?.filter(d => d.processed_note || d.raw_transcript) || [];
  const withAudio = dictations?.filter(d => d.audio_url) || [];

  console.log(`   ✅ With text content: ${withText.length}`);
  console.log(`   🎙️  With audio URL: ${withAudio.length}`);

  const needsAudio = dictations?.filter(d =>
    (d.processed_note || d.raw_transcript) && !d.audio_url
  ) || [];

  console.log(`   ⏳ Need audio generation: ${needsAudio.length}\n`);

  // Check 5: H&P status
  console.log('5️⃣  CHECKING H&P CHARTS...\n');

  const { count: hpCount } = await supabase
    .from('patient_comprehensive_chart')
    .select('*', { count: 'exact', head: true });

  console.log(`   📋 Total H&P charts: ${hpCount || 0}`);

  // Get unique patients from dictations
  const uniquePhones = new Set();
  dictations?.forEach(d => {
    if (d.patient_phone) {
      const digits = d.patient_phone.replace(/\D/g, '');
      const normalized = digits.length === 10 ? '+1' + digits : '+1' + digits.slice(-10);
      uniquePhones.add(normalized);
    }
  });

  console.log(`   👥 Unique patients with dictations: ${uniquePhones.size}`);
  console.log(`   ${hpCount >= uniquePhones.size ? '✅' : '⚠️ '} Coverage: ${hpCount}/${uniquePhones.size}\n`);

  // Summary
  console.log('=' .repeat(70));
  console.log('\n📋 SUMMARY\n');

  if (allChecks) {
    console.log('✅ All checks passed! Ready to generate audio.\n');
    console.log('🚀 Next step: Run audio generation script\n');
    console.log('   VITE_SUPABASE_URL="..." \\');
    console.log('   SUPABASE_SERVICE_ROLE_KEY="..." \\');
    console.log('   ELEVENLABS_API_KEY="..." \\');
    console.log('   node scripts/generate-dictation-audio.cjs\n');
  } else {
    console.log('❌ Some checks failed. Please fix issues above before generating audio.\n');
  }

  console.log('📖 Full documentation: DICTATION_AUDIO_IMPLEMENTATION.md\n');
  console.log('=' .repeat(70) + '\n');
}

testSetup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
