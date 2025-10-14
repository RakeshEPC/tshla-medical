/**
 * Intelligent Retry Strategy Service
 * Handles automatic retries with exponential backoff based on error classification
 */

import { AIServiceError, classifyError, isRetryableError, AIErrorCode } from './aiErrors';
import { logDebug, logInfo, logWarn, logError } from './logger.service';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitterMax: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: AIServiceError;
  attempts: number;
  totalDelay: number;
}

export interface RetryAttemptInfo {
  attemptNumber: number;
  totalAttempts: number;
  delayMs: number;
  reason: string;
}

export type RetryCallback = (info: RetryAttemptInfo) => void;

class RetryStrategyService {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
    jitterMax: 1000
  };

  /**
   * Execute a function with automatic retry for recoverable errors
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    customConfig?: Partial<RetryConfig>,
    onRetry?: RetryCallback
  ): Promise<T> {
    const config = { ...this.defaultConfig, ...customConfig };
    let attempts = 0;
    let totalDelay = 0;
    let lastError: AIServiceError | undefined;

    while (attempts <= config.maxRetries) {
      try {
        logDebug('retryStrategy', `Attempt ${attempts + 1}/${config.maxRetries + 1}`);

        const result = await fn();

        if (attempts > 0) {
          logInfo('retryStrategy', `Success after ${attempts} retry attempts`, {
            totalDelay,
            attempts
          });
        }

        return result;
      } catch (error: any) {
        attempts++;
        lastError = error instanceof AIServiceError ? error : classifyError(error);

        // Check if error is retryable
        if (!lastError.retryable) {
          logWarn('retryStrategy', 'Non-retryable error encountered', {
            code: lastError.code,
            message: lastError.userMessage
          });
          throw lastError;
        }

        // Check if we've exhausted retries
        if (attempts > config.maxRetries) {
          logError('retryStrategy', 'Max retries exceeded', {
            attempts,
            totalDelay,
            lastError: lastError.code
          });
          throw lastError;
        }

        // Calculate delay based on error type
        const delay = this.calculateDelay(lastError, attempts, config);
        totalDelay += delay;

        logInfo('retryStrategy', `Retrying after ${delay}ms`, {
          attempt: attempts,
          maxRetries: config.maxRetries,
          errorCode: lastError.code,
          totalDelay
        });

        // Notify callback if provided
        if (onRetry) {
          onRetry({
            attemptNumber: attempts,
            totalAttempts: config.maxRetries + 1,
            delayMs: delay,
            reason: lastError.userMessage
          });
        }

        // Wait before retrying
        await this.delay(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed with unknown error');
  }

  /**
   * Calculate intelligent delay based on error type and attempt number
   */
  private calculateDelay(error: AIServiceError, attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (error.code) {
      case AIErrorCode.RATE_LIMIT_EXCEEDED:
        // Aggressive backoff for rate limits: 10s, 20s, 40s...
        delay = Math.min(
          10000 * Math.pow(2, attempt - 1),
          config.maxDelay
        );
        break;

      case AIErrorCode.SERVICE_UNAVAILABLE:
        // Moderate backoff for service issues: 5s, 10s, 20s...
        delay = Math.min(
          5000 * Math.pow(config.exponentialBase, attempt - 1),
          config.maxDelay
        );
        break;

      case AIErrorCode.NETWORK_TIMEOUT:
      case AIErrorCode.NETWORK_OFFLINE:
        // Quick retry for network issues: 2s, 4s, 8s...
        delay = Math.min(
          2000 * Math.pow(config.exponentialBase, attempt - 1),
          15000
        );
        break;

      case AIErrorCode.PARSING_FAILED:
      case AIErrorCode.MODEL_NOT_FOUND:
        // Immediate retry for processing errors
        delay = 500;
        break;

      default:
        // Standard exponential backoff
        delay = Math.min(
          config.baseDelay * Math.pow(config.exponentialBase, attempt - 1),
          config.maxDelay
        );
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * config.jitterMax;
    return Math.round(delay + jitter);
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recommended retry config for specific error
   */
  getRecommendedConfig(error: AIServiceError): RetryConfig {
    switch (error.code) {
      case AIErrorCode.RATE_LIMIT_EXCEEDED:
        return {
          maxRetries: 5,
          baseDelay: 10000,
          maxDelay: 90000,
          exponentialBase: 2,
          jitterMax: 5000
        };

      case AIErrorCode.SERVICE_UNAVAILABLE:
        return {
          maxRetries: 4,
          baseDelay: 5000,
          maxDelay: 30000,
          exponentialBase: 2,
          jitterMax: 2000
        };

      case AIErrorCode.NETWORK_TIMEOUT:
      case AIErrorCode.NETWORK_OFFLINE:
        return {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 15000,
          exponentialBase: 2,
          jitterMax: 1000
        };

      case AIErrorCode.PARSING_FAILED:
      case AIErrorCode.MODEL_NOT_FOUND:
        return {
          maxRetries: 2,
          baseDelay: 500,
          maxDelay: 2000,
          exponentialBase: 1.5,
          jitterMax: 500
        };

      default:
        return this.defaultConfig;
    }
  }

  /**
   * Execute with automatic fallback to alternative method
   */
  async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    primaryRetryConfig?: Partial<RetryConfig>,
    fallbackRetryConfig?: Partial<RetryConfig>,
    onRetry?: RetryCallback
  ): Promise<T> {
    try {
      return await this.executeWithRetry(primaryFn, primaryRetryConfig, onRetry);
    } catch (primaryError) {
      logWarn('retryStrategy', 'Primary method failed, attempting fallback', {
        primaryError: primaryError instanceof AIServiceError ? primaryError.code : 'Unknown'
      });

      try {
        return await this.executeWithRetry(fallbackFn, fallbackRetryConfig, onRetry);
      } catch (fallbackError) {
        logError('retryStrategy', 'Both primary and fallback methods failed', {
          primaryError: primaryError instanceof AIServiceError ? primaryError.code : 'Unknown',
          fallbackError: fallbackError instanceof AIServiceError ? fallbackError.code : 'Unknown'
        });
        throw fallbackError;
      }
    }
  }

  /**
   * Batch retry with circuit breaker pattern
   */
  private circuitBreakerState: {
    failures: number;
    lastFailureTime: number;
    isOpen: boolean;
  } = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false
  };

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>,
    onRetry?: RetryCallback
  ): Promise<T> {
    // Check if circuit breaker is open
    if (this.circuitBreakerState.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerState.lastFailureTime;

      if (timeSinceLastFailure < this.CIRCUIT_BREAKER_TIMEOUT) {
        logWarn('retryStrategy', 'Circuit breaker is open, rejecting request', {
          failures: this.circuitBreakerState.failures,
          timeRemaining: this.CIRCUIT_BREAKER_TIMEOUT - timeSinceLastFailure
        });
        throw new Error(`Service temporarily unavailable due to repeated failures. Please wait ${Math.ceil((this.CIRCUIT_BREAKER_TIMEOUT - timeSinceLastFailure) / 1000)} seconds.`);
      } else {
        // Reset circuit breaker after timeout
        logInfo('retryStrategy', 'Circuit breaker timeout expired, attempting half-open state');
        this.circuitBreakerState.isOpen = false;
        this.circuitBreakerState.failures = 0;
      }
    }

    try {
      const result = await this.executeWithRetry(fn, config, onRetry);

      // Success - reset circuit breaker
      if (this.circuitBreakerState.failures > 0) {
        logInfo('retryStrategy', 'Request successful, resetting circuit breaker');
        this.circuitBreakerState.failures = 0;
      }

      return result;
    } catch (error) {
      // Increment failure counter
      this.circuitBreakerState.failures++;
      this.circuitBreakerState.lastFailureTime = Date.now();

      // Open circuit breaker if threshold exceeded
      if (this.circuitBreakerState.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreakerState.isOpen = true;
        logError('retryStrategy', 'Circuit breaker opened due to repeated failures', {
          failures: this.circuitBreakerState.failures,
          timeout: this.CIRCUIT_BREAKER_TIMEOUT
        });
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker status
   */
  getCircuitBreakerStatus(): {
    isOpen: boolean;
    failures: number;
    timeUntilReset: number;
  } {
    const timeUntilReset = this.circuitBreakerState.isOpen
      ? Math.max(0, this.CIRCUIT_BREAKER_TIMEOUT - (Date.now() - this.circuitBreakerState.lastFailureTime))
      : 0;

    return {
      isOpen: this.circuitBreakerState.isOpen,
      failures: this.circuitBreakerState.failures,
      timeUntilReset
    };
  }
}

export const retryStrategyService = new RetryStrategyService();
