#!/usr/bin/env node
/**
 * Upload Athena Schedule to TSHLA Medical Database
 * Reads CSV file and imports appointments via Supabase
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Supabase client setup
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Need: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Provider mapping
const PROVIDER_MAPPING = {
  'gc_epc_adeleke_a': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Dr. Adeleke A' },
  'gc_epc_bernander_r': { id: '962fbea3-3820-4b43-aad3-b31cdd27af83', fullName: 'Dr. Radha Bernander' },
  'gc_epc_chamakkala_t': { id: '478698f8-fab2-4233-8e26-a9cf1145ddcd', fullName: 'Dr. Tess Chamakkala' },
  'gc_epc_patel_r': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Rakesh Patel' },
  'gc_epc_patel_n': { id: '59bb5994-5c0d-4e1b-975a-eec141dccda8', fullName: 'Dr. Neha Patel' },
  'gc_epc_gregorek_s': { id: '84513525-64d0-4a21-9d87-15b31cdcd4ea', fullName: 'Dr. Shannon Gregorek' },
  'gc_epc_laverde_c': { id: '357ab91f-3727-4d1f-b605-3c9ff70e4133', fullName: 'Dr. Cindy Laverde' },
  'gc_epc_patel-konasag': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Patel-Konasag' },
  'gc_epc_raghu_p': { id: '652d519e-1d9d-4cdb-9768-111d4ccc03da', fullName: 'Dr. Raghu P' },
  'gc_epc_shakya_e': { id: '96306043-2e3e-4323-a07e-d11e1f1b76fc', fullName: 'Dr. Elinia Shakya' },
  'gc_epc_watwe_v': { id: 'c5b7d2c7-d83f-44f7-9a9c-ad73e851b16d', fullName: 'Dr. Veena Watwe' },
  'gc_epc_younus_n': { id: 'd552f692-acf3-49e3-b238-6cc4f147013e', fullName: 'Dr. Nadia Younus' },
  'gc_epc_subawalla_d': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Dr. Subawalla D' },
  'gc_epc_wade-reescano': { id: 'ff53319a-40fe-4011-a314-ceabbdb3180f', fullName: 'Dr. Kamili Wade-Reescano' },
  'gc_epc_idealprotein': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Ideal Protein' },
  'gc_epc_thrive': { id: 'd24f32c8-3af2-49a2-88bd-34d56d4cf131', fullName: 'Thrive Program' },
};

// Parse CSV file
function parseCSV(fileContent) {
  const lines = fileContent.trim().split('\n');

  // Skip report title if present
  let startIndex = 0;
  if (lines[0].toLowerCase().includes('report name')) {
    console.log('📝 Skipping report title line');
    startIndex = 1;
  }

  // Parse header
  const headers = parseCSVRow(lines[startIndex]);
  console.log(`📋 Found ${headers.length} columns`);

  // Parse data rows
  const appointments = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      appointments.push(row);
    }
  }

  return appointments;
}

function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse date from MM/DD/YYYY to YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// Parse time to 24-hour format for database
function parseTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return null;

  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let [, hour, minute, period] = match;
    hour = parseInt(hour);
    if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute}:00`;
  }
  return null;
}

// Map appointment status
function mapStatus(apptStatus, cancelledDate) {
  if (cancelledDate && cancelledDate.trim() !== '') {
    return 'cancelled';
  }
  if (!apptStatus || apptStatus === 'None') {
    return 'scheduled';
  }
  if (apptStatus.includes('Check-Out') || apptStatus.includes('5')) {
    return 'completed';
  }
  if (apptStatus.includes('Sign-Off') || apptStatus.includes('4')) {
    return 'in-progress';
  }
  if (apptStatus.includes('Intake') || apptStatus.includes('2')) {
    return 'checked-in';
  }
  return 'confirmed';
}

// Map appointment type
function mapAppointmentType(apptType, firstName) {
  if (!firstName || firstName === '') {
    return 'block-time';
  }
  const type = (apptType || '').toLowerCase();
  if (type.includes('new patient')) return 'new-patient';
  if (type.includes('established')) return 'follow-up';
  if (type.includes('telemedicine') || type.includes('virtual') || type.includes('privia virtual')) return 'telehealth';
  if (type.includes('follow up')) return 'follow-up';
  return 'office-visit';
}

// Convert appointment row to database format
function convertToAppointment(row, scheduleDate) {
  const providerKey = (row['appt schdlng prvdr'] || '').toLowerCase().trim();
  const provider = PROVIDER_MAPPING[providerKey];

  if (!provider) {
    console.warn(`⚠️  Unknown provider: ${row['appt schdlng prvdr']}`);
    return null;
  }

  const date = parseDate(row['apptdate']) || scheduleDate;
  const startTime = parseTime(row['apptstarttime']);

  if (!startTime) {
    console.warn(`⚠️  No start time for appointment`);
    return null;
  }

  const firstName = row['patient firstname'] || '';
  const lastName = row['patient lastname'] || '';
  const isBlockTime = !firstName && !lastName;

  const status = mapStatus(row['apptstatus'], row['apptcancelleddate']);
  const appointmentType = mapAppointmentType(row['appttype'], firstName);

  // Calculate end time (default 20 min for most, 30 for new patients)
  const duration = appointmentType === 'new-patient' ? 30 : 20;
  const startHour = parseInt(startTime.split(':')[0]);
  const startMin = parseInt(startTime.split(':')[1]);
  const endMin = (startMin + duration) % 60;
  const endHour = startHour + Math.floor((startMin + duration) / 60);
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;

  return {
    provider_id: provider.id,
    provider_name: provider.fullName,
    patient_name: isBlockTime ? 'Blocked Time' : `${firstName} ${lastName}`.trim(),
    patient_phone: row['patient mobile no'] || null,
    patient_email: (row['patient email'] && row['patient email'] !== 'No Email') ? row['patient email'] : null,
    patient_mrn: row['patientid'] || null,
    patient_dob: parseDate(row['patientdob']) || null,
    appointment_type: appointmentType,
    appointment_title: row['appttype'] || 'Office Visit',
    scheduled_date: date,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: duration,
    status: status,
    is_telehealth: appointmentType === 'telehealth',
    urgency_level: 'routine',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Main upload function
async function uploadSchedule() {
  console.log('\n🏥 TSHLA Medical - Schedule Upload Tool\n');

  const csvPath = '/Users/rakeshpatel/Downloads/printcsvreports - 20260201_08-22.csv';

  console.log(`📁 Reading file: ${path.basename(csvPath)}\n`);

  // Read CSV file
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const rawRows = parseCSV(fileContent);
  console.log(`✅ Parsed ${rawRows.length} rows from CSV\n`);

  // Convert to appointment objects (let date come from CSV)
  const appointments = rawRows
    .map(row => convertToAppointment(row, null))
    .filter(apt => apt !== null);

  console.log(`✅ Converted ${appointments.length} valid appointments\n`);

  // Group by date
  const dateGroups = {};
  appointments.forEach(apt => {
    const date = apt.scheduled_date;
    if (!dateGroups[date]) dateGroups[date] = [];
    dateGroups[date].push(apt);
  });

  // Count by provider and status
  const providerCounts = {};
  const statusCounts = {};
  appointments.forEach(apt => {
    providerCounts[apt.provider_name] = (providerCounts[apt.provider_name] || 0) + 1;
    statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
  });

  console.log('📊 Provider breakdown:');
  Object.entries(providerCounts).forEach(([name, count]) => {
    console.log(`   ${name}: ${count} appointments`);
  });

  console.log('\n📊 Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n📅 Date range:');
  const dates = Object.keys(dateGroups).sort();
  console.log(`   ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`   ${dates.length} unique dates`);

  console.log(`\n🗑️  Clearing existing appointments for date range...`);

  // Delete existing appointments for this date range
  const { error: deleteError } = await supabase
    .from('provider_schedules')
    .delete()
    .gte('scheduled_date', dates[0])
    .lte('scheduled_date', dates[dates.length - 1]);

  if (deleteError) {
    console.error('❌ Failed to clear existing appointments:', deleteError.message);
    process.exit(1);
  }

  console.log('✅ Cleared existing appointments\n');

  console.log(`📤 Uploading ${appointments.length} appointments...`);

  // Insert new appointments in batches of 50
  const batchSize = 50;
  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < appointments.length; i += batchSize) {
    const batch = appointments.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('provider_schedules')
      .insert(batch);

    if (error) {
      // If duplicate, try inserting one by one to skip duplicates
      if (error.code === '23505') {
        for (const apt of batch) {
          const { error: singleError } = await supabase
            .from('provider_schedules')
            .insert([apt]);

          if (singleError && singleError.code === '23505') {
            skipped++;
          } else if (!singleError) {
            uploaded++;
          }
        }
      } else {
        console.error(`❌ Failed to upload batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        console.error('   Details:', error);
      }
    } else {
      uploaded += batch.length;
    }
    process.stdout.write(`   Uploaded ${uploaded}/${appointments.length}, Skipped duplicates: ${skipped}...\r`);
  }

  console.log(`\n\n✅ Successfully uploaded ${uploaded} appointments!`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} duplicate entries`);
  }
  console.log(`\n📅 Schedule from ${dates[0]} to ${dates[dates.length - 1]} is now ready in the database.`);
  console.log(`📊 ${dates.length} days with appointments\n`);
}

// Run the upload
uploadSchedule().catch(err => {
  console.error('\n❌ Upload failed:', err.message);
  process.exit(1);
});
