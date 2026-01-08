/**
 * Remove Duplicate Appointments Script
 *
 * Issue: Schedule was imported twice on Jan 6, 2026
 * - First import: 5:16 PM
 * - Second import: 7:16 PM
 *
 * This script removes the NEWER duplicates (keeping the older ones)
 *
 * Usage:
 *   node scripts/remove-duplicate-appointments.cjs [--dry-run]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes('--dry-run');

async function removeDuplicates() {
  console.log('🔍 Finding duplicate appointments...\n');

  if (isDryRun) {
    console.log('🔶 DRY RUN MODE - No changes will be made\n');
  }

  // Get ALL appointments (entire database) to find all duplicates
  const { data: allAppointments, error } = await supabase
    .from('provider_schedules')
    .select('id, scheduled_date, start_time, patient_name, provider_id, created_at, status')
    .neq('status', 'cancelled')  // Don't process already cancelled appointments
    .order('scheduled_date')
    .order('start_time')
    .order('created_at');

  if (error) {
    console.error('❌ Error fetching appointments:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${allAppointments.length} total appointments in database\n`);

  // Group by unique appointment key
  const grouped = {};
  allAppointments.forEach(apt => {
    const key = `${apt.scheduled_date}|${apt.start_time}|${apt.patient_name}|${apt.provider_id}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(apt);
  });

  // Find duplicates
  let duplicateCount = 0;
  let idsToDelete = [];

  Object.entries(grouped).forEach(([key, appointments]) => {
    if (appointments.length > 1) {
      duplicateCount++;
      // Sort by created_at (oldest first)
      appointments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Keep the first (oldest), delete the rest
      const toKeep = appointments[0];
      const toDelete = appointments.slice(1);

      console.log(`Duplicate: ${key.split('|').slice(0, 3).join(' | ')}`);
      console.log(`  ✅ Keeping: ID ${toKeep.id} (created ${new Date(toKeep.created_at).toLocaleString()})`);
      toDelete.forEach(apt => {
        console.log(`  ❌ Deleting: ID ${apt.id} (created ${new Date(apt.created_at).toLocaleString()})`);
        idsToDelete.push(apt.id);
      });
      console.log('');
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total appointments: ${allAppointments.length}`);
  console.log(`   Duplicate groups: ${duplicateCount}`);
  console.log(`   Appointments to delete: ${idsToDelete.length}`);
  console.log(`   Appointments to keep: ${allAppointments.length - idsToDelete.length}\n`);

  if (idsToDelete.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  if (isDryRun) {
    console.log('🔶 DRY RUN - Would delete', idsToDelete.length, 'duplicate appointments');
    console.log('Run without --dry-run to actually delete them');
    return;
  }

  // Delete in batches of 100
  console.log('🗑️  Deleting duplicates...\n');
  let deleted = 0;

  for (let i = 0; i < idsToDelete.length; i += 100) {
    const batch = idsToDelete.slice(i, i + 100);
    const { error: deleteError } = await supabase
      .from('provider_schedules')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error(`❌ Error deleting batch ${i / 100 + 1}:`, deleteError);
    } else {
      deleted += batch.length;
      console.log(`✅ Deleted batch ${i / 100 + 1}: ${batch.length} appointments (${deleted}/${idsToDelete.length})`);
    }
  }

  console.log(`\n✅ Done! Deleted ${deleted} duplicate appointments`);
  console.log(`   Remaining appointments: ${allAppointments.length - deleted}`);
}

removeDuplicates().catch(console.error).finally(() => process.exit(0));
