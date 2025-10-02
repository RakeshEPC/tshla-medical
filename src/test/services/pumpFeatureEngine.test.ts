/**
 * Test file for PumpFeatureEngine
 * Validates the new recommendation system accuracy
 */

import { pumpFeatureEngine } from './pumpFeatureEngine.service';
import { pumpDriveFeatureBasedService } from './pumpDriveFeatureBased.service';

// Test scenarios representing different user types
const TEST_SCENARIOS = [
  {
    name: 'Tech-Savvy Automation Seeker',
    answers: {
      primary_priority: 'technology',
      form_factor: 'either',
      tech_comfort: 'high',
      control_philosophy: 'full_auto',
      activity_level: 'moderately_active',
      discretion_needs: 'somewhat_important',
      budget_reality: 'not_concerned',
    },
    expectedTopFeatures: ['algorithm', 'phoneControl', 'cgmIntegration', 'customAlerts'],
  },
  {
    name: 'Simplicity-Focused User',
    answers: {
      primary_priority: 'simplicity',
      form_factor: 'tubeless',
      tech_comfort: 'low',
      control_philosophy: 'wake_me',
      activity_level: 'less_active',
      discretion_needs: 'very_important',
      budget_reality: 'ongoing',
    },
    expectedTopFeatures: ['tubeless', 'setupTime', 'userInterface', 'supportAvailability'],
  },
  {
    name: 'Active Lifestyle User',
    answers: {
      primary_priority: 'lifestyle',
      form_factor: 'tubeless',
      tech_comfort: 'medium',
      control_philosophy: 'alert_auto',
      activity_level: 'very_active',
      discretion_needs: 'very_important',
      budget_reality: 'insurance',
    },
    expectedTopFeatures: ['waterproof', 'tubeless', 'size', 'tempBasal'],
  },
  {
    name: 'Budget-Conscious User',
    answers: {
      primary_priority: 'cost',
      form_factor: 'tubing',
      tech_comfort: 'medium',
      control_philosophy: 'alert_only',
      activity_level: 'moderately_active',
      discretion_needs: 'not_important',
      budget_reality: 'upfront',
    },
    expectedTopFeatures: ['warranty', 'battery', 'insulinCapacity'],
  },
];

class PumpFeatureEngineTest {
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting PumpFeatureEngine Tests\n');

    for (const scenario of TEST_SCENARIOS) {
      await this.testScenario(scenario);
      console.log(''); // Blank line between tests
    }

    await this.testBiasDetection();
    await this.testFeatureMapping();

    console.log('✅ All tests completed!');
  }

  private async testScenario(scenario: any): Promise<void> {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log(`   Answers: ${JSON.stringify(scenario.answers, null, 2).slice(0, 100)}...`);

    try {
      // Test feature engine
      const recommendations = pumpFeatureEngine.getRecommendations(scenario.answers);

      console.log(
        `   🏆 Top Choice: ${recommendations.topChoice.pump.name} (${recommendations.topChoice.score}%)`
      );
      console.log(
        `   📊 Alternatives: ${recommendations.alternatives.map(a => `${a.pump.name} (${a.score}%)`).join(', ')}`
      );

      // Test full service
      const fullRecommendation = await pumpDriveFeatureBasedService.generateRecommendations(
        scenario.answers
      );

      console.log(`   🎯 Confidence: ${fullRecommendation.decisionSummary.confidence}%`);
      console.log(
        `   ⭐ Key Features: ${fullRecommendation.topRecommendation.keyFeatures.slice(0, 3).join(', ')}`
      );

      // Validate expected features are being considered
      this.validateExpectedFeatures(scenario, recommendations);
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }
  }

  private validateExpectedFeatures(scenario: any, recommendations: any): void {
    // Check if user profile has the expected features
    const userProfile = new Map();
    pumpFeatureEngine['userProfile'] = userProfile; // Access private property for testing
    pumpFeatureEngine.processAnswers(scenario.answers);

    const profileKeys = Array.from(pumpFeatureEngine['userProfile'].keys());
    const expectedFound = scenario.expectedTopFeatures.filter((feature: string) =>
      profileKeys.includes(feature as any)
    );

    if (expectedFound.length > 0) {
      console.log(`   ✅ Expected features found: ${expectedFound.join(', ')}`);
    } else {
      console.log(`   ⚠️  Expected features missing: ${scenario.expectedTopFeatures.join(', ')}`);
    }
  }

  private async testBiasDetection(): Promise<void> {
    console.log('🔍 Testing for Bias in Recommendations\n');

    const pumpCounts = new Map<string, number>();
    const totalTests = 50;

    // Run random scenarios
    for (let i = 0; i < totalTests; i++) {
      const randomAnswers = this.generateRandomAnswers();
      const recommendations = pumpFeatureEngine.getRecommendations(randomAnswers);

      const topPump = recommendations.topChoice.pump.name;
      pumpCounts.set(topPump, (pumpCounts.get(topPump) || 0) + 1);
    }

    console.log('   🎲 Random Test Results (50 scenarios):');
    const sortedResults = Array.from(pumpCounts.entries()).sort((a, b) => b[1] - a[1]);

    for (const [pump, count] of sortedResults) {
      const percentage = ((count / totalTests) * 100).toFixed(1);
      console.log(`   ${pump}: ${count} wins (${percentage}%)`);
    }

    // Check for extreme bias
    const topPumpCount = sortedResults[0]?.[1] || 0;
    const expectedAverage = totalTests / sortedResults.length;

    if (topPumpCount > expectedAverage * 2) {
      console.log(
        `   ⚠️  Possible bias detected: ${sortedResults[0][0]} wins ${((topPumpCount / totalTests) * 100).toFixed(1)}% of the time`
      );
    } else {
      console.log(
        `   ✅ No extreme bias detected (top pump: ${((topPumpCount / totalTests) * 100).toFixed(1)}%)`
      );
    }
  }

  private generateRandomAnswers(): Record<string, string> {
    const options = {
      primary_priority: ['simplicity', 'technology', 'cost', 'lifestyle'],
      form_factor: ['tubeless', 'tubing', 'either'],
      tech_comfort: ['low', 'medium', 'high'],
      control_philosophy: ['full_auto', 'alert_auto', 'wake_me', 'alert_only'],
      activity_level: ['very_active', 'moderately_active', 'less_active', 'varies'],
      discretion_needs: ['very_important', 'somewhat_important', 'not_important'],
      budget_reality: ['upfront', 'ongoing', 'insurance', 'not_concerned'],
    };

    const answers: Record<string, string> = {};
    for (const [question, choices] of Object.entries(options)) {
      answers[question] = choices[Math.floor(Math.random() * choices.length)];
    }

    return answers;
  }

  private async testFeatureMapping(): Promise<void> {
    console.log('🔗 Testing Feature Mapping Accuracy\n');

    // Test specific mappings
    const mappingTests = [
      {
        name: 'Tubeless preference should favor Omnipod 5',
        answers: { form_factor: 'tubeless', primary_priority: 'lifestyle' },
        expectHighScore: ['Omnipod 5'],
      },
      {
        name: 'Technology preference should favor advanced pumps',
        answers: { primary_priority: 'technology', tech_comfort: 'high' },
        expectHighScore: ['Tandem t:slim X2', 'Medtronic 780G'],
      },
      {
        name: 'Simplicity preference should favor easy-to-use pumps',
        answers: { primary_priority: 'simplicity', tech_comfort: 'low' },
        expectHighScore: ['Omnipod DASH', 'Medtronic 780G'],
      },
    ];

    for (const test of mappingTests) {
      console.log(`   📝 ${test.name}`);

      const recommendations = pumpFeatureEngine.getRecommendations(test.answers);
      const topPumps = recommendations.alternatives.slice(0, 3);
      topPumps.unshift(recommendations.topChoice);

      const topPumpNames = topPumps.map(p => p.pump.name);
      const foundExpected = test.expectHighScore.some(expected => topPumpNames.includes(expected));

      if (foundExpected) {
        console.log(`   ✅ Expected pump in top results: ${topPumpNames[0]}`);
      } else {
        console.log(`   ⚠️  Expected pumps not in top results`);
        console.log(`       Expected: ${test.expectHighScore.join(', ')}`);
        console.log(`       Got: ${topPumpNames.join(', ')}`);
      }
    }
  }
}

// Export for testing
export const pumpFeatureEngineTest = new PumpFeatureEngineTest();

// Auto-run if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  pumpFeatureEngineTest.runAllTests().catch(console.error);
}
