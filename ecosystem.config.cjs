module.exports = {
  apps: [
    {
      name: 'tshla-pump-api',
      script: 'server/pump-report-api.js',
      cwd: '/Users/rakeshpatel/Desktop/tshla-medical',
      env: {
        NODE_ENV: 'development',
        PORT: 3005,
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_DATABASE: 'tshla_medical_local',
        USE_MYSQL: 'true',
        JWT_SECRET: 'tshla-unified-jwt-secret-2025-enhanced-secure-key'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3005
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pump-api-error.log',
      out_file: './logs/pump-api-out.log',
      log_file: './logs/pump-api-combined.log',
      time: true,
      merge_logs: true
    },
    {
      name: 'tshla-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/Users/rakeshpatel/Desktop/tshla-medical',
      env: {
        NODE_ENV: 'development',
        VITE_API_URL: 'http://localhost:3005',
        VITE_PUMP_API_URL: 'http://localhost:3005'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      merge_logs: true
    }
  ]
};
