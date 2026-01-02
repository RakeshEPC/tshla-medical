/**
 * Daily Knowledge Base Cleanup Job
 * Removes orphaned patient documents from ElevenLabs Knowledge Base
 *
 * Orphaned documents occur when:
 * - Call cleanup webhook fails
 * - Server crashes before cleanup completes
 * - Network issues prevent deletion
 *
 * This job runs daily to ensure KB doesn't accumulate stale patient data
 *
 * Usage:
 *   node server/jobs/cleanup-kb-documents.js
 *
 * Or via cron:
 *   0 2 * * * cd /path/to/app && node server/jobs/cleanup-kb-documents.js
 *
 * Created: 2026-01-01
 */

require('dotenv').config();
const kbService = require('../services/elevenLabsKnowledgeBase.service');

async function main() {
  console.log('\n🧹 Knowledge Base Daily Cleanup Job');
  console.log('=====================================');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Check if ElevenLabs API is configured
    if (!process.env.ELEVENLABS_API_KEY && !process.env.VITE_ELEVENLABS_API_KEY) {
      console.log('⚠️  ELEVENLABS_API_KEY not configured - skipping cleanup');
      process.exit(0);
    }

    console.log('✅ ElevenLabs API configured');
    console.log('');

    // Run cleanup
    const deletedCount = await kbService.cleanupOldDocuments();

    console.log('');
    console.log('✅ Cleanup Job Complete');
    console.log('=====================================');
    console.log(`Documents deleted: ${deletedCount}`);
    console.log(`Completed: ${new Date().toISOString()}`);
    console.log('');

    if (deletedCount > 0) {
      console.log(`⚠️  Found ${deletedCount} orphaned documents`);
      console.log('   This might indicate webhook delivery issues');
      console.log('   Consider checking:');
      console.log('   - ElevenLabs webhook configuration');
      console.log('   - Twilio status callback configuration');
      console.log('   - Server logs for cleanup failures');
    } else {
      console.log('✅ No orphaned documents - cleanup system working correctly');
    }

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Cleanup Job Failed');
    console.error('=====================================');
    console.error(`Error: ${error.message}`);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');

    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
