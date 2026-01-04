#!/usr/bin/env node
/**
 * Environment Variable Security Validation Script
 *
 * Prevents accidental exposure of sensitive API keys in client-side code.
 * This script validates that no sensitive keys use the VITE_ prefix,
 * which would cause them to be bundled into the client JavaScript.
 *
 * Run automatically before builds and dev server starts.
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Patterns that should NEVER have VITE_ prefix (will be exposed in client bundle)
const FORBIDDEN_PATTERNS = [
  /^VITE_.*API_KEY/,        // Any API key
  /^VITE_.*SECRET/,         // Any secret
  /^VITE_.*TOKEN/,          // Any token (except anon keys which are safe)
  /^VITE_.*PASSWORD/,       // Any password
  /^VITE_.*PRIVATE/,        // Any private key
  /^VITE_AWS_ACCESS_KEY/,   // AWS credentials
  /^VITE_AWS_SECRET/,       // AWS credentials
  /^VITE_AZURE.*KEY$/,      // Azure keys (endpoint URLs are okay)
  /^VITE_OPENAI_API_KEY/,   // OpenAI API key
  /^VITE_DEEPGRAM_API_KEY/, // Deepgram API key
  /^VITE_ELEVENLABS_API_KEY/, // ElevenLabs API key
];

// Safe VITE_ variables (okay to expose in client)
const SAFE_VITE_PATTERNS = [
  /^VITE_SUPABASE_ANON_KEY/,  // Supabase anon key is safe (protected by RLS)
  /^VITE_STRIPE_PUBLISHABLE_KEY/, // Stripe publishable key is safe
  /^VITE_.*_URL/,             // URLs are generally safe
  /^VITE_.*_ENDPOINT/,        // Endpoints are safe
  /^VITE_ENABLE_/,            // Feature flags are safe
  /^VITE_.*_MODE$/,           // Mode settings are safe
  /^VITE_.*_MODEL/,           // AI model names are safe
  /^VITE_.*_LANGUAGE/,        // Language settings are safe
  /^VITE_.*_DEPLOYMENT/,      // Deployment names are safe
  /^VITE_.*_VERSION/,         // Version strings are safe
  /^VITE_.*_ID$/,             // IDs (like voice IDs) are generally safe
  /^VITE_.*_MINUTES/,         // Timeout settings are safe
  /^VITE_.*_CENTS/,           // Price settings are safe
  /^VITE_PRIMARY_/,           // Provider selection flags are safe
];

function isSafeVariable(varName) {
  // Check if it matches any safe pattern
  return SAFE_VITE_PATTERNS.some(pattern => pattern.test(varName));
}

function validateEnvFile(envPath) {
  console.log(`${colors.cyan}🔍 Validating environment variables in: ${envPath}${colors.reset}\n`);

  if (!fs.existsSync(envPath)) {
    console.log(`${colors.yellow}⚠️  No .env file found - skipping validation${colors.reset}`);
    return true;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) {
      return;
    }

    // Extract variable name (part before =)
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (!match) {
      return;
    }

    const varName = match[1];

    // Check if it matches a forbidden pattern
    const isForbidden = FORBIDDEN_PATTERNS.some(pattern => pattern.test(varName));

    if (isForbidden && !isSafeVariable(varName)) {
      violations.push({
        line: index + 1,
        varName,
        content: line.split('=')[0]
      });
    }
  });

  if (violations.length > 0) {
    console.log(`${colors.red}❌ SECURITY VIOLATION: Sensitive keys exposed with VITE_ prefix!${colors.reset}\n`);
    console.log(`${colors.red}These variables will be bundled into client-side JavaScript and exposed in the browser:${colors.reset}\n`);

    violations.forEach(v => {
      console.log(`  ${colors.red}Line ${v.line}:${colors.reset} ${v.varName}`);
    });

    console.log(`\n${colors.yellow}💡 Fix:${colors.reset}`);
    console.log(`  1. Remove the VITE_ prefix from these variables`);
    console.log(`  2. Keep them server-side only`);
    console.log(`  3. Use server-side proxy endpoints instead of direct client calls\n`);

    console.log(`${colors.cyan}Example:${colors.reset}`);
    console.log(`  ${colors.red}❌ VITE_OPENAI_API_KEY=sk-...${colors.reset} (exposed in browser!)`);
    console.log(`  ${colors.green}✅ OPENAI_API_KEY=sk-...${colors.reset} (server-side only)\n`);

    return false;
  }

  console.log(`${colors.green}✅ Environment validation passed - no exposed secrets${colors.reset}\n`);
  return true;
}

// Main execution
const envPath = path.join(process.cwd(), '.env');
const isValid = validateEnvFile(envPath);

if (!isValid) {
  console.log(`${colors.red}Build blocked due to security violations.${colors.reset}\n`);
  process.exit(1);
}

process.exit(0);
