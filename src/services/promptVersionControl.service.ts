/**
 * Prompt Version Control Service
 * Manages prompt versioning, A/B testing, and performance tracking
 */

import { logDebug, logInfo, logWarn, logError } from './logger.service';

export interface PromptVersion {
  id: string;
  version: string; // e.g., "1.0.0", "1.1.0", "2.0.0"
  name: string;
  description: string;
  promptType: 'system' | 'custom-template' | 'standard-template' | 'conversational';
  promptTemplate: string;
  variables: string[]; // List of variables used in template (e.g., ${transcript}, ${patientName})
  createdAt: string;
  createdBy: string;
  status: 'draft' | 'active' | 'testing' | 'deprecated' | 'archived';
  parentVersionId?: string; // For tracking version history
  changes?: string; // Description of changes from parent version
  metadata: {
    targetModel: string[]; // ['gpt-4o', 'gpt-4o-mini', etc.]
    estimatedTokens: number;
    complexity: 'simple' | 'moderate' | 'complex';
    tags: string[];
  };
  performance?: {
    usageCount: number;
    successRate: number;
    averageQualityScore: number;
    averageProcessingTime: number;
    averageTokenUsage: number;
    lastUsed?: string;
  };
  abTest?: {
    enabled: boolean;
    trafficPercentage: number; // 0-100
    controlVersionId?: string;
    testGroup: 'A' | 'B' | 'C';
  };
}

export interface PromptUsageRecord {
  id: string;
  versionId: string;
  noteId?: string;
  timestamp: string;
  success: boolean;
  qualityScore?: number;
  processingTime: number;
  tokenUsage: number;
  errorMessage?: string;
  templateId?: string;
  modelUsed: string;
}

class PromptVersionControlService {
  private readonly STORAGE_KEY = 'prompt_versions';
  private readonly USAGE_KEY = 'prompt_usage_records';
  private readonly ACTIVE_VERSION_KEY = 'active_prompt_version';
  private readonly MAX_USAGE_RECORDS = 1000;

  /**
   * Get all prompt versions
   */
  getVersions(promptType?: PromptVersion['promptType']): PromptVersion[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];

    try {
      const versions: PromptVersion[] = JSON.parse(stored);

      if (promptType) {
        return versions.filter(v => v.promptType === promptType);
      }

      return versions;
    } catch (error) {
      logError('promptVersionControl', 'Failed to load versions', { error });
      return [];
    }
  }

  /**
   * Get active version for a specific prompt type
   */
  getActiveVersion(promptType: PromptVersion['promptType']): PromptVersion | null {
    const versions = this.getVersions(promptType);
    const activeVersion = versions.find(v => v.status === 'active');

    if (!activeVersion) {
      logWarn('promptVersionControl', 'No active version found', { promptType });
      return null;
    }

    return activeVersion;
  }

  /**
   * Get specific version by ID
   */
  getVersion(versionId: string): PromptVersion | null {
    const versions = this.getVersions();
    return versions.find(v => v.id === versionId) || null;
  }

  /**
   * Create new prompt version
   */
  createVersion(
    version: Omit<PromptVersion, 'id' | 'createdAt' | 'performance'>
  ): PromptVersion {
    const newVersion: PromptVersion = {
      ...version,
      id: `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      performance: {
        usageCount: 0,
        successRate: 0,
        averageQualityScore: 0,
        averageProcessingTime: 0,
        averageTokenUsage: 0
      }
    };

    const versions = this.getVersions();
    versions.push(newVersion);

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(versions));

    logInfo('promptVersionControl', 'Created new prompt version', {
      id: newVersion.id,
      version: newVersion.version,
      name: newVersion.name
    });

    return newVersion;
  }

  /**
   * Update existing version
   */
  updateVersion(versionId: string, updates: Partial<PromptVersion>): boolean {
    const versions = this.getVersions();
    const index = versions.findIndex(v => v.id === versionId);

    if (index === -1) {
      logError('promptVersionControl', 'Version not found', { versionId });
      return false;
    }

    versions[index] = { ...versions[index], ...updates };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(versions));

    logInfo('promptVersionControl', 'Updated prompt version', { versionId });
    return true;
  }

  /**
   * Set version as active (deactivates other versions of same type)
   */
  setActiveVersion(versionId: string): boolean {
    const versions = this.getVersions();
    const targetVersion = versions.find(v => v.id === versionId);

    if (!targetVersion) {
      logError('promptVersionControl', 'Version not found', { versionId });
      return false;
    }

    // Deactivate all versions of the same type
    versions.forEach(v => {
      if (v.promptType === targetVersion.promptType && v.status === 'active') {
        v.status = 'deprecated';
      }
    });

    // Activate target version
    targetVersion.status = 'active';

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(versions));

    logInfo('promptVersionControl', 'Set active prompt version', {
      versionId,
      promptType: targetVersion.promptType,
      version: targetVersion.version
    });

    return true;
  }

  /**
   * Create new version from existing (fork)
   */
  forkVersion(
    sourceVersionId: string,
    newVersionNumber: string,
    changes: string
  ): PromptVersion | null {
    const sourceVersion = this.getVersion(sourceVersionId);

    if (!sourceVersion) {
      logError('promptVersionControl', 'Source version not found', { sourceVersionId });
      return null;
    }

    const forkedVersion = this.createVersion({
      version: newVersionNumber,
      name: `${sourceVersion.name} (forked)`,
      description: sourceVersion.description,
      promptType: sourceVersion.promptType,
      promptTemplate: sourceVersion.promptTemplate,
      variables: [...sourceVersion.variables],
      createdBy: 'system',
      status: 'draft',
      parentVersionId: sourceVersionId,
      changes,
      metadata: { ...sourceVersion.metadata },
      abTest: sourceVersion.abTest ? { ...sourceVersion.abTest } : undefined
    });

    logInfo('promptVersionControl', 'Forked prompt version', {
      sourceId: sourceVersionId,
      newId: forkedVersion.id,
      newVersion: newVersionNumber
    });

    return forkedVersion;
  }

  /**
   * Record prompt usage
   */
  recordUsage(record: Omit<PromptUsageRecord, 'id' | 'timestamp'>): void {
    const usageRecord: PromptUsageRecord = {
      ...record,
      id: `pu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    // Store usage record
    const stored = localStorage.getItem(this.USAGE_KEY);
    let records: PromptUsageRecord[] = [];

    if (stored) {
      try {
        records = JSON.parse(stored);
      } catch (error) {
        logError('promptVersionControl', 'Failed to parse usage records', { error });
      }
    }

    records.unshift(usageRecord);

    // Keep only recent records
    if (records.length > this.MAX_USAGE_RECORDS) {
      records = records.slice(0, this.MAX_USAGE_RECORDS);
    }

    localStorage.setItem(this.USAGE_KEY, JSON.stringify(records));

    // Update version performance metrics
    this.updateVersionPerformance(record.versionId, usageRecord);

    logDebug('promptVersionControl', 'Recorded prompt usage', {
      versionId: record.versionId,
      success: record.success,
      qualityScore: record.qualityScore
    });
  }

  /**
   * Update version performance metrics
   */
  private updateVersionPerformance(
    versionId: string,
    record: PromptUsageRecord
  ): void {
    const version = this.getVersion(versionId);
    if (!version || !version.performance) return;

    const perf = version.performance;
    const oldCount = perf.usageCount;
    const newCount = oldCount + 1;

    // Calculate running averages
    perf.usageCount = newCount;
    perf.successRate = ((perf.successRate * oldCount) + (record.success ? 1 : 0)) / newCount;

    if (record.qualityScore !== undefined) {
      perf.averageQualityScore = ((perf.averageQualityScore * oldCount) + record.qualityScore) / newCount;
    }

    perf.averageProcessingTime = ((perf.averageProcessingTime * oldCount) + record.processingTime) / newCount;
    perf.averageTokenUsage = ((perf.averageTokenUsage * oldCount) + record.tokenUsage) / newCount;
    perf.lastUsed = record.timestamp;

    this.updateVersion(versionId, { performance: perf });
  }

  /**
   * Get usage records for a version
   */
  getUsageRecords(
    versionId?: string,
    limit: number = 100
  ): PromptUsageRecord[] {
    const stored = localStorage.getItem(this.USAGE_KEY);
    if (!stored) return [];

    try {
      let records: PromptUsageRecord[] = JSON.parse(stored);

      if (versionId) {
        records = records.filter(r => r.versionId === versionId);
      }

      return records.slice(0, limit);
    } catch (error) {
      logError('promptVersionControl', 'Failed to load usage records', { error });
      return [];
    }
  }

  /**
   * Get version comparison statistics
   */
  compareVersions(versionId1: string, versionId2: string): {
    version1: PromptVersion;
    version2: PromptVersion;
    comparison: {
      usageCountDiff: number;
      successRateDiff: number;
      qualityScoreDiff: number;
      processingTimeDiff: number;
      tokenUsageDiff: number;
      winner: 'version1' | 'version2' | 'tie';
    };
  } | null {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2 || !v1.performance || !v2.performance) {
      logError('promptVersionControl', 'Cannot compare versions', {
        v1Found: !!v1,
        v2Found: !!v2
      });
      return null;
    }

    const p1 = v1.performance;
    const p2 = v2.performance;

    // Calculate overall score (higher is better)
    const score1 = (p1.successRate * 0.3) + (p1.averageQualityScore * 0.4) -
                   (p1.averageProcessingTime / 10000 * 0.1) - (p1.averageTokenUsage / 10000 * 0.2);
    const score2 = (p2.successRate * 0.3) + (p2.averageQualityScore * 0.4) -
                   (p2.averageProcessingTime / 10000 * 0.1) - (p2.averageTokenUsage / 10000 * 0.2);

    const winner = score1 > score2 ? 'version1' : score2 > score1 ? 'version2' : 'tie';

    return {
      version1: v1,
      version2: v2,
      comparison: {
        usageCountDiff: p1.usageCount - p2.usageCount,
        successRateDiff: p1.successRate - p2.successRate,
        qualityScoreDiff: p1.averageQualityScore - p2.averageQualityScore,
        processingTimeDiff: p1.averageProcessingTime - p2.averageProcessingTime,
        tokenUsageDiff: p1.averageTokenUsage - p2.averageTokenUsage,
        winner
      }
    };
  }

  /**
   * Enable A/B testing for a version
   */
  enableABTest(
    versionId: string,
    trafficPercentage: number,
    controlVersionId?: string
  ): boolean {
    if (trafficPercentage < 0 || trafficPercentage > 100) {
      logError('promptVersionControl', 'Invalid traffic percentage', { trafficPercentage });
      return false;
    }

    const version = this.getVersion(versionId);
    if (!version) {
      logError('promptVersionControl', 'Version not found', { versionId });
      return false;
    }

    this.updateVersion(versionId, {
      status: 'testing',
      abTest: {
        enabled: true,
        trafficPercentage,
        controlVersionId,
        testGroup: 'B'
      }
    });

    logInfo('promptVersionControl', 'Enabled A/B test', {
      versionId,
      trafficPercentage,
      controlVersionId
    });

    return true;
  }

  /**
   * Select version for request (handles A/B testing)
   */
  selectVersionForRequest(promptType: PromptVersion['promptType']): PromptVersion | null {
    const versions = this.getVersions(promptType);

    // Get active version
    const activeVersion = versions.find(v => v.status === 'active');

    // Get testing versions
    const testingVersions = versions.filter(v =>
      v.status === 'testing' && v.abTest?.enabled
    );

    if (testingVersions.length === 0) {
      return activeVersion || null;
    }

    // A/B testing logic: randomly assign based on traffic percentage
    const random = Math.random() * 100;
    let cumulativePercentage = 0;

    for (const testVersion of testingVersions) {
      cumulativePercentage += testVersion.abTest!.trafficPercentage;

      if (random <= cumulativePercentage) {
        logDebug('promptVersionControl', 'Selected test version', {
          versionId: testVersion.id,
          testGroup: testVersion.abTest!.testGroup
        });
        return testVersion;
      }
    }

    // Default to active version
    return activeVersion || null;
  }

  /**
   * Render prompt from template
   */
  renderPrompt(
    versionId: string,
    variables: Record<string, string>
  ): string | null {
    const version = this.getVersion(versionId);
    if (!version) {
      logError('promptVersionControl', 'Version not found', { versionId });
      return null;
    }

    let rendered = version.promptTemplate;

    // Replace variables in template
    version.variables.forEach(varName => {
      const value = variables[varName];
      if (value !== undefined) {
        // Support both ${var} and {{var}} syntax
        rendered = rendered.replace(new RegExp(`\\$\\{${varName}\\}`, 'g'), value);
        rendered = rendered.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value);
      } else {
        logWarn('promptVersionControl', 'Missing variable', { varName, versionId });
      }
    });

    return rendered;
  }

  /**
   * Get version history (parent chain)
   */
  getVersionHistory(versionId: string): PromptVersion[] {
    const history: PromptVersion[] = [];
    let currentVersion = this.getVersion(versionId);

    while (currentVersion) {
      history.push(currentVersion);

      if (currentVersion.parentVersionId) {
        currentVersion = this.getVersion(currentVersion.parentVersionId);
      } else {
        break;
      }
    }

    return history;
  }

  /**
   * Get performance report for a version
   */
  getPerformanceReport(versionId: string): {
    version: PromptVersion;
    recentUsage: PromptUsageRecord[];
    statistics: {
      totalUsage: number;
      successRate: number;
      avgQuality: number;
      avgTime: number;
      avgTokens: number;
      errorRate: number;
      recentTrend: 'improving' | 'declining' | 'stable';
    };
  } | null {
    const version = this.getVersion(versionId);
    if (!version || !version.performance) return null;

    const recentUsage = this.getUsageRecords(versionId, 50);

    // Calculate recent trend (last 10 vs previous 10)
    const recent10 = recentUsage.slice(0, 10);
    const previous10 = recentUsage.slice(10, 20);

    const recentAvgQuality = recent10.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / recent10.length;
    const previousAvgQuality = previous10.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / previous10.length;

    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAvgQuality > previousAvgQuality * 1.05) {
      recentTrend = 'improving';
    } else if (recentAvgQuality < previousAvgQuality * 0.95) {
      recentTrend = 'declining';
    }

    const errorCount = recentUsage.filter(r => !r.success).length;
    const errorRate = recentUsage.length > 0 ? errorCount / recentUsage.length : 0;

    return {
      version,
      recentUsage,
      statistics: {
        totalUsage: version.performance.usageCount,
        successRate: version.performance.successRate,
        avgQuality: version.performance.averageQualityScore,
        avgTime: version.performance.averageProcessingTime,
        avgTokens: version.performance.averageTokenUsage,
        errorRate,
        recentTrend
      }
    };
  }

  /**
   * Archive old versions
   */
  archiveVersion(versionId: string): boolean {
    const version = this.getVersion(versionId);

    if (!version) {
      logError('promptVersionControl', 'Version not found', { versionId });
      return false;
    }

    if (version.status === 'active') {
      logError('promptVersionControl', 'Cannot archive active version', { versionId });
      return false;
    }

    this.updateVersion(versionId, { status: 'archived' });

    logInfo('promptVersionControl', 'Archived prompt version', { versionId });
    return true;
  }

  /**
   * Initialize with default versions if none exist
   */
  initializeDefaultVersions(): void {
    const existing = this.getVersions();

    if (existing.length > 0) {
      logDebug('promptVersionControl', 'Versions already exist, skipping initialization');
      return;
    }

    // Create default system prompt version
    this.createVersion({
      version: '1.0.0',
      name: 'Default System Prompt',
      description: 'Initial system prompt for medical note processing',
      promptType: 'system',
      promptTemplate: 'You are an expert medical scribe with extensive experience in clinical documentation. Generate comprehensive, accurate SOAP notes that meet hospital documentation standards. Focus on medical accuracy, proper terminology, and complete information capture.',
      variables: [],
      createdBy: 'system',
      status: 'active',
      metadata: {
        targetModel: ['gpt-4o', 'gpt-4o-mini'],
        estimatedTokens: 50,
        complexity: 'simple',
        tags: ['system', 'medical', 'default']
      }
    });

    // Create default custom template prompt version
    this.createVersion({
      version: '1.0.0',
      name: 'Default Custom Template Prompt',
      description: 'Prompt for processing with custom doctor templates',
      promptType: 'custom-template',
      promptTemplate: `You are an expert medical scribe. Create a note following this doctor's custom template exactly.

TEMPLATE: "\${templateName}"

\${templateInstructions}

PATIENT: \${patientName} (MRN: \${patientMrn})
TRANSCRIPTION: "\${transcript}"

RULES:
1. Extract ONLY information explicitly stated
2. Never add information not mentioned
3. Include exact numbers
4. Use "Not mentioned" for missing required sections
5. Follow template structure exactly

Generate the note now:`,
      variables: ['templateName', 'templateInstructions', 'patientName', 'patientMrn', 'transcript'],
      createdBy: 'system',
      status: 'active',
      metadata: {
        targetModel: ['gpt-4o', 'gpt-4o-mini'],
        estimatedTokens: 200,
        complexity: 'moderate',
        tags: ['custom-template', 'medical', 'default']
      }
    });

    logInfo('promptVersionControl', 'Initialized default prompt versions');
  }
}

export const promptVersionControlService = new PromptVersionControlService();
