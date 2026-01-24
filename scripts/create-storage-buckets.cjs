/**
 * Create Supabase Storage Buckets for Patient Portal
 * Created: 2026-01-23
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const BUCKETS = [
  {
    name: 'patient-audio',
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav']
  },
  {
    name: 'patient-documents',
    public: false,
    fileSizeLimit: 26214400, // 25MB
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  }
];

async function createBuckets() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🪣  Creating Supabase Storage Buckets');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📍 Database: ${SUPABASE_URL}\n`);

  for (const bucket of BUCKETS) {
    console.log(`📦 Creating bucket: ${bucket.name}`);
    console.log(`   Public: ${bucket.public}`);
    console.log(`   Max Size: ${(bucket.fileSizeLimit / 1048576).toFixed(0)}MB`);
    console.log(`   Allowed Types: ${bucket.allowedMimeTypes.join(', ')}`);

    // Check if bucket exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.log(`   ❌ Error checking buckets: ${listError.message}`);
      continue;
    }

    const exists = existingBuckets.find(b => b.name === bucket.name);

    if (exists) {
      console.log(`   ✅ Bucket already exists: ${bucket.name}\n`);
      continue;
    }

    // Create bucket
    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes
    });

    if (error) {
      console.log(`   ❌ Error creating bucket: ${error.message}\n`);
    } else {
      console.log(`   ✅ Bucket created successfully: ${bucket.name}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Next Steps:');
  console.log('   1. ✅ Database migrations');
  console.log('   2. ✅ Azure environment variables');
  console.log('   3. ✅ Storage buckets');
  console.log('   4. Seed test data: node scripts/seed-patient-portal-data.js');
  console.log('═══════════════════════════════════════════════════════════\n');
}

createBuckets().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
