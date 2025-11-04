/**
 * usePatientSummary Hook
 * React hook for generating and managing patient summaries
 */

import { useState } from 'react';
import { patientSummaryGenerator, type SOAPInput, type PatientSummary } from '../services/patientSummaryGenerator.service';
import { logInfo, logError } from '../services/logger.service';

interface UsePatientSummaryOptions {
  autoGenerate?: boolean; // Automatically generate after SOAP note is ready
}

export function usePatientSummary(options: UsePatientSummaryOptions = {}) {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate patient summary from SOAP note
   */
  async function generateSummary(soapInput: SOAPInput): Promise<PatientSummary | null> {
    try {
      setLoading(true);
      setError(null);

      logInfo('usePatientSummary', 'Generating patient summary');

      const result = await patientSummaryGenerator.generateSummary(soapInput);

      // Validate summary quality
      const validation = patientSummaryGenerator.validateSummary(result);
      if (!validation.valid) {
        logError('usePatientSummary', `Summary quality issues: ${validation.issues.join(', ')}`);
        // Continue anyway, but log the issues
      }

      setSummary(result);
      logInfo('usePatientSummary', 'Summary generated successfully', {
        wordCount: result.word_count,
        readTime: result.estimated_read_time_seconds
      });

      return result;

    } catch (err: any) {
      const errorMsg = err.message || 'Failed to generate summary';
      setError(errorMsg);
      logError('usePatientSummary', `Summary generation failed: ${errorMsg}`);
      return null;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Save summary to database (via API)
   */
  async function saveSummary(visitId: string, patientId: string, providerId: string): Promise<boolean> {
    if (!summary) {
      setError('No summary to save');
      return false;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/patient-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId,
          patientId,
          providerId,
          soapNote: {
            // The summary is already generated, just save it
          },
          summary_text: summary.summary_text,
          key_actions: summary.key_actions,
          word_count: summary.word_count,
          estimated_read_time_seconds: summary.estimated_read_time_seconds
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save summary: ${response.status}`);
      }

      logInfo('usePatientSummary', 'Summary saved successfully');
      return true;

    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save summary';
      setError(errorMsg);
      logError('usePatientSummary', `Summary save failed: ${errorMsg}`);
      return false;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Clear current summary
   */
  function clearSummary() {
    setSummary(null);
    setError(null);
  }

  return {
    summary,
    loading,
    error,
    generateSummary,
    saveSummary,
    clearSummary
  };
}
