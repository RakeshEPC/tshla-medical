/**
 * Centralized Logging Service for TSHLA Medical
 * Replaces console.log with structured, configurable logging
 * HIPAA compliant - no sensitive data logging in production
 */

import { config } from '../config/environment';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  sessionId?: string;
  userId?: string;
}

class Logger {
  private currentLevel: LogLevel;
  private enableConsoleOutput: boolean;
  private enableRemoteLogging: boolean;
  private logBuffer: LogEntry[] = [];

  constructor() {
    // Set log level based on environment
    this.currentLevel = this.getLogLevelFromEnvironment();
    this.enableConsoleOutput = config.isDevelopment || config.app.environment === 'staging';
    this.enableRemoteLogging = config.app.enableAuditLogging && config.isProduction;
  }

  private getLogLevelFromEnvironment(): LogLevel {
    if (config.isProduction) return LogLevel.WARN;
    if (config.app.environment === 'staging') return LogLevel.INFO;
    return LogLevel.DEBUG; // Development
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private formatLogEntry(
    level: LogLevel,
    component: string,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata: this.sanitizeMetadata(metadata),
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
    };
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    // In production/HIPAA mode, filter out sensitive data
    if (config.app.enableHipaaMode) {
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(metadata)) {
        const lowerKey = key.toLowerCase();

        // Skip sensitive fields
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('key') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('ssn') ||
          lowerKey.includes('dob') ||
          lowerKey.includes('phone') ||
          lowerKey.includes('email')
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return metadata;
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('sessionId') || undefined;
    } catch {
      return undefined;
    }
  }

  private getUserId(): string | undefined {
    try {
      const user = sessionStorage.getItem('currentUser');
      return user ? JSON.parse(user)?.id : undefined;
    } catch {
      return undefined;
    }
  }

  private writeLog(entry: LogEntry): void {
    // Add to buffer for potential remote logging
    this.logBuffer.push(entry);

    // Keep buffer size manageable
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }

    // Console output for development/staging
    if (this.enableConsoleOutput) {
      const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
      const levelName = levelNames[entry.level];
      const prefix = `[${entry.timestamp}] ${levelName} [${entry.component}]`;

      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(prefix, entry.message, entry.metadata);
          break;
        case LogLevel.WARN:
          console.warn(prefix, entry.message, entry.metadata);
          break;
        case LogLevel.INFO:
          console.info(prefix, entry.message, entry.metadata);
          break;
        case LogLevel.DEBUG:
          console.debug(prefix, entry.message, entry.metadata);
          break;
      }
    }

    // Remote logging for production
    if (this.enableRemoteLogging && entry.level <= LogLevel.WARN) {
      this.sendToRemoteLogger(entry);
    }
  }

  private async sendToRemoteLogger(entry: LogEntry): Promise<void> {
    try {
      // Send critical logs to audit service
      await fetch(`${config.app.apiUrl}/api/audit/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Fail silently to avoid infinite logging loops
    }
  }

  // Public logging methods
  public error(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.formatLogEntry(LogLevel.ERROR, component, message, metadata));
    }
  }

  public warn(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.formatLogEntry(LogLevel.WARN, component, message, metadata));
    }
  }

  public info(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.formatLogEntry(LogLevel.INFO, component, message, metadata));
    }
  }

  public debug(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.formatLogEntry(LogLevel.DEBUG, component, message, metadata));
    }
  }

  // Medical-specific logging methods
  public auditLog(action: string, component: string, details?: Record<string, any>): void {
    this.info('AUDIT', `${component}: ${action}`, details);
  }

  public securityLog(event: string, component: string, details?: Record<string, any>): void {
    this.warn('SECURITY', `${component}: ${event}`, details);
  }

  public performanceLog(
    operation: string,
    component: string,
    duration: number,
    details?: Record<string, any>
  ): void {
    this.debug('PERFORMANCE', `${component}: ${operation} took ${duration}ms`, details);
  }

  // Get logs for debugging (development only)
  public getRecentLogs(): LogEntry[] {
    if (config.isProduction) return [];
    return [...this.logBuffer];
  }

  // Clear logs
  public clearLogs(): void {
    if (!config.isProduction) {
      this.logBuffer = [];
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience functions for common use cases
export const logError = (component: string, message: string, metadata?: Record<string, any>) =>
  logger.error(component, message, metadata);

export const logWarn = (component: string, message: string, metadata?: Record<string, any>) =>
  logger.warn(component, message, metadata);

export const logInfo = (component: string, message: string, metadata?: Record<string, any>) =>
  logger.info(component, message, metadata);

export const logDebug = (component: string, message: string, metadata?: Record<string, any>) =>
  logger.debug(component, message, metadata);

export const logAudit = (action: string, component: string, details?: Record<string, any>) =>
  logger.auditLog(action, component, details);

export const logSecurity = (event: string, component: string, details?: Record<string, any>) =>
  logger.securityLog(event, component, details);

export const logPerformance = (
  operation: string,
  component: string,
  duration: number,
  details?: Record<string, any>
) => logger.performanceLog(operation, component, duration, details);
