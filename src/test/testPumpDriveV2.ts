/**
 * Test script for PumpDrive Enhanced V2 Service
 * Verifies the integration with comprehensive pump database
 */

import { pumpDriveEnhancedServiceV2 } from '../services/pumpDriveEnhancedV2.service';
import { pumpDataManagerService } from '../services/pumpDataManager.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

// Test 1: Extract patient needs from sample transcript
logDebug('App', 'Debug message', {});
const sampleTranscript = `I swim every day at the YMCA pool and I really need something waterproof. 
I also travel a lot for work and don't want to carry a bunch of supplies. 
My phone is always with me and I'd love to control everything from it. 
I hate dealing with tubing getting caught on things.`;

const extractedNeeds = pumpDataManagerService.extractPatientNeeds(sampleTranscript);
logDebug('App', 'Debug message', {});

// Test 2: Get pump context for lifestyle category
logDebug('App', 'Getting pump context for lifestyle category');
const lifestyleContext = pumpDataManagerService.getPumpContextForCategory('lifestyle');
logDebug('App', 'Lifestyle context retrieved', { lifestyleContext });
logDebug('App', 'Context preview', lifestyleContext.toString().substring(0, 100) + '...');

// Test 3: Score pumps based on patient needs
logDebug('App', 'Debug message', {});
const scores = pumpDataManagerService.scorePumpsForPatient('lifestyle', extractedNeeds);
logDebug('App', 'Debug message', {});
scores.slice(0, 3).forEach((pump, i) => {
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
});

// Test 4: Generate pump comparison
logDebug('App', 'Debug message', {});
const comparison = pumpDataManagerService.generatePumpComparison('omnipod-5', 'tandem-mobi', [
  'waterResistance',
  'phoneControl',
  'tubingStyle',
]);
logDebug('App', 'Debug message', {});
comparison.forEach(comp => {
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  if (comp.winner) logDebug('App', 'Debug message', {});
  if (comp.explanation) logDebug('App', 'Debug message', {});
});

// Test 5: Get comprehensive pump summary
logDebug('App', 'Debug message', {});
const pumpSummary = pumpDataManagerService.getPumpSummaryForRecommendation('omnipod-5');
logDebug('App', 'Debug output', { data: "placeholder" });

logDebug('App', 'Debug message', {});
logDebug('App', 'Debug message', {});
