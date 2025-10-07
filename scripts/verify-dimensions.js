import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error, count } = await supabase
  .from('pump_comparison_data')
  .select('dimension_number, dimension_name, category', { count: 'exact' })
  .order('dimension_number');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log(`\n📊 Total dimensions in database: ${count}/23\n`);
console.log('='.repeat(80));

data.forEach(d => {
  const category = d.category || 'Uncategorized';
  console.log(`✅ ${String(d.dimension_number).padStart(2)}. ${d.dimension_name.padEnd(40)} [${category}]`);
});

console.log('='.repeat(80));

if (count === 23) {
  console.log('\n🎉 SUCCESS! All 23 pump dimensions are in Supabase!\n');
} else {
  console.log(`\n⚠️  Only ${count} of 23 dimensions found\n`);
}
