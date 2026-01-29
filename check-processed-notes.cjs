#!/usr/bin/env node
/**
 * Check if processed_note field is being saved
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProcessedNotes() {
  console.log('\n🔍 Checking Processed Notes in Database...\n');

  // Get recent dictated notes
  const { data: notes, error } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, patient_mrn, provider_id, provider_name, raw_transcript, processed_note, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`📊 Found ${notes.length} recent notes:\n`);

  notes.forEach((note, index) => {
    console.log(`${index + 1}. Note ID: ${note.id}`);
    console.log(`   Patient: ${note.patient_name} (MRN: ${note.patient_mrn || 'N/A'})`);
    console.log(`   Provider: ${note.provider_name}`);
    console.log(`   Created: ${new Date(note.created_at).toLocaleString()}`);
    console.log(`   Has Transcript: ${note.raw_transcript ? '✅ YES (' + note.raw_transcript.length + ' chars)' : '❌ NO'}`);
    console.log(`   Has Processed Note: ${note.processed_note ? '✅ YES (' + note.processed_note.length + ' chars)' : '❌ NO'}`);

    if (note.processed_note) {
      const preview = note.processed_note.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   Preview: "${preview}..."`);
    }
    console.log('');
  });

  // Check for notes with transcript but no processed_note
  const { data: incomplete, error: incompleteError } = await supabase
    .from('dictated_notes')
    .select('id, patient_name, created_at')
    .not('raw_transcript', 'is', null)
    .is('processed_note', null)
    .limit(5);

  if (incomplete && incomplete.length > 0) {
    console.log(`\n⚠️  Found ${incomplete.length} notes with transcript but NO processed note:`);
    incomplete.forEach(note => {
      console.log(`   - Note ID ${note.id}: ${note.patient_name} (${new Date(note.created_at).toLocaleString()})`);
    });
  } else {
    console.log(`\n✅ All notes with transcripts also have processed notes!`);
  }

  console.log('\n✅ Check complete!\n');
}

checkProcessedNotes();
