// Quick debug script to check what's in Supabase templates table
console.log('Checking Supabase templates table...\n');

// Simulating the query that doctorProfile.service.ts uses
const query = `
SELECT 
  id, 
  name, 
  staff_id, 
  is_system_template,
  created_at,
  updated_at
FROM templates
ORDER BY created_at DESC
LIMIT 20;
`;

console.log('This is the query the app should be running:');
console.log(query);
console.log('\nGo to Supabase Dashboard → SQL Editor');
console.log('Run this query and tell me:');
console.log('1. How many rows are returned?');
console.log('2. Do you see the "rakesh" template?');
console.log('3. What is the staff_id value for "rakesh"?');
console.log('4. Are there OTHER templates with the same staff_id?');
