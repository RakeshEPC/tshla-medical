#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: './.env' });

// Direct script to create a test patient and get PIN
const patientMatchingService = require('./server/services/patientMatching.service');

async function createTestPatient() {
  console.log('🔧 Creating test patient...\n');

  try {
    const patient = await patientMatchingService.findOrCreatePatient(
      '555-999-8888',
      {
        name: 'Test Patient',
        first_name: 'Test',
        last_name: 'Patient',
        email: 'test@example.com',
        dob: '1990-01-15',
        provider_name: 'Dr. Smith',
      },
      'manual-script'
    );

    console.log('✅ Patient created successfully!\n');
    console.log('='.repeat(50));
    console.log('📋 PATIENT INFORMATION');
    console.log('='.repeat(50));
    console.log(`Patient ID: ${patient.patient_id}`);
    console.log(`Name: ${patient.full_name}`);
    console.log(`Phone: ${patient.phone_display}`);
    console.log(`Email: ${patient.email || 'Not provided'}`);
    console.log(`DOB: ${patient.date_of_birth || 'Not provided'}`);
    console.log('='.repeat(50));
    console.log('\n🔑 LOGIN CREDENTIALS');
    console.log('='.repeat(50));
    console.log(`Phone: ${patient.phone_display} (or 555-999-8888)`);

    if (patient.portal_pin_plaintext) {
      console.log(`PIN: ${patient.portal_pin_plaintext}`);
      console.log('='.repeat(50));
      console.log('\n🌐 LOGIN NOW:');
      console.log('   http://localhost:5173/patient-portal-login');
      console.log('\n   Enter the phone and PIN above!');
    } else {
      console.log('PIN: (Check server console - should have been logged)');
      console.log('='.repeat(50));
      console.log('\n⚠️  Note: The PIN was logged when patient was created.');
      console.log('   Check your server console output above for "New PIN: XXXXXX"');
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating patient:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTestPatient();
