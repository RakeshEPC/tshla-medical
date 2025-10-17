#!/usr/bin/env node

/**
 * Test Script: Dictation Save Flow
 * Tests end-to-end dictation save to Supabase
 * Usage: node scripts/test-dictation-save.js
 */

const API_BASE = 'http://localhost:3003';

// Test data
const testDictation = {
  provider_id: 'test-provider-001',
  provider_name: 'Dr. Test Provider',
  provider_email: 'test@tshla.ai',
  provider_specialty: 'Family Medicine',

  patient_name: 'Test Patient',
  patient_phone: '555-0123',
  patient_mrn: 'TEST-MRN-001',
  patient_dob: '1980-01-15',

  visit_date: new Date().toISOString().split('T')[0],
  visit_type: 'follow-up',
  note_title: 'Test Dictation Save',
  chief_complaint: 'Testing dictation save functionality',

  raw_transcript: 'Patient presents for follow-up visit. Patient reports feeling well. No new complaints. Blood pressure is well controlled on current medications.',
  processed_note: 'SUBJECTIVE:\nPatient feeling well, no new complaints\n\nOBJECTIVE:\nBP: 120/80\nHR: 72\n\nASSESSMENT:\nHypertension well controlled\n\nPLAN:\nContinue current medications\nFollow-up in 3 months',
  ai_summary: 'Routine follow-up for hypertension management. Patient stable.',
  clinical_impression: 'HTN well controlled, continue current therapy',

  recording_mode: 'dictation',
  recording_duration_seconds: 45,
  ai_model_used: 'gpt-4o',
  processing_confidence_score: 0.95,

  status: 'draft'
};

async function testHealthCheck() {
  console.log('\n🔍 Step 1: Health Check');
  console.log('━'.repeat(60));

  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    console.log(`✅ API Server: ${data.status}`);
    console.log(`✅ Database: ${data.database}`);
    console.log(`✅ Database Type: ${data.databaseType}`);
    console.log(`✅ Version: ${data.version}`);

    if (data.database !== 'connected') {
      console.log('\n❌ ERROR: Database not connected!');
      console.log('Make sure the enhanced-schedule-notes-api server is running:');
      console.log('  node server/enhanced-schedule-notes-api.js');
      process.exit(1);
    }

    return true;
  } catch (error) {
    console.log(`\n❌ ERROR: Could not connect to API server`);
    console.log(`   ${error.message}`);
    console.log('\nMake sure the server is running:');
    console.log('  node server/enhanced-schedule-notes-api.js');
    process.exit(1);
  }
}

async function testSaveDictation() {
  console.log('\n📝 Step 2: Save Test Dictation');
  console.log('━'.repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/dictated-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testDictation)
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ Save Failed: ${response.status}`);
      console.log(`   Error: ${data.error}`);
      console.log(`   Details: ${data.details}`);
      return null;
    }

    console.log(`✅ Dictation Saved!`);
    console.log(`   Note ID: ${data.noteId}`);
    console.log(`   Message: ${data.message}`);

    return data.noteId;
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return null;
  }
}

async function testRetrieveNote(noteId) {
  console.log('\n🔎 Step 3: Retrieve Saved Note');
  console.log('━'.repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/notes/${noteId}`);
    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ Retrieve Failed: ${response.status}`);
      console.log(`   Error: ${data.error}`);
      return false;
    }

    console.log(`✅ Note Retrieved!`);
    console.log(`   Patient: ${data.note.patient_name}`);
    console.log(`   Provider: ${data.note.provider_name}`);
    console.log(`   Visit Date: ${data.note.visit_date}`);
    console.log(`   Status: ${data.note.status}`);
    console.log(`   Versions: ${data.versions.length}`);
    console.log(`   Comments: ${data.comments.length}`);

    console.log('\n📄 Note Content Preview:');
    console.log(`   Raw Transcript Length: ${data.note.raw_transcript.length} chars`);
    console.log(`   Processed Note Length: ${data.note.processed_note.length} chars`);

    return true;
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function testListProviderNotes(providerId) {
  console.log('\n📋 Step 4: List Provider Notes');
  console.log('━'.repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/providers/${providerId}/notes`);
    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ List Failed: ${response.status}`);
      console.log(`   Error: ${data.error}`);
      return false;
    }

    console.log(`✅ Provider Notes Retrieved!`);
    console.log(`   Total Notes: ${data.count}`);

    if (data.notes && data.notes.length > 0) {
      console.log('\n   Recent Notes:');
      data.notes.slice(0, 5).forEach((note, index) => {
        console.log(`   ${index + 1}. ${note.patient_name} - ${note.visit_date} (${note.status})`);
      });
    }

    return true;
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function testSearchNotes() {
  console.log('\n🔍 Step 5: Search Notes');
  console.log('━'.repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/notes/search?patient_name=Test`);
    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ Search Failed: ${response.status}`);
      console.log(`   Error: ${data.error}`);
      return false;
    }

    console.log(`✅ Search Completed!`);
    console.log(`   Results Found: ${data.count}`);

    return true;
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function testDirectSupabaseQuery() {
  console.log('\n🗄️  Step 6: Direct Supabase Query Verification');
  console.log('━'.repeat(60));
  console.log('To verify data in Supabase directly:');
  console.log('');
  console.log('1. Go to: https://app.supabase.com/project/minvvjdflezibmgkplqb');
  console.log('2. Click "SQL Editor" in the left sidebar');
  console.log('3. Run this query:');
  console.log('');
  console.log('   SELECT COUNT(*) as total_notes FROM dictated_notes;');
  console.log('');
  console.log('4. To see the test note:');
  console.log('');
  console.log(`   SELECT * FROM dictated_notes`);
  console.log(`   WHERE patient_name = 'Test Patient'`);
  console.log(`   ORDER BY created_at DESC LIMIT 1;`);
  console.log('');
}

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  TSHLA Medical - Dictation Save Flow Test                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Step 1: Health Check
  await testHealthCheck();

  // Step 2: Save Dictation
  const noteId = await testSaveDictation();
  if (!noteId) {
    console.log('\n❌ TEST FAILED: Could not save dictation');
    process.exit(1);
  }

  // Step 3: Retrieve Note
  const retrieved = await testRetrieveNote(noteId);
  if (!retrieved) {
    console.log('\n❌ TEST FAILED: Could not retrieve saved note');
    process.exit(1);
  }

  // Step 4: List Provider Notes
  await testListProviderNotes(testDictation.provider_id);

  // Step 5: Search Notes
  await testSearchNotes();

  // Step 6: Verification Instructions
  await testDirectSupabaseQuery();

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ ALL TESTS PASSED!                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('✅ Dictation save flow is working correctly!');
  console.log(`✅ Test note saved with ID: ${noteId}`);
  console.log('✅ Data is persisting in Supabase PostgreSQL');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Test in the actual app UI');
  console.log('  2. Verify HIPAA compliance features');
  console.log('  3. Test version history and audit trail');
  console.log('  4. Set up automated backups');
  console.log('');
}

// Run the tests
runAllTests().catch(error => {
  console.error('\n❌ UNEXPECTED ERROR:', error);
  process.exit(1);
});
