/**
 * CCD Summary AI Service
 * Handles API communication with backend for CCD summary generation
 * Uses user's EXACT custom prompt (no modification)
 */

import type { CCDExtractedData } from './ccdParser.service';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface CCDSummary {
  id: string;
  patient_id: string;
  summary_text: string;
  word_count: number;
  ai_model: string;
  custom_prompt: string;
  created_at: string;
  extracted_data: CCDExtractedData;
}

export interface UploadCCDResponse {
  success: boolean;
  fileName: string;
  fileSize: number;
  extractedData: CCDExtractedData;
  message: string;
}

export interface GenerateSummaryResponse {
  success: boolean;
  summary: CCDSummary;
  wordCount: number;
  message: string;
}

class CCDSummaryAIService {
  /**
   * Upload and parse CCD file
   */
  async uploadCCD(file: File, patientId: string): Promise<UploadCCDResponse> {
    try {
      const formData = new FormData();
      formData.append('ccdFile', file);
      formData.append('patientId', patientId);

      console.log('📤 Uploading CCD file to server...');

      const response = await fetch(`${API_BASE_URL}/api/ccd/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Upload failed');
      }

      console.log('✅ CCD upload successful');
      return data;
    } catch (error) {
      console.error('❌ CCD upload error:', error);
      throw error;
    }
  }

  /**
   * Generate AI summary with user's custom prompt
   * IMPORTANT: Uses user's exact prompt - no modifications
   */
  async generateSummary(params: {
    patientId: string;
    customPrompt: string;
    extractedData: CCDExtractedData;
    ccdXml: string;
    fileName: string;
  }): Promise<GenerateSummaryResponse> {
    try {
      console.log('🤖 Generating AI summary...');
      console.log('   - Using user\'s custom prompt (EXACT - NO MODIFICATIONS)');
      console.log('   - Prompt length:', params.customPrompt.length, 'characters');

      const response = await fetch(`${API_BASE_URL}/api/ccd/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Summary generation failed');
      }

      console.log('✅ Summary generated successfully');
      console.log('   - Word count:', data.wordCount);
      console.log('   - Model:', data.summary.ai_model);

      return data;
    } catch (error) {
      console.error('❌ Summary generation error:', error);
      throw error;
    }
  }

  /**
   * Get all summaries for a patient
   */
  async getPatientSummaries(patientId: string): Promise<CCDSummary[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ccd/summaries/${patientId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch summaries');
      }

      return data.summaries;
    } catch (error) {
      console.error('❌ Error fetching summaries:', error);
      throw error;
    }
  }

  /**
   * Get specific summary by ID
   */
  async getSummary(summaryId: string): Promise<CCDSummary> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ccd/summary/${summaryId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch summary');
      }

      return data.summary;
    } catch (error) {
      console.error('❌ Error fetching summary:', error);
      throw error;
    }
  }

  /**
   * Delete a summary
   */
  async deleteSummary(summaryId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ccd/summary/${summaryId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete summary');
      }

      console.log('✅ Summary deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting summary:', error);
      throw error;
    }
  }

  /**
   * Validate prompt length and content
   */
  validatePrompt(prompt: string): { valid: boolean; error?: string } {
    if (!prompt || prompt.trim().length === 0) {
      return { valid: false, error: 'Prompt cannot be empty' };
    }

    if (prompt.trim().length < 10) {
      return { valid: false, error: 'Prompt is too short (minimum 10 characters)' };
    }

    if (prompt.length > 2000) {
      return { valid: false, error: 'Prompt is too long (maximum 2000 characters)' };
    }

    return { valid: true };
  }

  /**
   * Estimate token count for cost calculation
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate estimated cost for OpenAI API call
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    // GPT-4o pricing (approximate):
    // Input: $2.50 per 1M tokens = $0.0000025 per token
    // Output: $10.00 per 1M tokens = $0.00001 per token
    const inputCost = promptTokens * 0.0000025;
    const outputCost = completionTokens * 0.00001;
    return inputCost + outputCost;
  }
}

export default new CCDSummaryAIService();
