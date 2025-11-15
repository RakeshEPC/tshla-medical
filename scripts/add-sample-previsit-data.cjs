/**
 * Add sample structured data to imported conversations
 * This simulates what would have been captured if webhooks were configured
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Sample data that would have been captured during calls
const sampleData = [
  {
    medications: ['Metformin 1000mg twice daily', 'Levothyroxine 75mcg daily', 'Vitamin D 2000 IU daily'],
    concerns: ['Blood sugar has been running high in the mornings', 'Feeling more tired than usual'],
    questions: ['Should I adjust my metformin dose?', 'When should I get my next A1C test?']
  },
  {
    medications: ['Insulin glargine 30 units at bedtime', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily'],
    concerns: ['Having some low blood sugars at night', 'Occasional chest tightness'],
    questions: ['Is my insulin dose too high?', 'Do I need a cardiac workup?']
  },
  {
    medications: ['Synthroid 100mcg daily', 'Calcium carbonate 500mg twice daily'],
    concerns: ['Still feeling cold all the time', 'Hair loss continuing'],
    questions: ['Should my thyroid dose be increased?', 'Are these symptoms related to thyroid?']
  },
  {
    medications: ['Jardiance 10mg daily', 'Metformin ER 1000mg twice daily', 'Ozempic 0.5mg weekly'],
    concerns: ['Lost 15 pounds but still have high blood sugar', 'Nausea after Ozempic injection'],
    questions: ['Should we increase Ozempic dose?', 'Can I take something for nausea?']
  },
  {
    medications: ['Testosterone gel 50mg daily', 'Anastrozole 0.5mg twice weekly'],
    concerns: ['Not feeling much improvement in energy', 'Some breast tenderness'],
    questions: ['Should testosterone dose be checked?', 'Is the anastrozole helping?']
  }
];

async function addSampleData() {
  console.log('📝 Adding Sample Pre-Visit Data');
  console.log('================================\n');

  try {
    // Get some successful calls with phone numbers
    const { data: calls, error } = await supabase
      .from('previsit_call_data')
      .select('*')
      .not('phone_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching calls:', error);
      return;
    }

    if (!calls || calls.length === 0) {
      console.log('❌ No calls with phone numbers found');
      return;
    }

    console.log(`✅ Found ${calls.length} calls to add sample data to\n`);

    let updated = 0;

    for (let i = 0; i < calls.length && i < sampleData.length; i++) {
      const call = calls[i];
      const sample = sampleData[i];

      const { error: updateError } = await supabase
        .from('previsit_call_data')
        .update({
          medications: sample.medications,
          concerns: sample.concerns,
          questions: sample.questions,
          urgency_flags: sample.concerns.length > 1 ? ['multiple_concerns'] : []
        })
        .eq('id', call.id);

      if (updateError) {
        console.error(`❌ Failed to update call ${call.id}:`, updateError.message);
      } else {
        console.log(`✅ Updated call ${call.id.substring(0, 8)}...`);
        console.log(`   Phone: ${call.phone_number}`);
        console.log(`   Date: ${new Date(call.created_at).toLocaleDateString()}`);
        console.log(`   Medications: ${sample.medications.length}`);
        console.log(`   Concerns: ${sample.concerns.length}`);
        console.log(`   Questions: ${sample.questions.length}\n`);
        updated++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`Updated ${updated} calls with sample data`);
    console.log(`\n💡 Now go to: http://localhost:5173/previsit-data`);
    console.log(`   You'll see these calls with medications, concerns, and questions!`);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

addSampleData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
