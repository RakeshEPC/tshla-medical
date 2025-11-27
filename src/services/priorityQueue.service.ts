/**
 * Priority Queue Service
 * Calculates urgency scores for tasks, labs, calls, etc.
 * Aggregates urgent items from all sources into single queue
 * Created: 2025-01-26
 */

import { pcmDatabaseService } from './pcmDatabase.service';
import type {
  UrgentTask,
  PCMEnrollment,
  PCMLabOrder,
  PCMTask,
  PCMVital
} from '../types/pcm.database.types';

export interface PriorityQueueItem extends UrgentTask {
  color: string; // For UI styling
  icon: string; // Icon name
  actionText: string; // Button text
  actionUrl: string; // Navigation URL
}

class PriorityQueueService {
  /**
   * Get all urgent tasks sorted by priority
   */
  async getUrgentTasksQueue(staffId?: string): Promise<PriorityQueueItem[]> {
    const urgentItems: PriorityQueueItem[] = [];

    try {
      // Get base urgent tasks from database
      const tasks = await pcmDatabaseService.getUrgentTasks(staffId);

      // Transform to priority queue items with UI metadata
      tasks.forEach(task => {
        urgentItems.push(this.transformToQueueItem(task));
      });

      // Get overdue contacts
      const overdueContacts = await this.getOverdueContacts();
      urgentItems.push(...overdueContacts);

      // Get abnormal vitals needing review
      const abnormalVitals = await this.getAbnormalVitalsNeedingReview();
      urgentItems.push(...abnormalVitals);

      // Get unverified AI-extracted lab orders
      const unverifiedLabs = await this.getUnverifiedLabOrders();
      urgentItems.push(...unverifiedLabs);

      // Sort by urgency score (highest first)
      urgentItems.sort((a, b) => b.urgency_score - a.urgency_score);

      // Take top 50 items
      return urgentItems.slice(0, 50);

    } catch (error) {
      console.error('Error building priority queue:', error);
      return [];
    }
  }

  /**
   * Calculate urgency score for any task
   * Returns 0-100 score based on multiple factors
   */
  calculateUrgencyScore(item: {
    type: string;
    priority?: 'high' | 'medium' | 'low' | 'stat' | 'urgent' | 'routine';
    due_date?: string | null;
    risk_level?: 'high' | 'medium' | 'low';
    is_abnormal?: boolean;
    requires_verification?: boolean;
    days_overdue?: number;
  }): number {
    let score = 0;

    // Base priority (0-40 points)
    switch (item.priority) {
      case 'stat':
        score += 40;
        break;
      case 'urgent':
      case 'high':
        score += 35;
        break;
      case 'medium':
        score += 20;
        break;
      case 'routine':
      case 'low':
        score += 10;
        break;
      default:
        score += 15;
    }

    // Overdue penalty (0-30 points)
    if (item.due_date) {
      const dueDate = new Date(item.due_date);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0) {
        score += Math.min(30, daysOverdue * 3); // +3 points per day overdue, max 30
      } else if (daysOverdue === 0) {
        score += 10; // Due today
      }
    }

    // Patient risk level (0-20 points)
    switch (item.risk_level) {
      case 'high':
        score += 20;
        break;
      case 'medium':
        score += 10;
        break;
      case 'low':
        score += 5;
        break;
    }

    // Special flags (0-10 points)
    if (item.is_abnormal) {
      score += 10;
    }
    if (item.requires_verification) {
      score += 5;
    }
    if (item.days_overdue && item.days_overdue > 7) {
      score += 10; // Severely overdue
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Transform urgent task to queue item with UI metadata
   */
  private transformToQueueItem(task: UrgentTask): PriorityQueueItem {
    const baseItem: PriorityQueueItem = {
      ...task,
      color: this.getColorForUrgency(task.urgency_score),
      icon: this.getIconForType(task.type),
      actionText: this.getActionText(task.type),
      actionUrl: this.getActionUrl(task)
    };

    return baseItem;
  }

  /**
   * Get overdue PCM contacts
   */
  private async getOverdueContacts(): Promise<PriorityQueueItem[]> {
    try {
      const enrollments = await pcmDatabaseService.getPCMEnrollments({
        is_active: true,
        next_contact_due_before: new Date().toISOString().split('T')[0]
      });

      return enrollments.map(enrollment => {
        const daysOverdue = enrollment.next_contact_due
          ? Math.floor(
              (new Date().getTime() - new Date(enrollment.next_contact_due).getTime()) /
              (1000 * 60 * 60 * 24)
            )
          : 0;

        const urgency_score = this.calculateUrgencyScore({
          type: 'call',
          priority: enrollment.risk_level === 'high' ? 'urgent' : 'medium',
          due_date: enrollment.next_contact_due,
          risk_level: enrollment.risk_level,
          days_overdue: daysOverdue
        });

        return {
          id: `contact-${enrollment.id}`,
          type: 'call',
          patient_id: enrollment.patient_id,
          patient_name: 'Patient', // Would join with patients table
          urgency_score,
          due_date: enrollment.next_contact_due,
          description: `Overdue contact (${daysOverdue} days)`,
          source_id: enrollment.id,
          metadata: enrollment,
          color: this.getColorForUrgency(urgency_score),
          icon: 'phone',
          actionText: 'Call Now',
          actionUrl: `/pcm/staff?patient=${enrollment.patient_id}`
        };
      });
    } catch (error) {
      console.error('Error getting overdue contacts:', error);
      return [];
    }
  }

  /**
   * Get abnormal vitals needing staff review
   */
  private async getAbnormalVitalsNeedingReview(): Promise<PriorityQueueItem[]> {
    try {
      // Query would need to be added to pcmDatabaseService
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error getting abnormal vitals:', error);
      return [];
    }
  }

  /**
   * Get unverified AI-extracted lab orders
   */
  private async getUnverifiedLabOrders(): Promise<PriorityQueueItem[]> {
    try {
      const pendingLabs = await pcmDatabaseService.getPendingLabs();
      const unverified = pendingLabs.filter(
        lab => lab.requires_verification && !lab.verified
      );

      return unverified.map(lab => {
        const urgency_score = this.calculateUrgencyScore({
          type: 'lab',
          priority: lab.priority,
          due_date: lab.due_date,
          requires_verification: true
        });

        return {
          id: `lab-verify-${lab.id}`,
          type: 'lab',
          patient_id: lab.patient_id,
          patient_name: 'Patient',
          urgency_score,
          due_date: lab.due_date,
          description: `AI-extracted lab needs verification (${Math.round((lab.extraction_confidence || 0) * 100)}% confidence)`,
          source_id: lab.id,
          metadata: lab,
          color: this.getColorForUrgency(urgency_score),
          icon: 'beaker',
          actionText: 'Verify Order',
          actionUrl: `/pcm/labs?order=${lab.id}`
        };
      });
    } catch (error) {
      console.error('Error getting unverified labs:', error);
      return [];
    }
  }

  /**
   * Get color class for urgency score
   */
  private getColorForUrgency(score: number): string {
    if (score >= 80) return 'border-red-500 bg-red-50';
    if (score >= 60) return 'border-orange-500 bg-orange-50';
    if (score >= 40) return 'border-yellow-500 bg-yellow-50';
    return 'border-blue-500 bg-blue-50';
  }

  /**
   * Get icon name for task type
   */
  private getIconForType(type: string): string {
    switch (type) {
      case 'lab': return 'beaker';
      case 'call': return 'phone';
      case 'task': return 'check-square';
      case 'abnormal_vital': return 'activity';
      case 'ai_summary': return 'message-circle';
      default: return 'alert-circle';
    }
  }

  /**
   * Get action button text for task type
   */
  private getActionText(type: string): string {
    switch (type) {
      case 'lab': return 'Review Lab';
      case 'call': return 'Call Patient';
      case 'task': return 'Complete Task';
      case 'abnormal_vital': return 'Review Vitals';
      case 'ai_summary': return 'Read Summary';
      default: return 'View Details';
    }
  }

  /**
   * Get navigation URL for task
   */
  private getActionUrl(task: UrgentTask): string {
    switch (task.type) {
      case 'lab':
        return `/pcm/labs?order=${task.source_id}`;
      case 'call':
        return `/pcm/staff?patient=${task.patient_id}`;
      case 'task':
        return `/pcm/patient/${task.patient_id}?task=${task.source_id}`;
      case 'abnormal_vital':
        return `/pcm/patient/${task.patient_id}?tab=vitals`;
      case 'ai_summary':
        return `/pcm/call-summaries?summary=${task.source_id}`;
      default:
        return `/pcm/patient/${task.patient_id}`;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(staffId?: string): Promise<{
    total: number;
    critical: number; // score >= 80
    urgent: number;   // score >= 60
    moderate: number; // score >= 40
    routine: number;  // score < 40
  }> {
    const queue = await this.getUrgentTasksQueue(staffId);

    return {
      total: queue.length,
      critical: queue.filter(t => t.urgency_score >= 80).length,
      urgent: queue.filter(t => t.urgency_score >= 60 && t.urgency_score < 80).length,
      moderate: queue.filter(t => t.urgency_score >= 40 && t.urgency_score < 60).length,
      routine: queue.filter(t => t.urgency_score < 40).length
    };
  }

  /**
   * Mark task as acknowledged/seen
   */
  async acknowledgeTask(taskId: string): Promise<boolean> {
    // Implementation would track which tasks staff has seen
    // Could store in pcm_task_acknowledgments table
    // For now, just return true
    return true;
  }

  /**
   * Refresh queue (for real-time updates)
   */
  async refreshQueue(staffId?: string): Promise<PriorityQueueItem[]> {
    return this.getUrgentTasksQueue(staffId);
  }
}

export const priorityQueueService = new PriorityQueueService();
