import { logError } from './errorLogger';
import { NextResponse } from 'next/server';

// Legacy exports for backward compatibility
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  statusCode: number;
}

export class ValidationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
    this.details = details;
  }
}

export class AuthenticationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = 'AUTHENTICATION_ERROR';
    this.statusCode = 401;
  }
}

export class AuthorizationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'AUTHORIZATION_ERROR';
    this.statusCode = 403;
  }
}

export class NotFoundError extends Error {
  public code: string;
  public statusCode: number;

  constructor(resource = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.statusCode = 404;
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // Handle known error types
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle unknown errors
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: errorMessage,
      },
    },
    { status: 500 }
  );
}

export function validateRequiredFields(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new ValidationError(`Missing required field: ${field}`, 'MISSING_FIELD', { field });
    }
  }
}

export function validateStringField(value: unknown, fieldName: string, maxLength?: number): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, 'INVALID_TYPE', { field: fieldName, expected: 'string' });
    }
    if (maxLength && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`, 'TOO_LONG', { field: fieldName, maxLength });
    }
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'INVALID_EMAIL', { email });
  }
}

export function validateId(id: string, resourceName: string): void {
  if (!id || typeof id !== 'string' || id.length !== 24) {
    throw new ValidationError(`Invalid ${resourceName} ID format`, 'INVALID_ID', { id, resourceName });
  }
}

export interface ErrorContext {
  userId?: string;
  operation: string;
  timestamp: Date;
  userMessage?: string;
  systemState?: any;
  retryCount: number;
}

export interface ErrorResponse {
  message: string;
  userFriendlyMessage: string;
  errorCode: string;
  retryable: boolean;
  suggestions: string[];
  fallbackAction?: string;
}

export interface ErrorRecoveryStrategy {
  errorPattern: RegExp | string;
  recoveryAction: (error: Error, context: ErrorContext) => Promise<ErrorResponse>;
  retryLimit: number;
  fallbackMessage: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private errorHistory: Array<{ error: Error; context: ErrorContext; timestamp: Date }> = [];

  private constructor() {
    this.initializeRecoveryStrategies();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Database connection errors
    this.recoveryStrategies.push({
      errorPattern: /connection|timeout|network/i,
      recoveryAction: async (error: Error, context: ErrorContext) => ({
        message: error.message,
        userFriendlyMessage: "I'm having trouble connecting to the database right now. This might be a temporary issue.",
        errorCode: 'DB_CONNECTION_ERROR',
        retryable: true,
        suggestions: [
          "Try again in a few moments",
          "Check your internet connection",
          "Contact support if the problem persists"
        ],
        fallbackAction: 'show_cached_data'
      }),
      retryLimit: 3,
      fallbackMessage: "I'll show you the most recent data I have available."
    });

    // Authentication errors
    this.recoveryStrategies.push({
      errorPattern: /unauthorized|authentication|permission/i,
      recoveryAction: async (error: Error, context: ErrorContext) => ({
        message: error.message,
        userFriendlyMessage: "It looks like there's an authentication issue. Please try logging in again.",
        errorCode: 'AUTH_ERROR',
        retryable: false,
        suggestions: [
          "Refresh the page and try again",
          "Log out and log back in",
          "Clear your browser cache"
        ]
      }),
      retryLimit: 1,
      fallbackMessage: "Please log in again to continue."
    });

    // Rate limiting errors
    this.recoveryStrategies.push({
      errorPattern: /rate.?limit|too.?many.?requests/i,
      recoveryAction: async (error: Error, context: ErrorContext) => ({
        message: error.message,
        userFriendlyMessage: "I'm processing too many requests right now. Please wait a moment before trying again.",
        errorCode: 'RATE_LIMIT_ERROR',
        retryable: true,
        suggestions: [
          "Wait 30 seconds and try again",
          "Try a simpler request",
          "Contact support if you need immediate assistance"
        ]
      }),
      retryLimit: 2,
      fallbackMessage: "Please wait a moment before trying again."
    });

    // Data validation errors
    this.recoveryStrategies.push({
      errorPattern: /validation|invalid|format/i,
      recoveryAction: async (error: Error, context: ErrorContext) => ({
        message: error.message,
        userFriendlyMessage: "I couldn't understand the data format. Let me help you fix this.",
        errorCode: 'VALIDATION_ERROR',
        retryable: false,
        suggestions: [
          "Check the data format",
          "Try rephrasing your request",
          "Use the suggested format"
        ]
      }),
      retryLimit: 1,
      fallbackMessage: "Please check the data format and try again."
    });

    // AI model errors
    this.recoveryStrategies.push({
      errorPattern: /model|openai|gpt/i,
      recoveryAction: async (error: Error, context: ErrorContext) => ({
        message: error.message,
        userFriendlyMessage: "I'm having trouble processing your request with AI. Let me try a different approach.",
        errorCode: 'AI_MODEL_ERROR',
        retryable: true,
        suggestions: [
          "Try rephrasing your request",
          "Use simpler language",
          "Try again in a few moments"
        ],
        fallbackAction: 'use_basic_processing'
      }),
      retryLimit: 2,
      fallbackMessage: "I'll process your request using basic methods."
    });

    // Generic fallback
    this.recoveryStrategies.push({
      errorPattern: /.*/,
      recoveryAction: async (error: Error, context: ErrorContext) => ({
        message: error.message,
        userFriendlyMessage: "Something unexpected happened. I'm here to help you get back on track.",
        errorCode: 'GENERIC_ERROR',
        retryable: context.retryCount < 2,
        suggestions: [
          "Try again",
          "Refresh the page",
          "Contact support if the problem continues"
        ]
      }),
      retryLimit: 2,
      fallbackMessage: "Please try again or contact support."
    });
  }

  /**
   * Handle an error with recovery strategies
   */
  async handleError(error: Error, context: ErrorContext): Promise<ErrorResponse> {
    // Log the error
    logError(error);

    // Store in error history
    this.errorHistory.push({
      error,
      context,
      timestamp: new Date()
    });

    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }

    // Find matching recovery strategy
    const strategy = this.findRecoveryStrategy(error);
    
    if (!strategy) {
      return {
        message: error.message,
        userFriendlyMessage: "An unexpected error occurred. Please try again.",
        errorCode: 'UNKNOWN_ERROR',
        retryable: false,
        suggestions: ["Try again", "Contact support"]
      };
    }

    // Check retry limit
    if (context.retryCount >= strategy.retryLimit) {
      return {
        message: error.message,
        userFriendlyMessage: strategy.fallbackMessage,
        errorCode: 'RETRY_LIMIT_EXCEEDED',
        retryable: false,
        suggestions: ["Contact support", "Try a different approach"]
      };
    }

    // Execute recovery action
    try {
      return await strategy.recoveryAction(error, context);
    } catch (recoveryError) {
      return {
        message: error.message,
        userFriendlyMessage: strategy.fallbackMessage,
        errorCode: 'RECOVERY_FAILED',
        retryable: false,
        suggestions: ["Contact support", "Try again later"]
      };
    }
  }

  /**
   * Find the best recovery strategy for an error
   */
  private findRecoveryStrategy(error: Error): ErrorRecoveryStrategy | null {
    for (const strategy of this.recoveryStrategies) {
      if (typeof strategy.errorPattern === 'string') {
        if (error.message.toLowerCase().includes(strategy.errorPattern.toLowerCase())) {
          return strategy;
        }
      } else {
        if (strategy.errorPattern.test(error.message)) {
          return strategy;
        }
      }
    }
    return null;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: number;
    averageRetryCount: number;
  } {
    const totalErrors = this.errorHistory.length;
    const errorsByType: Record<string, number> = {};
    const recentErrors = this.errorHistory.filter(e => 
      Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    ).length;
    
    let totalRetries = 0;
    for (const error of this.errorHistory) {
      const errorType = this.getErrorType(error.error);
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      totalRetries += error.context.retryCount;
    }

    return {
      totalErrors,
      errorsByType,
      recentErrors,
      averageRetryCount: totalErrors > 0 ? totalRetries / totalErrors : 0
    };
  }

  /**
   * Get error type from error message
   */
  private getErrorType(error: Error): string {
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      return 'CONNECTION_ERROR';
    }
    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return 'AUTH_ERROR';
    }
    if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (error.message.includes('model') || error.message.includes('openai')) {
      return 'AI_MODEL_ERROR';
    }
    return 'GENERIC_ERROR';
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.unshift(strategy); // Add to beginning for priority
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 10): Array<{ error: Error; context: ErrorContext; timestamp: Date }> {
    return this.errorHistory.slice(-limit);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance(); 