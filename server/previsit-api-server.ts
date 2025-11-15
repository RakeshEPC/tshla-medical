/**
 * Pre-Visit API Server
 * Express server for Twilio/11Labs webhooks and cron scheduler
 * Created: January 2025
 *
 * Run with: npx tsx server/previsit-api-server.ts
 * Or with PM2: pm2 start server/previsit-api-server.ts --name previsit-api --interpreter tsx
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import webhook handlers
import setupTwiMLRoute from './api/twilio/previsit-twiml';
import setupCallStatusRoute from './api/twilio/call-status';
import setupConversationCompleteRoute from './api/elevenlabs/conversation-complete';

// Import scheduler
import previsitScheduler from './jobs/schedulePreVisitCalls';

// =====================================================
// EXPRESS SERVER SETUP
// =====================================================

const app = express();
const PORT = process.env.PREVISIT_API_PORT || 3100;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Pre-Visit API Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'TSHLA Medical - Pre-Visit API Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      twilio_twiml: 'POST /api/twilio/previsit-twiml',
      twilio_status: 'POST /api/twilio/call-status',
      elevenlabs_complete: 'POST /api/elevenlabs/conversation-complete',
    },
    scheduler: {
      status: 'running',
      schedule: 'Every hour (business hours only)',
      timezone: 'America/New_York',
    },
  });
});

// =====================================================
// REGISTER WEBHOOK ROUTES
// =====================================================

setupTwiMLRoute(app);
setupCallStatusRoute(app);
setupConversationCompleteRoute(app);

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// =====================================================
// START SERVER
// =====================================================

function startServer() {
  app.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 PRE-VISIT API SERVER STARTED');
    console.log('='.repeat(70));
    console.log('');
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('   Endpoints:');
    console.log(`   - POST /api/twilio/previsit-twiml`);
    console.log(`   - POST /api/twilio/call-status`);
    console.log(`   - POST /api/elevenlabs/conversation-complete`);
    console.log('');
    console.log('   Environment:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - Supabase: ${process.env.VITE_SUPABASE_URL ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   - Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   - 11Labs: ${process.env.ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   - Klara: ${process.env.KLARA_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log('');

    // Start the cron scheduler
    if (process.env.ENABLE_SCHEDULER !== 'false') {
      console.log('   Starting cron scheduler...');
      previsitScheduler.startScheduler();
    } else {
      console.log('   ⏸️  Scheduler disabled (ENABLE_SCHEDULER=false)');
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('');
  });
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

process.on('SIGINT', () => {
  console.log('\n\n' + '='.repeat(70));
  console.log('⏹️  SHUTTING DOWN PRE-VISIT API SERVER');
  console.log('='.repeat(70));

  previsitScheduler.stopScheduler();

  console.log('✅ Graceful shutdown complete');
  console.log('='.repeat(70) + '\n');

  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n' + '='.repeat(70));
  console.log('⏹️  SHUTTING DOWN PRE-VISIT API SERVER (SIGTERM)');
  console.log('='.repeat(70));

  previsitScheduler.stopScheduler();

  console.log('✅ Graceful shutdown complete');
  console.log('='.repeat(70) + '\n');

  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('   Promise:', promise);
});

// =====================================================
// START THE SERVER
// =====================================================

startServer();

export default app;
