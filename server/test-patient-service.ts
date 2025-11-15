/**
 * Test script for patient service
 * Tests patient creation, matching, and duplicate prevention
 *
 * Run with: npx tsx server/test-patient-service.ts
 */

import patientService from './services/patient.service';

async function testPatientService() {
  console.log('\n========================================');
  console.log('TESTING PATIENT SERVICE');
  console.log('========================================\n');

  try {
    // Test 1: Create new patient
    console.log('TEST 1: Create new patient');
    console.log('----------------------------');
    const patientId1 = await patientService.findOrCreatePatient({
      patient_name: 'John Test Smith',
      patient_phone: '555-123-4567',
      patient_dob: '1985-05-15',
      patient_email: 'john.test@example.com',
      provider_id: 'test-provider-uuid',
      appointment_date: '2025-02-15',
    });
    console.log('✅ Created/Found patient UUID:', patientId1);

    // Get patient details
    const patient1 = await patientService.getPatientById(patientId1);
    console.log('Patient ID:', patient1?.patient_id);
    console.log('Full Name:', patient1?.full_name);
    console.log('Phone:', patient1?.phone_primary);
    console.log('');

    // Test 2: Find same patient by phone (should match)
    console.log('TEST 2: Match by phone (different format)');
    console.log('----------------------------');
    const patientId2 = await patientService.findOrCreatePatient({
      patient_name: 'John Smith', // slightly different name
      patient_phone: '(555) 123-4567', // different format
      provider_id: 'test-provider-uuid',
      appointment_date: '2025-02-20',
    });
    console.log('✅ Found patient UUID:', patientId2);
    console.log('Match successful:', patientId1 === patientId2 ? '✅ YES' : '❌ NO');
    console.log('');

    // Test 3: Find by name + DOB
    console.log('TEST 3: Match by name + DOB');
    console.log('----------------------------');
    const patientId3 = await patientService.findOrCreatePatient({
      patient_name: 'John Test Smith',
      patient_dob: '1985-05-15',
      provider_id: 'test-provider-uuid',
      appointment_date: '2025-02-25',
    });
    console.log('✅ Found patient UUID:', patientId3);
    console.log('Match successful:', patientId1 === patientId3 ? '✅ YES' : '❌ NO');
    console.log('');

    // Test 4: Create different patient
    console.log('TEST 4: Create different patient');
    console.log('----------------------------');
    const patientId4 = await patientService.findOrCreatePatient({
      patient_name: 'Jane Test Doe',
      patient_phone: '555-987-6543',
      patient_dob: '1990-08-22',
      patient_email: 'jane.test@example.com',
      provider_id: 'test-provider-uuid',
      appointment_date: '2025-02-18',
    });
    console.log('✅ Created new patient UUID:', patientId4);
    console.log('Different from first patient:', patientId1 !== patientId4 ? '✅ YES' : '❌ NO');

    const patient4 = await patientService.getPatientById(patientId4);
    console.log('Patient ID:', patient4?.patient_id);
    console.log('Full Name:', patient4?.full_name);
    console.log('');

    // Test 5: Test utility functions
    console.log('TEST 5: Utility functions');
    console.log('----------------------------');

    const cleanedPhone = patientService.cleanPhone('(555) 123-4567');
    console.log('Clean phone (555) 123-4567 →', cleanedPhone);

    const firstName = patientService.parseFirstName('John Test Smith');
    console.log('Parse first name "John Test Smith" →', firstName);

    const lastName = patientService.parseLastName('John Test Smith');
    console.log('Parse last name "John Test Smith" →', lastName);

    const similarity1 = patientService.calculateNameSimilarity('John Smith', 'John Smith');
    console.log('Similarity "John Smith" vs "John Smith" →', (similarity1 * 100).toFixed(0) + '%');

    const similarity2 = patientService.calculateNameSimilarity('John Smith', 'Jon Smith');
    console.log('Similarity "John Smith" vs "Jon Smith" →', (similarity2 * 100).toFixed(0) + '%');

    const similarity3 = patientService.calculateNameSimilarity('John Smith', 'Jane Doe');
    console.log('Similarity "John Smith" vs "Jane Doe" →', (similarity3 * 100).toFixed(0) + '%');
    console.log('');

    // Test 6: Search patients
    console.log('TEST 6: Search patients by name');
    console.log('----------------------------');
    const searchResults = await patientService.searchPatientsByName('Test');
    console.log(`Found ${searchResults.length} patients with "Test" in name:`);
    searchResults.forEach(p => {
      console.log(`  - ${p.patient_id}: ${p.full_name}`);
    });
    console.log('');

    console.log('========================================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY ✅');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testPatientService()
  .then(() => {
    console.log('Exiting...\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
