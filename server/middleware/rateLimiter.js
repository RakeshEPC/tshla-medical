/**
 * Rate Limiting Middleware
 * Prevents brute force attacks, API abuse, and DoS
 * HIPAA Compliance: Protects PHI endpoints from unauthorized access attempts
 */

const rateLimit = require('express-rate-limit');
const logger = require('../logger');

/**
 * Strict rate limit for authentication endpoints
 * Prevents brute force password attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes per IP
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
    retryAfter: 15 * 60
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false,
  handler: (req, res) => {
    logger.warn('RateLimit', 'Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes',
      retryAfter: 15 * 60
    });
  }
});

/**
 * General API rate limiter
 * Prevents API abuse and DoS attacks
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('RateLimit', 'API rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again'
    });
  }
});

/**
 * Stricter limit for PHI-sensitive endpoints
 * Extra protection for patient data endpoints
 */
const phiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    error: 'Too many requests to sensitive endpoint',
    message: 'Rate limit exceeded for this resource'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('RateLimit', 'PHI endpoint rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      user: req.user?.email
    });
    res.status(429).json({
      error: 'Too many requests to sensitive endpoint',
      message: 'Rate limit exceeded'
    });
  }
});

/**
 * Very strict for registration/account creation
 * Prevents automated account creation and spam
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 account creations per hour per IP
  message: {
    error: 'Too many account creation attempts',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn('RateLimit', 'Registration rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email
    });
    res.status(429).json({
      error: 'Too many account creation attempts',
      message: 'Please try again in 1 hour',
      retryAfter: 60 * 60
    });
  }
});

/**
 * Limit for file uploads
 * Prevents upload spam and DoS
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 file uploads per 15 minutes
  message: {
    error: 'Too many file uploads',
    message: 'Please wait before uploading more files'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('RateLimit', 'Upload rate limit exceeded', {
      ip: req.ip,
      user: req.user?.email
    });
    res.status(429).json({
      error: 'Too many file uploads',
      message: 'Please try again in 15 minutes'
    });
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  phiLimiter,
  registrationLimiter,
  uploadLimiter
};
