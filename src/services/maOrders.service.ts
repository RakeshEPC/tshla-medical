/**
 * MA Orders Service
 * Manages the lifecycle of medical orders from extraction to completion
 */

import { getDb, generateId } from '../lib/db/browserClient';
import type { ExtractedOrder, OrderExtractionResult } from './orderExtraction.service';
import { patientMasterService } from './patientMaster.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface Order {
  order_id: string;
  patient_id: string;
  doctor_id: string;
  ma_id?: string; // MA who will process the order
  order_type: 'medication' | 'lab' | 'imaging' | 'prior_auth' | 'referral' | 'other';
  order_text: string; // Original order text
  action?: 'start' | 'stop' | 'continue' | 'increase' | 'decrease' | 'order' | 'check';
  details?: string;
  urgency: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: Date;
  assigned_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  completed_by?: string; // MA who completed it
  notes?: string; // MA notes about completion
  priority_score: number; // 1-10 priority scoring
  estimated_time_minutes?: number; // Estimated time to complete
  source_dictation_id?: string; // Reference to original dictation
  patient_name?: string; // Denormalized for easy display
  doctor_name?: string; // Denormalized for easy display
}

export interface OrderStats {
  pending: number;
  inProgress: number;
  completed: number;
  urgent: number;
  total: number;
}

export interface MAWorkload {
  ma_id: string;
  ma_name: string;
  pending_orders: number;
  in_progress_orders: number;
  completed_today: number;
  total_workload: number;
  avg_completion_time: number;
}

class MAOrdersService {
  private db = getDb();

  /**
   * Create orders from extracted dictation
   */
  async createOrdersFromExtraction(
    extractedOrders: OrderExtractionResult,
    patientId: string,
    doctorId: string,
    doctorName: string,
    dictationId?: string
  ): Promise<Order[]> {
    const orders: Order[] = [];
    const patient = await patientMasterService.getPatientById(patientId, 'uuid');
    const patientName = patient?.name || 'Unknown Patient';

    // Process medications
    for (const med of extractedOrders.medications) {
      orders.push(
        await this.createOrder({
          patient_id: patientId,
          doctor_id: doctorId,
          order_type: 'medication',
          order_text: med.text,
          action: med.action,
          urgency: med.urgency || 'routine',
          source_dictation_id: dictationId,
          patient_name: patientName,
          doctor_name: doctorName,
        })
      );
    }

    // Process labs
    for (const lab of extractedOrders.labs) {
      orders.push(
        await this.createOrder({
          patient_id: patientId,
          doctor_id: doctorId,
          order_type: 'lab',
          order_text: lab.text,
          action: lab.action,
          urgency: lab.urgency || 'routine',
          source_dictation_id: dictationId,
          patient_name: patientName,
          doctor_name: doctorName,
        })
      );
    }

    // Process imaging
    for (const img of extractedOrders.imaging) {
      orders.push(
        await this.createOrder({
          patient_id: patientId,
          doctor_id: doctorId,
          order_type: 'imaging',
          order_text: img.text,
          action: img.action,
          urgency: img.urgency || 'routine',
          source_dictation_id: dictationId,
          patient_name: patientName,
          doctor_name: doctorName,
        })
      );
    }

    // Process prior auths
    for (const auth of extractedOrders.priorAuths) {
      orders.push(
        await this.createOrder({
          patient_id: patientId,
          doctor_id: doctorId,
          order_type: 'prior_auth',
          order_text: auth.text,
          action: auth.action,
          urgency: auth.urgency || 'routine',
          source_dictation_id: dictationId,
          patient_name: patientName,
          doctor_name: doctorName,
        })
      );
    }

    // Process referrals
    for (const ref of extractedOrders.referrals) {
      orders.push(
        await this.createOrder({
          patient_id: patientId,
          doctor_id: doctorId,
          order_type: 'referral',
          order_text: ref.text,
          action: ref.action,
          urgency: ref.urgency || 'routine',
          source_dictation_id: dictationId,
          patient_name: patientName,
          doctor_name: doctorName,
        })
      );
    }

    logInfo('maOrders', 'Info message', {});
    return orders;
  }

  /**
   * Create a single order
   */
  private async createOrder(
    orderData: Omit<Order, 'order_id' | 'created_at' | 'status' | 'priority_score'>
  ): Promise<Order> {
    const order: Order = {
      ...orderData,
      order_id: generateId(),
      status: 'pending',
      created_at: new Date(),
      priority_score: this.calculatePriority(orderData.order_type, orderData.urgency),
      estimated_time_minutes: this.estimateCompletionTime(orderData.order_type),
    };

    await this.db.execute('add:orders', order);

    // Log the order creation
    await this.logOrderAction(order.order_id, 'order_created', {
      doctor_id: orderData.doctor_id,
      patient_id: orderData.patient_id,
      order_type: orderData.order_type,
    });

    return order;
  }

  /**
   * Get all pending orders for MA dashboard
   */
  async getAllPendingOrders(): Promise<Order[]> {
    const orders = await this.db.query('orders');
    return orders
      .filter((order: any) => order.status === 'pending')
      .sort((a: any, b: any) => {
        // Sort by priority (high to low), then urgency, then creation time
        if (a.urgency !== b.urgency) {
          const urgencyOrder = { stat: 3, urgent: 2, routine: 1 };
          return (
            (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 1) -
            (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 1)
          );
        }
        if (a.priority_score !== b.priority_score) {
          return b.priority_score - a.priority_score;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }

  /**
   * Get orders assigned to a specific MA
   */
  async getOrdersByMA(maId: string, status?: Order['status']): Promise<Order[]> {
    const orders = await this.db.query('orders');
    return orders.filter((order: any) => {
      const matchMA = order.ma_id === maId;
      const matchStatus = !status || order.status === status;
      return matchMA && matchStatus;
    });
  }

  /**
   * Get orders for a specific doctor
   */
  async getOrdersByDoctor(doctorId: string, status?: Order['status']): Promise<Order[]> {
    const orders = await this.db.query('orders');
    return orders.filter((order: any) => {
      const matchDoctor = order.doctor_id === doctorId;
      const matchStatus = !status || order.status === status;
      return matchDoctor && matchStatus;
    });
  }

  /**
   * Assign order to MA
   */
  async assignOrderToMA(orderId: string, maId: string, maName: string): Promise<void> {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = {
      ...order,
      ma_id: maId,
      status: 'in_progress' as const,
      assigned_at: new Date(),
      started_at: new Date(),
    };

    await this.db.execute('put:orders', updatedOrder);

    await this.logOrderAction(orderId, 'order_assigned', {
      ma_id: maId,
      ma_name: maName,
    });
  }

  /**
   * Mark order as completed
   */
  async completeOrder(
    orderId: string,
    maId: string,
    maName: string,
    notes?: string
  ): Promise<void> {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = {
      ...order,
      status: 'completed' as const,
      completed_at: new Date(),
      completed_by: maId,
      notes: notes || order.notes,
    };

    await this.db.execute('put:orders', updatedOrder);

    await this.logOrderAction(orderId, 'order_completed', {
      ma_id: maId,
      ma_name: maName,
      completion_notes: notes,
    });

    logInfo('maOrders', 'Info message', {});
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const order = await this.db.queryOne('orders', orderId);
      return order || null;
    } catch {
      return null;
    }
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<OrderStats> {
    const orders = await this.db.query('orders');

    return {
      pending: orders.filter((o: any) => o.status === 'pending').length,
      inProgress: orders.filter((o: any) => o.status === 'in_progress').length,
      completed: orders.filter((o: any) => o.status === 'completed').length,
      urgent: orders.filter((o: any) => o.urgency === 'urgent' || o.urgency === 'stat').length,
      total: orders.length,
    };
  }

  /**
   * Get MA workload analysis
   */
  async getMAWorkloads(): Promise<MAWorkload[]> {
    const orders = await this.db.query('orders');
    const maWorkloads: { [maId: string]: MAWorkload } = {};
    const today = new Date().toDateString();

    // Initialize MA workloads
    const allMAIds = [...new Set(orders.map((o: any) => o.ma_id).filter(Boolean))];
    allMAIds.forEach(maId => {
      maWorkloads[maId] = {
        ma_id: maId,
        ma_name: maId, // Will be updated if we have the name
        pending_orders: 0,
        in_progress_orders: 0,
        completed_today: 0,
        total_workload: 0,
        avg_completion_time: 0,
      };
    });

    // Calculate workloads
    for (const order of orders) {
      if (!order.ma_id) continue;

      if (!maWorkloads[order.ma_id]) {
        maWorkloads[order.ma_id] = {
          ma_id: order.ma_id,
          ma_name: order.ma_id,
          pending_orders: 0,
          in_progress_orders: 0,
          completed_today: 0,
          total_workload: 0,
          avg_completion_time: 0,
        };
      }

      const workload = maWorkloads[order.ma_id];

      if (order.status === 'pending') workload.pending_orders++;
      if (order.status === 'in_progress') workload.in_progress_orders++;
      if (order.status === 'completed' && new Date(order.completed_at).toDateString() === today) {
        workload.completed_today++;
      }

      workload.total_workload = workload.pending_orders + workload.in_progress_orders;
    }

    return Object.values(maWorkloads);
  }

  /**
   * Auto-assign orders to least busy MA
   */
  async autoAssignOrders(): Promise<{ assigned: number; errors: string[] }> {
    const pendingOrders = await this.getAllPendingOrders();
    const maWorkloads = await this.getMAWorkloads();
    const errors: string[] = [];
    let assigned = 0;

    if (maWorkloads.length === 0) {
      return { assigned: 0, errors: ['No MAs available for assignment'] };
    }

    for (const order of pendingOrders.slice(0, 10)) {
      // Limit to 10 orders per run
      try {
        // Find MA with least workload
        const leastBusyMA = maWorkloads.reduce((min, ma) =>
          ma.total_workload < min.total_workload ? ma : min
        );

        await this.assignOrderToMA(order.order_id, leastBusyMA.ma_id, leastBusyMA.ma_name);
        leastBusyMA.total_workload++; // Update for next assignment
        assigned++;
      } catch (error) {
        errors.push(`Failed to assign order ${order.order_id}: ${error}`);
      }
    }

    return { assigned, errors };
  }

  /**
   * Calculate priority score for an order
   */
  private calculatePriority(orderType: Order['order_type'], urgency: Order['urgency']): number {
    let score = 5; // Base priority

    // Urgency multiplier
    switch (urgency) {
      case 'stat':
        score += 5;
        break;
      case 'urgent':
        score += 3;
        break;
      case 'routine':
        break;
    }

    // Order type priority
    switch (orderType) {
      case 'medication':
        score += 2;
        break;
      case 'lab':
        score += 2;
        break;
      case 'prior_auth':
        score += 3;
        break; // High priority due to complexity
      case 'imaging':
        score += 1;
        break;
      case 'referral':
        score += 1;
        break;
      default:
        break;
    }

    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Estimate completion time for different order types
   */
  private estimateCompletionTime(orderType: Order['order_type']): number {
    switch (orderType) {
      case 'medication':
        return 5; // 5 minutes
      case 'lab':
        return 10; // 10 minutes
      case 'imaging':
        return 15; // 15 minutes
      case 'prior_auth':
        return 30; // 30 minutes - complex
      case 'referral':
        return 20; // 20 minutes
      default:
        return 10;
    }
  }

  /**
   * Log order actions for audit trail
   */
  private async logOrderAction(orderId: string, action: string, details?: any): Promise<void> {
    const logEntry = {
      log_id: generateId(),
      order_id: orderId,
      action_type: action,
      details: JSON.stringify(details || {}),
      timestamp: new Date(),
      user_agent: navigator.userAgent,
    };

    // We'll store this in ma_actions_log for now
    // In a real system, this might be a separate orders_log table
    await this.db.execute('add:ma_actions_log', {
      ...logEntry,
      ma_id: details?.ma_id || 'system',
      patient_id: details?.patient_id || '',
    });
  }

  /**
   * Get recent activity for dashboard
   */
  async getRecentActivity(limit: number = 20): Promise<any[]> {
    const logs = await this.db.query('ma_actions_log');
    return logs
      .filter((log: any) => log.action_type.includes('order'))
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Cleanup old completed orders (30+ days old)
   */
  async cleanupOldOrders(): Promise<number> {
    const orders = await this.db.query('orders');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let deletedCount = 0;

    for (const order of orders) {
      if (order.status === 'completed' && order.completed_at) {
        const completedDate = new Date(order.completed_at);
        if (completedDate < thirtyDaysAgo) {
          await this.db.execute('delete:orders', order.order_id);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const maOrdersService = new MAOrdersService();
