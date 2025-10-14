/**
 * AI Service Error Classification System
 * Provides specific, actionable error messages for different failure scenarios
 */

export enum AIErrorCode {
  // Network Errors (1xx)
  NETWORK_TIMEOUT = 'AI_ERR_101',
  NETWORK_OFFLINE = 'AI_ERR_102',
  CONNECTION_REFUSED = 'AI_ERR_103',

  // API Errors (2xx)
  RATE_LIMIT_EXCEEDED = 'AI_ERR_201',
  AUTHENTICATION_FAILED = 'AI_ERR_202',
  INVALID_API_KEY = 'AI_ERR_203',
  MODEL_NOT_FOUND = 'AI_ERR_204',
  MODEL_ACCESS_DENIED = 'AI_ERR_205',
  SERVICE_UNAVAILABLE = 'AI_ERR_206',

  // Validation Errors (3xx)
  INVALID_INPUT = 'AI_ERR_301',
  TRANSCRIPT_TOO_SHORT = 'AI_ERR_302',
  TRANSCRIPT_TOO_LONG = 'AI_ERR_303',
  INVALID_RESPONSE_FORMAT = 'AI_ERR_304',
  TEMPLATE_VALIDATION_FAILED = 'AI_ERR_305',

  // Processing Errors (4xx)
  PARSING_FAILED = 'AI_ERR_401',
  QUALITY_CHECK_FAILED = 'AI_ERR_402',
  COMPLIANCE_FAILED = 'AI_ERR_403',
  EXTRACTION_FAILED = 'AI_ERR_404',

  // System Errors (5xx)
  UNKNOWN_ERROR = 'AI_ERR_501',
  FALLBACK_FAILED = 'AI_ERR_502',
  CONFIG_ERROR = 'AI_ERR_503'
}

export enum AIErrorCategory {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  SYSTEM = 'system'
}

export interface AIErrorDetails {
  code: AIErrorCode;
  category: AIErrorCategory;
  userMessage: string;
  technicalMessage: string;
  troubleshooting: string[];
  retryable: boolean;
  estimatedFixTime?: string;
}

export class AIServiceError extends Error {
  public code: AIErrorCode;
  public category: AIErrorCategory;
  public userMessage: string;
  public technicalMessage: string;
  public troubleshooting: string[];
  public retryable: boolean;
  public estimatedFixTime?: string;
  public originalError?: any;

  constructor(details: AIErrorDetails, originalError?: any) {
    super(details.userMessage);
    this.name = 'AIServiceError';
    this.code = details.code;
    this.category = details.category;
    this.userMessage = details.userMessage;
    this.technicalMessage = details.technicalMessage;
    this.troubleshooting = details.troubleshooting;
    this.retryable = details.retryable;
    this.estimatedFixTime = details.estimatedFixTime;
    this.originalError = originalError;
  }
}

// Error Classification Functions

export function classifyError(error: any): AIServiceError {
  // Network Errors
  if (error?.message?.toLowerCase().includes('network') ||
      error?.message?.toLowerCase().includes('timeout')) {
    return createNetworkTimeoutError(error);
  }

  if (error?.message?.toLowerCase().includes('offline') ||
      error?.code === 'ENOTFOUND') {
    return createNetworkOfflineError(error);
  }

  // Rate Limiting
  if (error?.name === 'TooManyRequestsException' ||
      error?.name === 'ThrottlingException' ||
      error?.$metadata?.httpStatusCode === 429 ||
      error?.message?.toLowerCase().includes('too many requests') ||
      error?.message?.toLowerCase().includes('rate limit')) {
    return createRateLimitError(error);
  }

  // Authentication / Access Errors
  if (error?.name === 'AccessDeniedException' ||
      error?.$metadata?.httpStatusCode === 403 ||
      error?.message?.toLowerCase().includes('not authorized') ||
      error?.message?.toLowerCase().includes('access denied')) {
    return createAccessDeniedError(error);
  }

  if (error?.$metadata?.httpStatusCode === 401 ||
      error?.message?.toLowerCase().includes('authentication') ||
      error?.message?.toLowerCase().includes('invalid api key')) {
    return createAuthenticationError(error);
  }

  // Model Errors
  if (error?.name === 'ValidationException' ||
      error?.message?.toLowerCase().includes('model') ||
      error?.message?.toLowerCase().includes('not found')) {
    return createModelNotFoundError(error);
  }

  // Service Unavailable
  if (error?.$metadata?.httpStatusCode === 503 ||
      error?.message?.toLowerCase().includes('service unavailable') ||
      error?.message?.toLowerCase().includes('temporarily unavailable')) {
    return createServiceUnavailableError(error);
  }

  // Parsing / Processing Errors
  if (error?.message?.toLowerCase().includes('parse') ||
      error?.message?.toLowerCase().includes('json') ||
      error?.message?.toLowerCase().includes('invalid format')) {
    return createParsingError(error);
  }

  // Default to unknown error
  return createUnknownError(error);
}

// Specific Error Creators

function createNetworkTimeoutError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.NETWORK_TIMEOUT,
    category: AIErrorCategory.NETWORK,
    userMessage: 'The AI service is taking too long to respond. Your internet connection may be slow.',
    technicalMessage: 'Network request timed out while communicating with AI service',
    troubleshooting: [
      'Check your internet connection',
      'Try again in a few moments',
      'If the problem persists, contact support'
    ],
    retryable: true,
    estimatedFixTime: '1-2 minutes'
  }, originalError);
}

function createNetworkOfflineError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.NETWORK_OFFLINE,
    category: AIErrorCategory.NETWORK,
    userMessage: 'Unable to reach the AI service. Please check your internet connection.',
    technicalMessage: 'Network connection unavailable or DNS resolution failed',
    troubleshooting: [
      'Verify you are connected to the internet',
      'Try refreshing the page',
      'Check your firewall or VPN settings'
    ],
    retryable: true,
    estimatedFixTime: 'Immediate (after reconnecting)'
  }, originalError);
}

function createRateLimitError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.RATE_LIMIT_EXCEEDED,
    category: AIErrorCategory.API,
    userMessage: 'The AI service is experiencing high demand. Please wait a moment before trying again.',
    technicalMessage: 'API rate limit exceeded or throttling applied',
    troubleshooting: [
      'Wait 30-60 seconds before retrying',
      'The system will automatically retry with exponential backoff',
      'Consider processing notes during off-peak hours'
    ],
    retryable: true,
    estimatedFixTime: '30-90 seconds'
  }, originalError);
}

function createAccessDeniedError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.MODEL_ACCESS_DENIED,
    category: AIErrorCategory.API,
    userMessage: 'Access to the AI model is not configured. Please contact your administrator.',
    technicalMessage: 'AWS Bedrock model access not enabled or insufficient permissions',
    troubleshooting: [
      'Verify AWS Bedrock Claude models are enabled in the AWS console',
      'Check IAM permissions include bedrock:InvokeModel',
      'Enable model access at: https://console.aws.amazon.com/bedrock/',
      'Contact your system administrator if you cannot access AWS console'
    ],
    retryable: false,
    estimatedFixTime: '5-10 minutes (after enabling access)'
  }, originalError);
}

function createAuthenticationError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.AUTHENTICATION_FAILED,
    category: AIErrorCategory.API,
    userMessage: 'Authentication with the AI service failed. Please check your configuration.',
    technicalMessage: 'Invalid API credentials or authentication token expired',
    troubleshooting: [
      'Verify your API keys are correctly configured',
      'Check that API keys have not expired',
      'Ensure environment variables are properly set',
      'Contact support if the issue persists'
    ],
    retryable: false,
    estimatedFixTime: '2-5 minutes (after fixing credentials)'
  }, originalError);
}

function createModelNotFoundError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.MODEL_NOT_FOUND,
    category: AIErrorCategory.API,
    userMessage: 'The requested AI model is not available. Trying alternative models...',
    technicalMessage: 'Specified AI model not found or not accessible in the current region',
    troubleshooting: [
      'The system will automatically try alternative models',
      'Verify model IDs are correct in configuration',
      'Check AWS region supports the requested model',
      'Enable Claude models in AWS Bedrock console'
    ],
    retryable: true,
    estimatedFixTime: 'Immediate (auto-fallback)'
  }, originalError);
}

function createServiceUnavailableError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.SERVICE_UNAVAILABLE,
    category: AIErrorCategory.API,
    userMessage: 'The AI service is temporarily unavailable. Please try again in a few minutes.',
    technicalMessage: 'AI service returned 503 Service Unavailable',
    troubleshooting: [
      'Wait 2-3 minutes and try again',
      'Check AWS status page for service outages',
      'The system will automatically retry',
      'Your transcript has been saved and can be processed later'
    ],
    retryable: true,
    estimatedFixTime: '2-5 minutes'
  }, originalError);
}

function createParsingError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.PARSING_FAILED,
    category: AIErrorCategory.PROCESSING,
    userMessage: 'Unable to process the AI response. Trying again with a different approach...',
    technicalMessage: 'Failed to parse AI response - invalid JSON or unexpected format',
    troubleshooting: [
      'The system will automatically retry with adjusted parameters',
      'If the issue persists, try simplifying your transcript',
      'Consider using a different template',
      'Contact support if retries fail'
    ],
    retryable: true,
    estimatedFixTime: 'Immediate (auto-retry)'
  }, originalError);
}

function createUnknownError(originalError?: any): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.UNKNOWN_ERROR,
    category: AIErrorCategory.SYSTEM,
    userMessage: 'An unexpected error occurred while processing your note. Please try again.',
    technicalMessage: `Unhandled error: ${originalError?.message || 'Unknown error'}`,
    troubleshooting: [
      'Try processing the transcript again',
      'Refresh the page and retry',
      'If the problem persists, contact support with error code: ' + AIErrorCode.UNKNOWN_ERROR,
      'Your transcript is saved locally and has not been lost'
    ],
    retryable: true,
    estimatedFixTime: 'Unknown'
  }, originalError);
}

// Input Validation Errors

export function createTranscriptTooShortError(): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.TRANSCRIPT_TOO_SHORT,
    category: AIErrorCategory.VALIDATION,
    userMessage: 'Your transcript is too short to process. Please record more content.',
    technicalMessage: 'Transcript length below minimum threshold',
    troubleshooting: [
      'Record at least 3-4 sentences of dictation',
      'Speak clearly and ensure your microphone is working',
      'Try the "Start Recording" button again'
    ],
    retryable: false
  });
}

export function createTranscriptTooLongError(): AIServiceError {
  return new AIServiceError({
    code: AIErrorCode.TRANSCRIPT_TOO_LONG,
    category: AIErrorCategory.VALIDATION,
    userMessage: 'Your transcript is too long. Please break it into smaller sections.',
    technicalMessage: 'Transcript exceeds maximum token limit',
    troubleshooting: [
      'Split your dictation into 2-3 shorter notes',
      'Focus on one patient encounter per note',
      'Consider using bulleted summaries instead of full narratives'
    ],
    retryable: false,
    estimatedFixTime: 'Immediate (after splitting)'
  });
}

// Helper Functions

export function isRetryableError(error: any): boolean {
  if (error instanceof AIServiceError) {
    return error.retryable;
  }

  const classified = classifyError(error);
  return classified.retryable;
}

export function getErrorCategory(error: any): AIErrorCategory {
  if (error instanceof AIServiceError) {
    return error.category;
  }

  const classified = classifyError(error);
  return classified.category;
}

export function formatErrorForUser(error: any): string {
  const classified = error instanceof AIServiceError ? error : classifyError(error);

  let message = `⚠️ ${classified.userMessage}\n\n`;

  if (classified.estimatedFixTime) {
    message += `Estimated resolution time: ${classified.estimatedFixTime}\n\n`;
  }

  message += 'What you can do:\n';
  classified.troubleshooting.forEach((step, index) => {
    message += `${index + 1}. ${step}\n`;
  });

  if (classified.code) {
    message += `\nError Code: ${classified.code}`;
  }

  return message;
}
