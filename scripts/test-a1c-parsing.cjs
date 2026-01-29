// Test A1C parsing with the exact format from uploads

const testLines = [
  'HEMOGLOBIN A1C 8.3 <5.7 % OF TOTAL HGB HIGH Final RGA',
  'HEMOGLOBIN A1C 8.3 <5.7 % HIGH Final RGA',
  'HEMOGLOBIN A1C               6.9                 <5.7             %           OF TOTAL HGB            HIGH         Final       RGA',
];

// Pattern 1: Original
const pattern1 = /^([A-Z][A-Z\s,\/-]+?)\s+(\d+\.?\d*|\w+)\s+([\d<>\.=\-\s]+)\s+([A-Z\/\s\(\)]+?)\s+(NORMAL|HIGH|LOW|SEE NOTE)/i;

// Pattern 2: Compact
const pattern2 = /^([A-Z][A-Z\s]+?)\s+(\d+\.?\d*)\s+([\d<>\.=\-\s]+)\s+(%|MG\/DL|G\/DL|MMOL\/L|U\/L|NG\/ML|PG\/ML)(?:\s+OF\s+TOTAL\s+HGB)?\s+(NORMAL|HIGH|LOW)/i;

// Pattern 3: More flexible
const pattern3 = /^(HEMOGLOBIN A1C)\s+(\d+\.?\d*)\s+([\d<>\.=\-\s]+)\s+(%)\s+(?:OF\s+TOTAL\s+HGB\s+)?(NORMAL|HIGH|LOW)/i;

console.log('Testing A1C parsing patterns:\n');

testLines.forEach((line, i) => {
  console.log(`Test line ${i + 1}:`);
  console.log(`  "${line}"`);

  const match1 = line.match(pattern1);
  console.log(`  Pattern 1: ${match1 ? '✅ MATCH' : '❌ NO MATCH'}`);
  if (match1) {
    console.log(`    Test: "${match1[1]}", Value: "${match1[2]}", Ref: "${match1[3]}", Unit: "${match1[4]}", Status: "${match1[5]}"`);
  }

  const match2 = line.match(pattern2);
  console.log(`  Pattern 2: ${match2 ? '✅ MATCH' : '❌ NO MATCH'}`);
  if (match2) {
    console.log(`    Test: "${match2[1]}", Value: "${match2[2]}", Ref: "${match2[3]}", Unit: "${match2[4]}", Status: "${match2[5]}"`);
  }

  const match3 = line.match(pattern3);
  console.log(`  Pattern 3: ${match3 ? '✅ MATCH' : '❌ NO MATCH'}`);
  if (match3) {
    console.log(`    Test: "${match3[1]}", Value: "${match3[2]}", Ref: "${match3[3]}", Unit: "${match3[4]}", Status: "${match3[5]}"`);
  }

  console.log('');
});
