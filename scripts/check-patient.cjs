/**
 * Check patient record
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tshlaId = 'TSH123001';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPatient() {
  try {
    console.log('🔍 Checking patient records for:', tshlaId, '\n');

    // Try exact match
    const { data: exact, error: exactError } = await supabase
      .from('unified_patients')
      .select('*')
      .eq('tshla_id', tshlaId);

    console.log('Exact match (TSH123001):', exact?.length || 0, 'rows');
    if (exact && exact.length > 0) {
      exact.forEach((p, i) => {
        console.log(`  Row ${i + 1}:`, p.id, '-', p.first_name, p.last_name, '-', p.tshla_id);
      });
    }
    if (exactError) console.log('Error:', exactError.message);

    // Try formatted
    const { data: formatted } = await supabase
      .from('unified_patients')
      .select('*')
      .eq('tshla_id', 'TSH 123-001');

    console.log('\nFormatted match (TSH 123-001):', formatted?.length || 0, 'rows');
    if (formatted && formatted.length > 0) {
      formatted.forEach((p, i) => {
        console.log(`  Row ${i + 1}:`, p.id, '-', p.first_name, p.last_name, '-', p.tshla_id);
      });
    }

    // Search for any TSH with 123 and 001
    const { data: like } = await supabase
      .from('unified_patients')
      .select('*')
      .or('tshla_id.like.%123%001%,tshla_id.like.%123-001%');

    console.log('\nLike search (%123%001%):', like?.length || 0, 'rows');
    if (like && like.length > 0) {
      like.forEach((p, i) => {
        console.log(`  Row ${i + 1}:`, p.id, '-', p.first_name, p.last_name, '-', p.tshla_id);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPatient();
