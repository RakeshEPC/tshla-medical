import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'fs';
import * as path from 'path';

// Validation plugin to ensure critical files are in dist/ after build
function validateBuildPlugin() {
  return {
    name: 'validate-build',
    closeBundle() {
      console.log('\n🔍 Validating build output...');

      const distPath = path.resolve(__dirname, 'dist');
      const configPath = path.join(distPath, 'staticwebapp.config.json');

      // Check staticwebapp.config.json exists
      if (!fs.existsSync(configPath)) {
        console.error('\n❌ CRITICAL BUILD ERROR:');
        console.error('   staticwebapp.config.json is missing from dist/');
        console.error('   This will cause 404 errors on /admin/* routes in production!');
        console.error('\n   Root cause: File must be in public/ folder to be copied to dist/');
        console.error('   See: DEPLOYMENT_FAILURES.md #5\n');
        throw new Error('Build validation failed: staticwebapp.config.json missing');
      }

      console.log('✅ staticwebapp.config.json present in dist/');
      console.log('✅ Build validation passed\n');
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), validateBuildPlugin()],
  server: {
    proxy: {
      '/api/schedules': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ['microsoft-cognitiveservices-speech-sdk'],
      output: {
        manualChunks: undefined,
      },
    },
  },
  define: {
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'window',
  },
  resolve: {
    alias: {
      process: 'process/browser',
      buffer: 'buffer',
      stream: 'stream-browserify',
      util: 'util',
      // Use browser stub for database client in production
      './lib/db/client': './lib/db/client.browser',
      '../lib/db/client': '../lib/db/client.browser',
      '../../lib/db/client': '../../lib/db/client.browser',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
