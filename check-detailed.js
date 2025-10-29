import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://minvvjdflezibmgkplqb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDE5ODgsImV4cCI6MjA3MTYxNzk4OH0.-qzlS3artX2DWOVQgIqwd1jd3Utlnik6yOMFhyGcHl8'
);

async function check() {
  const { data, error, count } = await supabase
    .from('provider_schedules')
    .select('scheduled_date, provider_name, provider_id, patient_name', { count: 'exact' });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('✅ TOTAL:', count, 'records\n');
  
  if (count > 0 && data) {
    const byDate = {};
    data.forEach(apt => {
      if (!byDate[apt.scheduled_date]) byDate[apt.scheduled_date] = 0;
      byDate[apt.scheduled_date]++;
    });
    
    console.log('By Date:');
    Object.keys(byDate).sort().forEach(date => {
      console.log(`  ${date}: ${byDate[date]}`);
    });
    
    console.log('\nSample:');
    console.table(data.slice(0, 5));
  }
}

check();
