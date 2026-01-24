/**
 * CORS Configuration Middleware
 * Environment-aware CORS settings
 * HIPAA Compliance: Restricts access to authorized origins only
 */

const logger = require('../logger');

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production: Only allow specific domains
    const productionOrigins = [
      'https://www.tshla.ai',
      'https://tshla.ai',
      'https://mango-sky-0ba265c0f.1.azurestaticapps.net',
      process.env.FRONTEND_URL,
      process.env.VITE_APP_URL
    ].filter(Boolean); // Remove null/undefined

    logger.info('CORS', 'Production CORS configured', {
      origins: productionOrigins.length
    });

    return productionOrigins;
  } else {
    // Development: Allow localhost
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    ];

    logger.info('CORS', 'Development CORS configured', {
      origins: devOrigins.length
    });

    return devOrigins;
  }
}

/**
 * CORS options configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      logger.debug('CORS', 'Origin allowed', { origin });
      callback(null, true);
    } else {
      logger.warn('CORS', 'Origin blocked', {
        origin,
        allowed: allowedOrigins
      });
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Session-Id'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours - how long to cache preflight requests
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

module.exports = {
  corsOptions,
  getAllowedOrigins
};
