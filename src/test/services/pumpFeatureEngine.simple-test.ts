/**
 * Simple test for PumpFeatureEngine - No external dependencies
 */

import { pumpFeatureEngine } from './pumpFeatureEngine.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Tech-Savvy User',
    answers: {
      primary_priority: 'technology',
      form_factor: 'either',
      tech_comfort: 'high',
      control_philosophy: 'full_auto',
      activity_level: 'moderately_active'
    }
  },
  {
    name: 'Simplicity-Focused User', 
    answers: {
      primary_priority: 'simplicity',
      form_factor: 'tubeless',
      tech_comfort: 'low',
      control_philosophy: 'wake_me',
      activity_level: 'less_active'
    }
  },
  {
    name: 'Active Lifestyle User',
    answers: {
      primary_priority: 'lifestyle',
      form_factor: 'tubeless', 
      tech_comfort: 'medium',
      control_philosophy: 'alert_auto',
      activity_level: 'very_active'
    }
  },
  {
    name: 'Budget-Conscious User',
    answers: {
      primary_priority: 'cost',
      form_factor: 'tubing',
      tech_comfort: 'medium',
      budget_reality: 'upfront'
    }
  }
];

logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});

// Test each scenario
for (const scenario of TEST_SCENARIOS) {
  logInfo('pumpFeatureEngine.simple-test', 'Info message', {});
  
  try {
    const recommendations = pumpFeatureEngine.getRecommendations(scenario.answers);
    
    logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});
    logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});}%)`).join(', ')}`);
    logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});}`);
    
  } catch (error) {
    logError('pumpFeatureEngine.simple-test', 'Error message', {});
  }
  
  logDebug('pumpFeatureEngine.simple-test', 'Debug output', { data: data: "placeholder" }); // Blank line
}

// Bias test
logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});

const pumpCounts = new Map<string, number>();
const totalTests = 50;

for (let i = 0; i < totalTests; i++) {
  const randomAnswers = generateRandomAnswers();
  const recommendations = pumpFeatureEngine.getRecommendations(randomAnswers);
  
  const topPump = recommendations.topChoice.pump.name;
  pumpCounts.set(topPump, (pumpCounts.get(topPump) || 0) + 1);
}

logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});
const sortedResults = Array.from(pumpCounts.entries())
  .sort((a, b) => b[1] - a[1]);

for (const [pump, count] of sortedResults) {
  const percentage = ((count / totalTests) * 100).toFixed(1);
  logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});
}

// Check for extreme bias
const topPumpCount = sortedResults[0]?.[1] || 0;
const expectedAverage = totalTests / sortedResults.length;

if (topPumpCount > expectedAverage * 2) {
  logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});
} else {
  logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});
}

function generateRandomAnswers(): Record<string, string> {
  const options = {
    primary_priority: ['simplicity', 'technology', 'cost', 'lifestyle'],
    form_factor: ['tubeless', 'tubing', 'either'],
    tech_comfort: ['low', 'medium', 'high'],
    control_philosophy: ['full_auto', 'alert_auto', 'wake_me', 'alert_only'],
    activity_level: ['very_active', 'moderately_active', 'less_active', 'varies'],
    discretion_needs: ['very_important', 'somewhat_important', 'not_important'],
    budget_reality: ['upfront', 'ongoing', 'insurance', 'not_concerned']
  };

  const answers: Record<string, string> = {};
  for (const [question, choices] of Object.entries(options)) {
    answers[question] = choices[Math.floor(Math.random() * choices.length)];
  }

  return answers;
}

logDebug('pumpFeatureEngine.simple-test', 'Debug message', {});