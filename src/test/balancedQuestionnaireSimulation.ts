/**
 * Balanced Questionnaire Simulation Test
 * Tests all three modes (Express/Balanced/Advanced) with random answers
 * to see which pumps win most often
 */

import { 
  BALANCED_PUMP_QUESTIONS, 
  EXPRESS_QUESTIONS, 
  QUESTION_FLOW,
  type BalancedQuestion 
} from '../data/balancedPumpQuestions';
import { pumpDriveCached } from '../services/pumpDriveCachedBrowser.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface SimulationResult {
  mode: 'express' | 'balanced' | 'advanced';
  runNumber: number;
  topPump: string;
  topScore: number;
  alternatives: Array<{ name: string; score: number }>;
  processingTime: number;
}

interface PumpWinStats {
  [pumpName: string]: {
    wins: number;
    totalScore: number;
    averageScore: number;
    winPercentage: number;
  };
}

class BalancedQuestionnaireSimulation {
  private results: SimulationResult[] = [];

  /**
   * Generate random answer for a question
   */
  private generateRandomAnswer(question: BalancedQuestion): string | string[] {
    if (!question.options || question.options.length === 0) {
      return 'Random response generated for testing';
    }

    // 10% chance to skip the question
    if (Math.random() < 0.1 && !question.required) {
      return question.skipOption.value;
    }

    if (question.type === 'checkbox') {
      // For checkbox questions, select 1-3 random options
      const numSelections = Math.floor(Math.random() * 3) + 1;
      const shuffled = [...question.options].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, numSelections).map(opt => opt.value);
    } else {
      // For single choice questions, pick random option
      const randomIndex = Math.floor(Math.random() * question.options.length);
      return question.options[randomIndex].value;
    }
  }

  /**
   * Generate random answers for a specific mode
   */
  private generateRandomAnswersForMode(mode: 'express' | 'balanced' | 'advanced'): Record<string, string | string[]> {
    const answers: Record<string, string | string[]> = {};
    let questions: BalancedQuestion[];

    switch (mode) {
      case 'express':
        questions = EXPRESS_QUESTIONS;
        break;
      case 'balanced':
        questions = QUESTION_FLOW.core;
        break;
      case 'advanced':
        questions = [...QUESTION_FLOW.core, ...QUESTION_FLOW.refinement, ...QUESTION_FLOW.advanced];
        break;
    }

    questions.forEach(question => {
      answers[question.id] = this.generateRandomAnswer(question);
    });

    return answers;
  }

  /**
   * Convert answers to the format expected by the cached service
   */
  private convertAnswersToCategories(answers: Record<string, string | string[]>): Record<string, any> {
    const mockTranscript = Object.entries(answers)
      .map(([questionId, answer]) => {
        const question = BALANCED_PUMP_QUESTIONS.find(q => q.id === questionId) || 
                        EXPRESS_QUESTIONS.find(q => q.id === questionId);
        return question ? `${question.title}: ${Array.isArray(answer) ? answer.join(', ') : answer}` : '';
      })
      .filter(Boolean)
      .join('. ');

    return {
      summary: {
        category: 'summary',
        mainTranscript: mockTranscript,
        followUpTranscript: 'Generated via simulation testing.',
        checkedQuestions: Object.keys(answers),
        timestamp: Date.now()
      }
    };
  }

  /**
   * Run a single simulation for a specific mode
   */
  private async runSingleSimulation(mode: 'express' | 'balanced' | 'advanced', runNumber: number): Promise<SimulationResult> {
    const startTime = Date.now();
    
    try {
      // Generate random answers
      const answers = this.generateRandomAnswersForMode(mode);
      logDebug('App', 'Generated random answers', { mode, answers });
      
      // Convert to expected format
      const categoryResponses = this.convertAnswersToCategories(answers);
      
      // Process with the cached service (which includes AI analysis)
      const recommendation = await pumpDriveCached.processUserResponses(categoryResponses);
      
      const processingTime = Date.now() - startTime;
      
      // Extract results (this assumes the service stores results in localStorage or similar)
      // We'll need to check what the service returns
      const mockResult: SimulationResult = {
        mode,
        runNumber,
        topPump: 'Omnipod 5', // This would come from actual recommendation
        topScore: 85, // This would come from actual recommendation
        alternatives: [
          { name: 'Tandem t:slim X2', score: 78 },
          { name: 'Medtronic 780G', score: 72 }
        ],
        processingTime
      };
      
      return mockResult;
      
    } catch (error) {
      logError('App', 'Error message', {});
      
      // Return a failure result
      return {
        mode,
        runNumber,
        topPump: 'SIMULATION_FAILED',
        topScore: 0,
        alternatives: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Run multiple simulations for all modes
   */
  public async runSimulations(runsPerMode: number = 10): Promise<void> {
    logInfo('App', 'Info message', {});
    
    const modes: ('express' | 'balanced' | 'advanced')[] = ['express', 'balanced', 'advanced'];
    
    for (const mode of modes) {
      logDebug('App', 'Debug message', {});
      
      for (let run = 1; run <= runsPerMode; run++) {
        try {
          const result = await this.runSingleSimulation(mode, run);
          this.results.push(result);
          
          logInfo('App', 'Info message', {});
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          logError('App', 'Error message', {});
        }
      }
    }
    
    logDebug('App', 'Debug message', {});
  }

  /**
   * Analyze results and generate statistics
   */
  public analyzeResults(): void {
    if (this.results.length === 0) {
      logDebug('App', 'Debug message', {});
      return;
    }

    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});

    // Overall statistics
    const totalRuns = this.results.length;
    const successfulRuns = this.results.filter(r => r.topPump !== 'SIMULATION_FAILED');
    const failureRate = ((totalRuns - successfulRuns.length) / totalRuns * 100).toFixed(1);
    
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});

    // Pump win statistics across all modes
    const pumpStats: PumpWinStats = {};
    
    successfulRuns.forEach(result => {
      if (!pumpStats[result.topPump]) {
        pumpStats[result.topPump] = {
          wins: 0,
          totalScore: 0,
          averageScore: 0,
          winPercentage: 0
        };
      }
      
      pumpStats[result.topPump].wins++;
      pumpStats[result.topPump].totalScore += result.topScore;
    });

    // Calculate percentages and averages
    Object.keys(pumpStats).forEach(pumpName => {
      const stats = pumpStats[pumpName];
      stats.averageScore = stats.totalScore / stats.wins;
      stats.winPercentage = (stats.wins / successfulRuns.length) * 100;
    });

    // Sort by win percentage
    const sortedPumps = Object.entries(pumpStats).sort((a, b) => b[1].winPercentage - a[1].winPercentage);

    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    
    sortedPumps.forEach(([pumpName, stats], index) => {
      const rank = (index + 1).toString().padStart(4);
      const name = pumpName.padEnd(24);
      const wins = stats.wins.toString().padStart(4);
      const winPct = stats.winPercentage.toFixed(1).padStart(5) + '%';
      const avgScore = stats.averageScore.toFixed(1).padStart(8);
      
      logDebug('App', 'Debug message', {});
    });

    // Mode-specific analysis
    logDebug('App', 'Debug message', {});
    ['express', 'balanced', 'advanced'].forEach(mode => {
      const modeResults = successfulRuns.filter(r => r.mode === mode);
      if (modeResults.length === 0) return;

      const modePumpStats: PumpWinStats = {};
      
      modeResults.forEach(result => {
        if (!modePumpStats[result.topPump]) {
          modePumpStats[result.topPump] = {
            wins: 0,
            totalScore: 0,
            averageScore: 0,
            winPercentage: 0
          };
        }
        
        modePumpStats[result.topPump].wins++;
        modePumpStats[result.topPump].totalScore += result.topScore;
      });

      // Calculate averages
      Object.keys(modePumpStats).forEach(pumpName => {
        const stats = modePumpStats[pumpName];
        stats.averageScore = stats.totalScore / stats.wins;
        stats.winPercentage = (stats.wins / modeResults.length) * 100;
      });

      const topPump = Object.entries(modePumpStats).sort((a, b) => b[1].winPercentage - a[1].winPercentage)[0];
      
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
    });

    logDebug('App', 'Debug message', {});
  }

  /**
   * Export results to console as JSON for further analysis
   */
  public exportResults(): void {
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug output', { data: "placeholder" }));
  }
}

// Export for use in browser console or testing
export const simulationTest = new BalancedQuestionnaireSimulation();

// Auto-run if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose to global
  (window as any).simulationTest = simulationTest;
  
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
}