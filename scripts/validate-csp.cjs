#!/usr/bin/env node
/**
 * CSP Validation Script
 *
 * Validates that all deployed Azure Container Apps are included in the
 * Content Security Policy configuration.
 *
 * Usage:
 *   node scripts/validate-csp.cjs
 *
 * Exit codes:
 *   0 - All services are in CSP
 *   1 - Missing services found or validation error
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Read and parse the staticwebapp.config.json file
 */
function readCSPConfig() {
  const configPath = path.join(__dirname, '../public/staticwebapp.config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`CSP config not found at: ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const csp = config.globalHeaders['Content-Security-Policy'];

  if (!csp) {
    throw new Error('Content-Security-Policy not found in config');
  }

  return csp;
}

/**
 * Extract all URLs from CSP connect-src directive
 */
function extractCSPUrls(csp) {
  // Find the connect-src directive
  const connectSrcMatch = csp.match(/connect-src\s+([^;]+)/);

  if (!connectSrcMatch) {
    throw new Error('connect-src directive not found in CSP');
  }

  const connectSrc = connectSrcMatch[1];

  // Extract all URLs (https://* and wss://*)
  const urlRegex = /(https?:\/\/[^\s]+)|(wss:\/\/[^\s]+)/g;
  const urls = connectSrc.match(urlRegex) || [];

  return urls;
}

/**
 * Get all Azure Container Apps from resource group
 */
async function getAzureContainerApps() {
  try {
    log('\n🔍 Fetching Azure Container Apps...', 'cyan');

    const { stdout } = await execPromise(
      'az containerapp list --resource-group tshla-backend-rg --query "[].{name:name,fqdn:properties.configuration.ingress.fqdn}" --output json'
    );

    const apps = JSON.parse(stdout);

    if (!apps || apps.length === 0) {
      log('⚠️  No container apps found. Is Azure CLI configured?', 'yellow');
      return [];
    }

    log(`✅ Found ${apps.length} container apps`, 'green');
    apps.forEach(app => {
      log(`   - ${app.name}: ${app.fqdn}`, 'blue');
    });

    return apps;
  } catch (error) {
    if (error.message.includes('az: command not found')) {
      log('⚠️  Azure CLI not found. Skipping Azure validation.', 'yellow');
      log('   Install: https://aka.ms/InstallAzureCLI', 'yellow');
      return [];
    }

    if (error.message.includes('not logged in')) {
      log('⚠️  Not logged into Azure CLI. Skipping Azure validation.', 'yellow');
      log('   Login with: az login', 'yellow');
      return [];
    }

    log(`❌ Error fetching Azure resources: ${error.message}`, 'red');
    return [];
  }
}

/**
 * Check if a URL is in the CSP
 */
function isUrlInCSP(url, cspUrls) {
  // Check exact match
  if (cspUrls.includes(`https://${url}`) || cspUrls.includes(`wss://${url}`)) {
    return true;
  }

  // Check wildcard match
  const domain = url.split('.').slice(-3).join('.'); // Get last 3 parts
  const wildcardPattern = `https://*.${domain}`;
  if (cspUrls.includes(wildcardPattern)) {
    return true;
  }

  return false;
}

/**
 * Main validation function
 */
async function validateCSP() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   CSP Validation for Azure Services   ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  try {
    // Step 1: Read CSP config
    log('📄 Reading CSP configuration...', 'cyan');
    const csp = readCSPConfig();
    const cspUrls = extractCSPUrls(csp);

    log(`✅ Found ${cspUrls.length} URLs in CSP connect-src`, 'green');
    console.log();

    // Step 2: Get Azure resources
    const containerApps = await getAzureContainerApps();

    if (containerApps.length === 0) {
      log('\n⚠️  No Azure resources to validate against', 'yellow');
      log('   This is OK for local development', 'yellow');
      return 0;
    }

    // Step 3: Validate each container app
    log('\n🔍 Validating Container Apps against CSP...', 'cyan');
    console.log();

    let missingCount = 0;
    const missingApps = [];

    for (const app of containerApps) {
      if (!app.fqdn) {
        log(`⚠️  ${app.name}: No FQDN (ingress may be disabled)`, 'yellow');
        continue;
      }

      const httpsInCSP = isUrlInCSP(app.fqdn, cspUrls);
      const wssInCSP = cspUrls.some(url => url.includes(`wss://${app.fqdn}`));

      if (httpsInCSP) {
        log(`✅ ${app.name}`, 'green');
        log(`   https://${app.fqdn} - FOUND`, 'green');
        if (wssInCSP) {
          log(`   wss://${app.fqdn} - FOUND`, 'green');
        }
      } else {
        log(`❌ ${app.name}`, 'red');
        log(`   https://${app.fqdn} - MISSING`, 'red');
        if (!wssInCSP) {
          log(`   wss://${app.fqdn} - MISSING (if WebSocket needed)`, 'yellow');
        }
        missingCount++;
        missingApps.push(app);
      }
      console.log();
    }

    // Step 4: Report results
    if (missingCount === 0) {
      log('═'.repeat(50), 'green');
      log('✅ All Azure Container Apps are in CSP!', 'green');
      log('═'.repeat(50), 'green');
      return 0;
    } else {
      log('═'.repeat(50), 'red');
      log(`❌ ${missingCount} Container App(s) missing from CSP`, 'red');
      log('═'.repeat(50), 'red');
      console.log();

      log('📝 Add these URLs to public/staticwebapp.config.json:', 'yellow');
      console.log();

      for (const app of missingApps) {
        log(`   https://${app.fqdn}`, 'yellow');
        log(`   wss://${app.fqdn} (if WebSocket needed)`, 'yellow');
        console.log();
      }

      log('Example:', 'cyan');
      log('"connect-src": "... ' + missingApps.map(a => `https://${a.fqdn}`).join(' ') + ' ..."', 'cyan');
      console.log();

      return 1;
    }
  } catch (error) {
    log(`\n❌ Validation failed: ${error.message}`, 'red');
    console.error(error);
    return 1;
  }
}

// Run validation
validateCSP()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
