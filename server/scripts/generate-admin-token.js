/**
 * Generate Admin JWT Token for Testing
 */

const jwt = require('jsonwebtoken');

// Use the same JWT secret as pump-report-api.js
const JWT_SECRET = process.env.JWT_SECRET || 'tshla-unified-jwt-secret-2025-enhanced-secure-key';

// Create admin token
const adminPayload = {
  userId: 1,
  email: 'rakesh@tshla.ai',
  username: 'rakesh',
  role: 'admin',
  accessType: 'medical'
};

const token = jwt.sign(adminPayload, JWT_SECRET, {
  expiresIn: '8h' // Valid for 8 hours
});

console.log('\n✅ Admin Token Generated:\n');
console.log(token);
console.log('\n📋 Copy this token and use it in Authorization header:');
console.log(`Authorization: Bearer ${token}`);
console.log('\n🧪 Test the API:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3002/api/admin/pump-comparison-data`);
console.log('');
