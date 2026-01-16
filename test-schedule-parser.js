/**
 * Test script to verify Athena schedule parsing
 * Run with: node test-schedule-parser.js
 */

const fs = require('fs');
const path = require('path');

// Read the 09-30 file
const filePath = '/Users/rakeshpatel/Downloads/printcsvreports - 20260116_09-30.csv';
const content = fs.readFileSync(filePath, 'utf-8');

// Parse basic stats
const lines = content.trim().split('\n');
const header = lines[0];
const dataRows = lines.slice(2); // Skip report name and header

console.log('===== ATHENA SCHEDULE FILE TEST =====\n');
console.log(`File: ${path.basename(filePath)}`);
console.log(`Total lines: ${lines.length}`);
console.log(`Data rows: ${dataRows.length}`);
console.log(`File size: ${(content.length / 1024).toFixed(2)} KB\n`);

// Parse header
const delimiter = header.includes('\t') ? '\t' : ',';
const headers = header.split(delimiter);
console.log(`===== COLUMN STRUCTURE =====`);
console.log(`Delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`);
console.log(`Columns (${headers.length}):`);
headers.forEach((h, i) => {
  console.log(`  ${i + 1}. ${h}`);
});

// Check for critical columns
console.log(`\n===== CRITICAL COLUMNS CHECK =====`);
const criticalColumns = {
  'appt schdlng prvdr': false,
  'apptdate': false,
  'apptstarttime': false,
  'patient firstname': false,
  'patient lastname': false,
  'patientid': false,
  'patient mobile no': false,
  'appttype': false,
  'apptstatus': false,
  'apptcancelleddate': false,
};

headers.forEach(h => {
  const normalized = h.toLowerCase().trim();
  Object.keys(criticalColumns).forEach(key => {
    if (normalized === key) {
      criticalColumns[key] = true;
    }
  });
});

Object.entries(criticalColumns).forEach(([col, found]) => {
  console.log(`  ${found ? '✓' : '✗'} ${col}: ${found ? 'FOUND' : 'MISSING'}`);
});

// Parse a few sample rows
console.log(`\n===== SAMPLE APPOINTMENTS =====`);
const sampleCount = Math.min(5, dataRows.length);

for (let i = 0; i < sampleCount; i++) {
  const row = dataRows[i];
  const parts = row.split(delimiter);

  const provider = parts[0] || '';
  const date = parts[1] || '';
  const time = parts[2] || '';
  const firstName = parts[13] || '';
  const lastName = parts[14] || '';
  const cancelledDate = parts[15] || '';
  const apptType = parts[17] || '';
  const apptStatus = parts[18] || '';

  console.log(`\nRow ${i + 1}:`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Date: ${date}`);
  console.log(`  Time: ${time}`);
  console.log(`  Patient: ${firstName} ${lastName}`);
  console.log(`  Type: ${apptType}`);
  console.log(`  Status: ${apptStatus}`);
  console.log(`  Cancelled: ${cancelledDate || 'No'}`);
}

// Count status values
console.log(`\n===== STATUS ANALYSIS =====`);
const statusCounts = {};
dataRows.forEach(row => {
  const parts = row.split(delimiter);
  const status = parts[18] || 'unknown';
  statusCounts[status] = (statusCounts[status] || 0) + 1;
});

console.log('Status distribution:');
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

// Count appointment types
console.log(`\n===== APPOINTMENT TYPE ANALYSIS =====`);
const typeCounts = {};
dataRows.forEach(row => {
  const parts = row.split(delimiter);
  const type = parts[17] || 'unknown';
  typeCounts[type] = (typeCounts[type] || 0) + 1;
});

console.log('Type distribution:');
Object.entries(typeCounts).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

// Count empty slots
console.log(`\n===== EMPTY SLOTS (BLOCKED TIME) =====`);
let emptyCount = 0;
dataRows.forEach(row => {
  const parts = row.split(delimiter);
  const firstName = parts[13] || '';
  const lastName = parts[14] || '';
  const patientId = parts[10] || '';

  if (!firstName && !lastName && !patientId) {
    emptyCount++;
  }
});

console.log(`Empty slots found: ${emptyCount} out of ${dataRows.length}`);

// Count cancelled appointments
console.log(`\n===== CANCELLATIONS =====`);
let cancelledCount = 0;
dataRows.forEach(row => {
  const parts = row.split(delimiter);
  const cancelledDate = parts[15] || '';

  if (cancelledDate && cancelledDate.trim()) {
    cancelledCount++;
  }
});

console.log(`Cancelled appointments: ${cancelledCount} out of ${dataRows.length}`);

console.log(`\n===== TEST COMPLETE =====`);
console.log(`\nFile is ready for import to tshla.ai!`);
console.log(`Expected results after import:`);
console.log(`  - Total appointments: ${dataRows.length}`);
console.log(`  - Empty slots (Blocked Time): ${emptyCount}`);
console.log(`  - Cancelled: ${cancelledCount}`);
console.log(`  - Active appointments: ${dataRows.length - emptyCount - cancelledCount}`);
