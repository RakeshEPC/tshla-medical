import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
