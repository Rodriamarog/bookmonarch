/**
 * Centralized error handling utilities for consistent user experience
 */

import { FlaskAPIError } from './api/flask-client';

/**
 * User-friendly error with both technical and user-facing messages
 */
export class UserFriendlyError extends Error {
  constructor(
    public userMessage: string,
    public technicalMessage: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(technicalMessage);
    this.name = 'UserFriendlyError';
  }
}

/**
 * Error severity levels for different handling strategies
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Error context for better debugging and user experience
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  bookId?: string;
  additionalData?: Record<string, any>;
}

/**
 * Standardized error handling result
 */
export interface ErrorHandlingResult {
  userMessage: string;
  technicalMessage: string;
  code: string;
  severity: ErrorSeverity;
  shouldRetry: boolean;
  shouldReport: boolean;
}

/**
 * Main error handler that converts any error to a user-friendly format
 */
export function handleAPIError(
  error: unknown, 
  context?: ErrorContext
): ErrorHandlingResult {
  // Handle FlaskAPIError (most common case)
  if (error instanceof FlaskAPIError) {
    return handleFlaskAPIError(error, context);
  }
  
  // Handle UserFriendlyError (already processed)
  if (error instanceof UserFriendlyError) {
    return {
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage,
      code: error.code || 'USER_FRIENDLY_ERROR',
      severity: ErrorSeverity.ERROR,
      shouldRetry: false,
      shouldReport: true
    };
  }
  
  // Handle standard JavaScript errors
  if (error instanceof Error) {
    return handleGenericError(error, context);
  }
  
  // Handle unknown error types
  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: `Unknown error type: ${String(error)}`,
    code: 'UNKNOWN_ERROR',
    severity: ErrorSeverity.ERROR,
    shouldRetry: true,
    shouldReport: true
  };
}

/**
 * Handle FlaskAPIError with specific user-friendly messages
 */
function handleFlaskAPIError(
  error: FlaskAPIError, 
  context?: ErrorContext
): ErrorHandlingResult {
  const baseResult = {
    technicalMessage: error.message,
    code: error.code,
    severity: ErrorSeverity.ERROR,
    shouldReport: true
  };

  switch (error.code) {
    case 'GENERATION_LIMIT_EXCEEDED':
      return {
        ...baseResult,
        userMessage: 'You have reached your daily book generation limit. Please try again tomorrow or upgrade your plan.',
        severity: ErrorSeverity.WARNING,
        shouldRetry: false,
        shouldReport: false
      };

    case 'AUTH_REQUIRED':
    case 'UNAUTHORIZED':
      return {
        ...baseResult,
        userMessage: 'Please sign in to continue.',
        severity: ErrorSeverity.WARNING,
        shouldRetry: false,
        shouldReport: false
      };

    case 'VALIDATION_ERROR':
    case 'MISSING_REQUIRED_FIELDS':
      return {
        ...baseResult,
        userMessage: 'Please check your input and try again.',
        severity: ErrorSeverity.WARNING,
        shouldRetry: false,
        shouldReport: false
      };

    case 'BOOK_NOT_FOUND':
      return {
        ...baseResult,
        userMessage: 'The requested book could not be found. It may have been deleted.',
        severity: ErrorSeverity.WARNING,
        shouldRetry: false,
        shouldReport: false
      };

    case 'NETWORK_ERROR':
    case 'TIMEOUT_ERROR':
      return {
        ...baseResult,
        userMessage: 'Network connection issue. Please check your internet and try again.',
        severity: ErrorSeverity.WARNING,
        shouldRetry: true,
        shouldReport: false
      };

    case 'RATE_LIMIT_EXCEEDED':
      return {
        ...baseResult,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        severity: ErrorSeverity.WARNING,
        shouldRetry: true,
        shouldReport: false
      };

    case 'DATABASE_ERROR':
    case 'INTERNAL_SERVER_ERROR':
      return {
        ...baseResult,
        userMessage: 'A server error occurred. Our team has been notified. Please try again later.',
        severity: ErrorSeverity.ERROR,
        shouldRetry: true,
        shouldReport: true
      };

    case 'GENERATION_FAILED':
      return {
        ...baseResult,
        userMessage: 'Book generation failed. Please try again with different parameters.',
        severity: ErrorSeverity.ERROR,
        shouldRetry: true,
        shouldReport: true
      };

    default:
      // Handle HTTP status codes
      if (error.statusCode) {
        return handleHTTPError(error.statusCode, error.message, context);
      }
      
      return {
        ...baseResult,
        userMessage: 'Something went wrong. Please try again.',
        shouldRetry: true
      };
  }
}

/**
 * Handle generic JavaScript errors
 */
function handleGenericError(
  error: Error, 
  context?: ErrorContext
): ErrorHandlingResult {
  // Handle specific error types by name or message
  if (error.name === 'AbortError' || error.message.includes('aborted')) {
    return {
      userMessage: 'Operation was cancelled.',
      technicalMessage: error.message,
      code: 'OPERATION_CANCELLED',
      severity: ErrorSeverity.INFO,
      shouldRetry: false,
      shouldReport: false
    };
  }

  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      userMessage: 'Network connection issue. Please check your internet and try again.',
      technicalMessage: error.message,
      code: 'NETWORK_ERROR',
      severity: ErrorSeverity.WARNING,
      shouldRetry: true,
      shouldReport: false
    };
  }

  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: error.message,
    code: 'GENERIC_ERROR',
    severity: ErrorSeverity.ERROR,
    shouldRetry: true,
    shouldReport: true
  };
}

/**
 * Handle HTTP status codes
 */
function handleHTTPError(
  statusCode: number, 
  message: string, 
  context?: ErrorContext
): ErrorHandlingResult {
  const baseResult = {
    technicalMessage: message,
    code: `HTTP_${statusCode}`,
    severity: ErrorSeverity.ERROR,
    shouldReport: true
  };

  if (statusCode >= 400 && statusCode < 500) {
    // Client errors
    return {
      ...baseResult,
      userMessage: statusCode === 404 
        ? 'The requested resource was not found.'
        : 'There was an issue with your request. Please check your input and try again.',
      severity: ErrorSeverity.WARNING,
      shouldRetry: false,
      shouldReport: false
    };
  }

  if (statusCode >= 500) {
    // Server errors
    return {
      ...baseResult,
      userMessage: 'A server error occurred. Our team has been notified. Please try again later.',
      severity: ErrorSeverity.ERROR,
      shouldRetry: true,
      shouldReport: true
    };
  }

  return {
    ...baseResult,
    userMessage: 'Something went wrong. Please try again.',
    shouldRetry: true
  };
}

/**
 * Log error with context for debugging
 */
export function logError(
  error: unknown, 
  context?: ErrorContext,
  result?: ErrorHandlingResult
): void {
  const logData = {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context,
    result,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
  };

  // Always log to console for development
  if (result?.severity === ErrorSeverity.CRITICAL || result?.severity === ErrorSeverity.ERROR) {
    console.error('Error occurred:', logData);
  } else if (result?.severity === ErrorSeverity.WARNING) {
    console.warn('Warning occurred:', logData);
  } else {
    console.info('Info event:', logData);
  }

  // In production, you might want to send critical errors to an error reporting service
  if (result?.shouldReport && typeof window !== 'undefined') {
    // Example: Send to error reporting service
    // errorReportingService.report(logData);
  }
}

/**
 * Create a standardized error handler function for React components
 */
export function createErrorHandler(context?: ErrorContext) {
  return (error: unknown): ErrorHandlingResult => {
    const result = handleAPIError(error, context);
    logError(error, context, result);
    return result;
  };
}

/**
 * Hook-friendly error handler that returns user message and technical details
 */
export function useErrorHandler(context?: ErrorContext) {
  const handleError = createErrorHandler(context);
  
  return {
    handleError,
    getUserMessage: (error: unknown): string => handleError(error).userMessage,
    getTechnicalMessage: (error: unknown): string => handleError(error).technicalMessage,
    shouldRetry: (error: unknown): boolean => handleError(error).shouldRetry
  };
}

/**
 * Utility to create user-friendly errors
 */
export function createUserFriendlyError(
  userMessage: string,
  technicalMessage?: string,
  code?: string,
  originalError?: unknown
): UserFriendlyError {
  return new UserFriendlyError(
    userMessage,
    technicalMessage || userMessage,
    code,
    originalError
  );
}

/**
 * Common error messages for consistency
 */
export const ErrorMessages = {
  NETWORK_ISSUE: 'Network connection issue. Please check your internet and try again.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  NOT_FOUND: 'The requested item could not be found.',
  SERVER_ERROR: 'A server error occurred. Our team has been notified. Please try again later.',
  GENERATION_LIMIT: 'You have reached your daily book generation limit. Please try again tomorrow or upgrade your plan.',
  OPERATION_CANCELLED: 'Operation was cancelled.'
} as const; 