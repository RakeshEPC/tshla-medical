import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
/**
 * Circuit Breaker Pattern Implementation for TSHLA Medical
 * Prevents cascading failures by monitoring service health
 * HIPAA Compliant with proper error logging
 */

class CircuitBreaker {
  constructor(service, options = {}) {
    this.service = service;
    this.name = options.name || 'UnknownService';
    
    // Circuit breaker configuration
    this.failureThreshold = options.failureThreshold || 5; // failures before opening
    this.successThreshold = options.successThreshold || 3; // successes to close
    this.timeout = options.timeout || 30000; // 30 seconds timeout
    this.monitor = options.monitor || 60000; // 1 minute monitoring window
    
    // State tracking
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = 0;
    
    // Statistics for monitoring
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      stateChanges: [],
      lastStateChange: null,
      avgResponseTime: 0,
      uptime: 100
    };
    
    logDebug('App', '$1', $2);
    
    // Start health monitoring
    this.startHealthMonitoring();
  }
  
  /**
   * Execute service call with circuit breaker protection
   */
  async execute(operation, ...args) {
    this.stats.totalRequests++;
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `${this.name} circuit is OPEN. Next attempt in ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`,
          'CIRCUIT_OPEN'
        );
      }
      // Transition to HALF_OPEN to test service
      this.changeState('HALF_OPEN');
    }
    
    const startTime = Date.now();
    
    try {
      // Execute the service operation
      const result = await Promise.race([
        operation.call(this.service, ...args),
        this.createTimeoutPromise()
      ]);
      
      // Record success
      this.onSuccess(Date.now() - startTime);
      return result;
      
    } catch (error) {
      // Record failure
      this.onFailure(error);
      throw error;
    }
  }
  
  /**
   * Handle successful operation
   */
  onSuccess(responseTime) {
    this.stats.totalSuccesses++;
    this.successCount++;
    this.failureCount = 0; // Reset failure count on success
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);
    
    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.successThreshold) {
        this.changeState('CLOSED');
        this.successCount = 0;
      }
    }
    
    // Log success for monitoring
    logInfo('App', '$1', $2);
  }
  
  /**
   * Handle failed operation
   */
  onFailure(error) {
    this.stats.totalFailures++;
    this.failureCount++;
    this.successCount = 0; // Reset success count on failure
    this.lastFailureTime = Date.now();
    
    // Log failure (without PHI)
    logError('App', '$1', $2).toISOString()
    });
    
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.changeState('OPEN');
      this.nextAttemptTime = Date.now() + this.timeout;
    }
  }
  
  /**
   * Change circuit breaker state
   */
  changeState(newState) {
    const previousState = this.state;
    this.state = newState;
    this.stats.lastStateChange = Date.now();
    this.stats.stateChanges.push({
      from: previousState,
      to: newState,
      timestamp: new Date().toISOString(),
      reason: this.getStateChangeReason(previousState, newState)
    });
    
    // Keep only last 50 state changes for memory management
    if (this.stats.stateChanges.length > 50) {
      this.stats.stateChanges = this.stats.stateChanges.slice(-50);
    }
    
    logDebug('App', '$1', $2);
    
    // Reset counters when returning to CLOSED
    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }
  
  /**
   * Get reason for state change
   */
  getStateChangeReason(from, to) {
    if (from === 'CLOSED' && to === 'OPEN') {
      return `Failure threshold reached (${this.failureCount}/${this.failureThreshold})`;
    }
    if (from === 'OPEN' && to === 'HALF_OPEN') {
      return `Timeout expired, testing service availability`;
    }
    if (from === 'HALF_OPEN' && to === 'CLOSED') {
      return `Service recovered (${this.successCount}/${this.successThreshold} successes)`;
    }
    if (from === 'HALF_OPEN' && to === 'OPEN') {
      return `Service still failing, reopening circuit`;
    }
    return 'Unknown transition';
  }
  
  /**
   * Create timeout promise for operation timeout
   */
  createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new CircuitBreakerError(
          `${this.name} operation timed out after ${this.timeout}ms`,
          'TIMEOUT'
        ));
      }, this.timeout);
    });
  }
  
  /**
   * Update average response time with exponential smoothing
   */
  updateAverageResponseTime(responseTime) {
    if (this.stats.avgResponseTime === 0) {
      this.stats.avgResponseTime = responseTime;
    } else {
      // Exponential smoothing (α = 0.1)
      this.stats.avgResponseTime = (0.1 * responseTime) + (0.9 * this.stats.avgResponseTime);
    }
  }
  
  /**
   * Start health monitoring and uptime calculation
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.calculateUptime();
    }, this.monitor);
  }
  
  /**
   * Calculate service uptime percentage
   */
  calculateUptime() {
    if (this.stats.totalRequests === 0) {
      this.stats.uptime = 100;
      return;
    }
    
    const successRate = (this.stats.totalSuccesses / this.stats.totalRequests) * 100;
    this.stats.uptime = Math.round(successRate * 100) / 100;
  }
  
  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime,
      stats: {
        ...this.stats,
        currentTime: Date.now()
      }
    };
  }
  
  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = 0;
    logDebug('App', '$1', $2);
  }
  
  /**
   * Check if service is available
   */
  isServiceAvailable() {
    return this.state !== 'OPEN' || Date.now() >= this.nextAttemptTime;
  }
}

/**
 * Custom error class for circuit breaker failures
 */
class CircuitBreakerError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Circuit breaker manager for multiple services
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    logDebug('App', '$1', $2);
  }
  
  /**
   * Create or get circuit breaker for service
   */
  getBreaker(serviceName, service, options = {}) {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(
        serviceName,
        new CircuitBreaker(service, { ...options, name: serviceName })
      );
    }
    return this.breakers.get(serviceName);
  }
  
  /**
   * Get status of all circuit breakers
   */
  getAllStatuses() {
    const statuses = {};
    for (const [name, breaker] of this.breakers) {
      statuses[name] = breaker.getStatus();
    }
    return statuses;
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logDebug('App', '$1', $2);
  }
  
  /**
   * Get health summary
   */
  getHealthSummary() {
    const statuses = this.getAllStatuses();
    const total = Object.keys(statuses).length;
    const healthy = Object.values(statuses).filter(s => s.state === 'CLOSED').length;
    const degraded = Object.values(statuses).filter(s => s.state === 'HALF_OPEN').length;
    const failed = Object.values(statuses).filter(s => s.state === 'OPEN').length;
    
    return {
      totalServices: total,
      healthy,
      degraded,
      failed,
      overallHealth: total === 0 ? 100 : Math.round((healthy / total) * 100),
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerManager,
  circuitBreakerManager
};