/**
 * AI Request Queue Service
 * Manages rate limiting and request queuing for AWS Bedrock API calls
 * Ensures system scalability for multiple concurrent users
 */

import { azureAIService } from './_deprecated/azureAI.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface QueuedRequest {
  id: string;
  userId: string;
  priority: number; // 1 = highest priority
  request: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  timestamp: number;
}

class AIRequestQueueService {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private lastRequestTime = 0;

  // Rate limiting configuration
  private readonly MAX_REQUESTS_PER_MINUTE = 30; // Conservative limit
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  // Request tracking for rate limiting
  private requestTimestamps: number[] = [];

  // Response cache to reduce API calls
  private responseCache = new Map<string, { response: any; timestamp: number }>();
  private readonly CACHE_DURATION = 3600000; // 1 hour

  /**
   * Add a request to the queue
   */
  async queueRequest<T>(
    userId: string,
    requestFn: () => Promise<T>,
    priority: number = 5,
    cacheKey?: string
  ): Promise<T> {
    // Check cache first
    if (cacheKey) {
      const cached = this.responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        logDebug('aiRequestQueue', 'Debug message', {});
        return cached.response as T;
      }
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${userId}-${Date.now()}-${Math.random()}`,
        userId,
        priority,
        request: requestFn,
        resolve: value => {
          // Cache the response if a cache key was provided
          if (cacheKey) {
            this.responseCache.set(cacheKey, { response: value, timestamp: Date.now() });
          }
          resolve(value);
        },
        reject,
        retryCount: 0,
        timestamp: Date.now(),
      };

      // Add to queue sorted by priority
      this.queue.push(request);
      this.queue.sort((a, b) => a.priority - b.priority);

      logDebug('aiRequestQueue', 'Debug message', {});

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue with rate limiting
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check rate limits
      await this.enforceRateLimit();

      const request = this.queue.shift()!;

      try {
        logDebug('aiRequestQueue', 'Debug message', {});
        const result = await request.request();
        request.resolve(result);

        // Track successful request
        this.requestTimestamps.push(Date.now());
        this.lastRequestTime = Date.now();
      } catch (error: any) {
        logError('aiRequestQueue', 'Error message', {});

        // Handle 429 errors with retry
        if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
          if (request.retryCount < this.MAX_RETRIES) {
            request.retryCount++;
            logDebug('aiRequestQueue', 'Debug message', {});

            // Add back to queue with higher priority
            request.priority = Math.max(1, request.priority - 1);
            this.queue.unshift(request);

            // Wait before retrying
            await new Promise(resolve =>
              setTimeout(resolve, this.RETRY_DELAY * request.retryCount)
            );
          } else {
            request.reject(new Error('Max retries exceeded due to rate limiting'));
          }
        } else {
          request.reject(error);
        }
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL));
    }

    this.processing = false;
    logDebug('aiRequestQueue', 'Debug message', {});
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit() {
    // Clean old timestamps
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    // If we're at the limit, wait
    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = 60000 - (Date.now() - oldestRequest) + 1000; // Add 1s buffer

      if (waitTime > 0) {
        logDebug('aiRequestQueue', 'Debug message', {});
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Ensure minimum interval between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestsInLastMinute: this.requestTimestamps.length,
      cacheSize: this.responseCache.size,
    };
  }

  /**
   * Clear cache (for testing or memory management)
   */
  clearCache() {
    this.responseCache.clear();
  }

  /**
   * Get estimated wait time for a new request
   */
  getEstimatedWaitTime(): number {
    const queueTime = this.queue.length * this.MIN_REQUEST_INTERVAL;
    const rateLimit = Math.max(
      0,
      (this.requestTimestamps.length - this.MAX_REQUESTS_PER_MINUTE + 1) * 2000
    );
    return Math.max(queueTime, rateLimit);
  }
}

export const aiRequestQueue = new AIRequestQueueService();

/**
 * Wrapper for PumpDrive AI requests with intelligent batching
 */
export async function processPumpDriveCategory(
  userId: string,
  category: string,
  transcript: string,
  patientNeeds: string[],
  prompt: string
): Promise<any> {
  // Create a cache key based on category and key patient needs
  const cacheKey = `pumpdrive-${category}-${patientNeeds.slice(0, 3).join('-')}`;

  return aiRequestQueue.queueRequest(
    userId,
    async () => {
      // Call Azure AI with the full prompt
      return azureAIService.generateResponse('', null, 'custom', null, prompt);
    },
    5, // Normal priority
    cacheKey
  );
}

/**
 * Process final report with higher priority
 */
export async function processPumpDriveFinalReport(userId: string, prompt: string): Promise<any> {
  // Don't cache final reports as they're unique per user
  return aiRequestQueue.queueRequest(
    userId,
    async () => {
      // Call Azure AI with the full prompt
      return azureAIService.generateResponse('', null, 'custom', null, prompt);
    },
    1 // Highest priority for final reports
  );
}
