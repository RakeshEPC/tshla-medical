/**
 * Chart Service - Manages patient charts with dual ID system
 * AVA ID: For patient portal (cross-clinic)
 * TSH ID: For EMR/doctor use (clinic-specific)
 */

import type {
  Chart,
  CreateChartRequest,
  CreateChartResponse
} from '../types/clinic.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

class ChartService {
  private readonly STORAGE_PREFIX = 'tshla_chart_';
  
  /**
   * Generate TSH ID in format TSH-###-###
   * For EMR/clinic use
   */
  private generateTshId(): string {
    let tshId: string;
    
    do {
      const firstPart = Math.floor(Math.random() * 900 + 100); // 100-999
      const secondPart = Math.floor(Math.random() * 900 + 100); // 100-999
      tshId = `TSH-${firstPart}-${secondPart}`;
    } while (this.tshIdExists(tshId));
    
    return tshId;
  }
  
  /**
   * Generate AVA ID in format AVA-###-###
   * For patient portal use
   */
  private generateAvaId(): string {
    let avaId: string;
    
    do {
      const firstPart = Math.floor(Math.random() * 900 + 100); // 100-999
      const secondPart = Math.floor(Math.random() * 900 + 100); // 100-999
      avaId = `AVA-${firstPart}-${secondPart}`;
    } while (this.avaIdExists(avaId));
    
    return avaId;
  }
  
  /**
   * Check if TSH ID already exists
   */
  private tshIdExists(tshId: string): boolean {
    const allCharts = this.getAllCharts();
    return allCharts.some(c => c.tshId === tshId);
  }
  
  /**
   * Check if AVA ID already exists
   */
  private avaIdExists(avaId: string): boolean {
    const allCharts = this.getAllCharts();
    return allCharts.some(c => c.avaId === avaId);
  }
  
  /**
   * Get all charts from storage
   */
  private getAllCharts(): Chart[] {
    const charts: Chart[] = [];
    
    if (typeof window === 'undefined') return charts;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_PREFIX)) {
        const chartData = localStorage.getItem(key);
        if (chartData) {
          try {
            charts.push(JSON.parse(chartData));
          } catch (e) {
            logError('chart', 'Error message', {});
          }
        }
      }
    }
    
    return charts;
  }
  
  /**
   * Save chart to storage
   */
  private saveChart(chart: Chart): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `${this.STORAGE_PREFIX}${chart.id}`,
        JSON.stringify(chart)
      );
    }
  }
  
  /**
   * Create a new chart with both AVA and TSH IDs
   */
  async createChart(request: CreateChartRequest): Promise<CreateChartResponse> {
    // Generate unique IDs
    const avaId = this.generateAvaId();
    const tshId = this.generateTshId();
    const chartId = `chart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Get current user info
    const userData = localStorage.getItem('user_data');
    const currentUser = userData ? JSON.parse(userData) : { email: 'system' };
    
    // Create chart object
    const chart: Chart = {
      id: chartId,
      patientId: request.patientId,
      avaId,
      tshId,
      clinicId: request.clinicId,
      oldNotes: request.oldNotes,
      createdBy: currentUser.email,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to storage
    this.saveChart(chart);
    
    // Log the creation (will be picked up by audit service)
    logDebug('chart', 'Debug message', {});
    
    return {
      chart,
      avaId,
      tshId
    };
  }
  
  /**
   * Get chart by ID
   */
  async getChartById(chartId: string): Promise<Chart | null> {
    if (typeof window === 'undefined') return null;
    
    const chartData = localStorage.getItem(`${this.STORAGE_PREFIX}${chartId}`);
    if (!chartData) return null;
    
    try {
      return JSON.parse(chartData);
    } catch (e) {
      logError('chart', 'Error message', {});
      return null;
    }
  }
  
  /**
   * Get chart by AVA ID
   */
  async getChartByAvaId(avaId: string): Promise<Chart | null> {
    const allCharts = this.getAllCharts();
    return allCharts.find(c => c.avaId === avaId) || null;
  }
  
  /**
   * Get chart by TSH ID
   */
  async getChartByTshId(tshId: string): Promise<Chart | null> {
    const allCharts = this.getAllCharts();
    return allCharts.find(c => c.tshId === tshId) || null;
  }
  
  /**
   * Get all charts for a patient
   */
  async getChartsByPatientId(patientId: string): Promise<Chart[]> {
    const allCharts = this.getAllCharts();
    return allCharts.filter(c => c.patientId === patientId);
  }
  
  /**
   * Update chart (e.g., add old notes)
   */
  async updateChart(chartId: string, updates: Partial<Chart>): Promise<Chart | null> {
    const chart = await this.getChartById(chartId);
    if (!chart) return null;
    
    const updatedChart: Chart = {
      ...chart,
      ...updates,
      updatedAt: new Date()
    };
    
    this.saveChart(updatedChart);
    
    logDebug('chart', 'Debug message', {});
    
    return updatedChart;
  }
  
  /**
   * Add old notes to a chart
   */
  async addOldNotes(chartId: string, oldNotes: string): Promise<Chart | null> {
    const chart = await this.getChartById(chartId);
    if (!chart) return null;
    
    const existingNotes = chart.oldNotes || '';
    const separator = existingNotes ? '\n\n---\n\n' : '';
    
    return this.updateChart(chartId, {
      oldNotes: existingNotes + separator + oldNotes
    });
  }
  
  /**
   * Search charts by AVA or TSH ID
   */
  async searchCharts(query: string): Promise<Chart[]> {
    const allCharts = this.getAllCharts();
    const queryLower = query.toLowerCase();
    
    return allCharts.filter(chart => 
      chart.avaId.toLowerCase().includes(queryLower) ||
      chart.tshId.toLowerCase().includes(queryLower)
    );
  }
  
  /**
   * Get charts by clinic ID
   */
  async getChartsByClinicId(clinicId: string): Promise<Chart[]> {
    const allCharts = this.getAllCharts();
    return allCharts.filter(c => c.clinicId === clinicId);
  }
  
  /**
   * Validate chart ownership (for multi-clinic support)
   */
  async validateChartAccess(chartId: string, clinicId: string): Promise<boolean> {
    const chart = await this.getChartById(chartId);
    if (!chart) return false;
    
    // If no clinic ID set, allow access (backward compatibility)
    if (!chart.clinicId) return true;
    
    return chart.clinicId === clinicId;
  }
}

// Export singleton instance
export const chartService = new ChartService();

// Also export for backward compatibility
export default chartService;