/**
 * Breach Notification Service
 * Detects and reports HIPAA breaches
 * HIPAA Requirement: Must notify within 60 days of discovery
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class BreachNotificationService {
  constructor() {
    this.suspiciousEventThresholds = {
      MASS_DATA_EXPORT: {
        threshold: 100, // More than 100 patient records in 5 minutes
        window: 5 * 60 * 1000
      },
      FAILED_LOGIN_SPIKE: {
        threshold: 50, // More than 50 failed logins in 10 minutes
        window: 10 * 60 * 1000
      },
      UNAUTHORIZED_ACCESS: {
        threshold: 1, // Any unauthorized access is a breach
        window: 0
      },
      DATA_MODIFICATION: {
        threshold: 500, // Mass data modification
        window: 10 * 60 * 1000
      },
      AFTER_HOURS_ACCESS: {
        threshold: 20, // Unusual activity outside business hours
        window: 60 * 60 * 1000
      }
    };
  }

  /**
   * Detect potential breach based on event patterns
   * @param {Object} event - Security event
   */
  async detectBreach(event) {
    const { type, user_id, count, timestamp } = event;

    logger.info('BreachDetection', 'Analyzing security event', {
      type,
      user_id,
      count
    });

    // Check if event matches breach criteria
    const threshold = this.suspiciousEventThresholds[type];
    if (!threshold) {
      return null; // Unknown event type
    }

    if (count >= threshold.threshold) {
      logger.warn('BreachDetection', 'Potential breach detected', {
        type,
        count,
        threshold: threshold.threshold
      });

      return await this.reportBreach({
        type,
        user_id,
        count,
        timestamp,
        severity: this.calculateSeverity(type, count)
      });
    }

    return null;
  }

  /**
   * Calculate severity of breach
   */
  calculateSeverity(type, count) {
    if (type === 'UNAUTHORIZED_ACCESS') return 'CRITICAL';
    if (count > 1000) return 'CRITICAL';
    if (count > 500) return 'HIGH';
    if (count > 100) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Report a breach incident
   * @param {Object} incident - Incident details
   */
  async reportBreach(incident) {
    try {
      const discoveredAt = new Date();
      const notificationDeadline = this.calculateDeadline(discoveredAt);

      const breach = {
        incident_type: incident.type,
        discovered_at: discoveredAt.toISOString(),
        affected_patient_count: incident.count || 0,
        status: 'INVESTIGATING',
        severity: incident.severity || 'MEDIUM',
        notification_deadline: notificationDeadline,
        hhs_notified: false,
        individuals_notified: false,
        media_notified: false,
        created_at: new Date().toISOString()
      };

      // Store in breach_incidents table
      const { data, error } = await supabase
        .from('breach_incidents')
        .insert(breach)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.error('BreachDetection', 'Breach incident recorded', {
        incident_id: data.id,
        type: incident.type,
        severity: incident.severity,
        deadline: notificationDeadline
      });

      // Send immediate alert to administrators
      await this.alertAdministrators(data);

      return data;
    } catch (error) {
      logger.error('BreachDetection', 'Failed to report breach', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate 60-day notification deadline
   * @param {Date} discoveryDate
   * @returns {string} ISO date string
   */
  calculateDeadline(discoveryDate) {
    const deadline = new Date(discoveryDate);
    deadline.setDate(deadline.getDate() + 60); // HIPAA: 60 days
    return deadline.toISOString();
  }

  /**
   * Alert administrators of breach
   */
  async alertAdministrators(breach) {
    logger.error('SECURITY_ALERT', 'HIPAA breach detected - immediate action required', {
      incident_id: breach.id,
      type: breach.incident_type,
      severity: breach.severity,
      affected_count: breach.affected_patient_count,
      deadline: breach.notification_deadline
    });

    // TODO: Implement email/SMS alerts to security team
    // TODO: Create incident ticket in ticketing system
    // TODO: Send notification to compliance officer

    // Log critical alert using HIPAA-safe logger (no PHI in alert)
    const alertMessage = `
╔════════════════════════════════════════════════════════════╗
║                 🚨 HIPAA BREACH DETECTED 🚨                ║
╠════════════════════════════════════════════════════════════╣
║ Incident ID: ${breach.id}                                 ║
║ Type: ${breach.incident_type}                             ║
║ Severity: ${breach.severity}                              ║
║ Affected Count: ${breach.affected_patient_count}          ║
║ Deadline: ${breach.notification_deadline}                 ║
╠════════════════════════════════════════════════════════════╣
║ ACTION REQUIRED:                                           ║
║ 1. Investigate immediately                                 ║
║ 2. Contain the breach                                      ║
║ 3. Document all actions                                    ║
║ 4. Notify affected individuals within 60 days             ║
║ 5. Notify HHS if >500 people affected                     ║
╚════════════════════════════════════════════════════════════╝`;

    // Use logger for structured logging (HIPAA compliant)
    logger.error('CRITICAL_BREACH_ALERT', alertMessage, {
      breach_id: breach.id,
      type: breach.incident_type,
      severity: breach.severity
    });
  }

  /**
   * Track notification progress
   */
  async trackNotificationProgress(breachId) {
    const { data, error } = await supabase
      .from('breach_incidents')
      .select('*')
      .eq('id', breachId)
      .single();

    if (error) throw error;

    const now = new Date();
    const deadline = new Date(data.notification_deadline);
    const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    return {
      breach: data,
      daysRemaining,
      status: {
        investigating: data.status === 'INVESTIGATING',
        individualsNotified: data.individuals_notified,
        hhsNotified: data.hhs_notified,
        mediaNotified: data.media_notified,
        overdue: daysRemaining < 0
      }
    };
  }

  /**
   * Update breach status
   */
  async updateBreachStatus(breachId, updates) {
    const { data, error} = await supabase
      .from('breach_incidents')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', breachId)
      .select()
      .single();

    if (error) throw error;

    logger.info('BreachDetection', 'Breach status updated', {
      breach_id: breachId,
      updates
    });

    return data;
  }

  /**
   * Get all active breaches
   */
  async getActiveBreaches() {
    const { data, error } = await supabase
      .from('breach_incidents')
      .select('*')
      .in('status', ['INVESTIGATING', 'CONFIRMED'])
      .order('discovered_at', { ascending: false });

    if (error) throw error;

    return data;
  }
}

module.exports = new BreachNotificationService();
