/**
 * Apply Dictation Audio Migration
 * Adds audio_url and related columns to dictated_notes table
 * Created: 2026-01-26
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🔧 APPLYING DICTATION AUDIO MIGRATION\n');
  console.log('=' .repeat(70) + '\n');

  // Since Supabase JS client doesn't support raw SQL directly,
  // we'll verify if columns exist by attempting to select them

  console.log('📋 Checking current dictated_notes schema...\n');

  const { data: sample, error: selectError } = await supabase
    .from('dictated_notes')
    .select('*')
    .limit(1);

  if (selectError) {
    console.error('❌ Error reading dictated_notes:', selectError.message);
    return;
  }

  const currentColumns = sample && sample[0] ? Object.keys(sample[0]) : [];
  console.log('Current columns:', currentColumns.length);

  const requiredColumns = ['audio_url', 'audio_deleted', 'audio_deleted_at', 'audio_generated_at'];
  const missingColumns = requiredColumns.filter(col => !currentColumns.includes(col));

  if (missingColumns.length === 0) {
    console.log('\n✅ All audio columns already exist!\n');
    requiredColumns.forEach(col => {
      console.log(`   ✅ ${col}`);
    });
    console.log('\n' + '=' .repeat(70));
    return;
  }

  console.log('\n⚠️  Missing columns:', missingColumns.length);
  missingColumns.forEach(col => {
    console.log(`   ❌ ${col}`);
  });

  console.log('\n' + '=' .repeat(70));
  console.log('\n📝 MANUAL MIGRATION REQUIRED\n');
  console.log('Please run the following SQL in Supabase Dashboard:');
  console.log('URL: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql\n');
  console.log('-'.repeat(70));
  console.log(`
-- Add audio columns to dictated_notes table
ALTER TABLE dictated_notes
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dictated_notes_patient_phone
ON dictated_notes(patient_phone);

CREATE INDEX IF NOT EXISTS idx_dictated_notes_unified_patient_id
ON dictated_notes(unified_patient_id);

-- Add comments
COMMENT ON COLUMN dictated_notes.audio_url IS 'URL to generated TTS audio file in Supabase Storage';
COMMENT ON COLUMN dictated_notes.audio_deleted IS 'Flag indicating patient has deleted the audio file';
COMMENT ON COLUMN dictated_notes.audio_deleted_at IS 'Timestamp when patient deleted the audio file';
COMMENT ON COLUMN dictated_notes.audio_generated_at IS 'Timestamp when TTS audio was generated';
`);
  console.log('-'.repeat(70));
  console.log('\n💡 After running the SQL, run this script again to verify.\n');
  console.log('=' .repeat(70));
}

applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
