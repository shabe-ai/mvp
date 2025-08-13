import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

export interface ErrorContext {
  userId?: string;
  operation?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  [key: string]: any;
}

export interface ErrorSeverity {
  LOW: 'low';
  MEDIUM: 'medium';
  HIGH: 'high';
  CRITICAL: 'critical';
}

export interface ErrorCategory {
  AUTHENTICATION: 'authentication';
  AUTHORIZATION: 'authorization';
  VALIDATION: 'validation';
  DATABASE: 'database';
  LLM: 'llm';
  API: 'api';
  NETWORK: 'network';
  SYSTEM: 'system';
  UNKNOWN: 'unknown';
}

export class ErrorMonitoring {
  private static instance: ErrorMonitoring;
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTime: Map<string, Date> = new Map();

  private constructor() {
    this.initializeSentry();
  }

  static getInstance(): ErrorMonitoring {
    if (!ErrorMonitoring.instance) {
      ErrorMonitoring.instance = new ErrorMonitoring();
    }
    return ErrorMonitoring.instance;
  }

  /**
   * Initialize Sentry configuration
   */
  private initializeSentry(): void {
    // Sentry is already initialized in sentry.client.config.ts and sentry.server.config.ts
    // This method can be used for additional configuration if needed
    
    // Set user context when available
    Sentry.setTag('environment', process.env.NODE_ENV || 'development');
    Sentry.setTag('version', process.env.VERCEL_GIT_COMMIT_SHA || 'unknown');
  }

  /**
   * Set user context for error tracking
   */
  setUserContext(userId: string, email?: string, name?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      name
    });

    logger.info('Sentry user context set', { userId, email, name });
  }

  /**
   * Clear user context
   */
  clearUserContext(): void {
    Sentry.setUser(null);
    logger.info('Sentry user context cleared');
  }

  /**
   * Capture and monitor an error
   */
  captureError(
    error: Error | string,
    context: ErrorContext = {},
    severity: keyof ErrorSeverity = 'MEDIUM',
    category: keyof ErrorCategory = 'UNKNOWN'
  ): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorKey = `${category}_${errorMessage}`;
    
    // Track error frequency
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    this.lastErrorTime.set(errorKey, new Date());

    // Log error with structured logging
    logger.error(errorMessage, typeof error === 'Error' ? error : undefined, {
      ...context,
      severity,
      category,
      errorCount: currentCount + 1,
      errorKey
    });

    // Send to Sentry with enhanced context
    Sentry.captureException(typeof error === 'Error' ? error : new Error(error), {
      level: this.mapSeverityToSentryLevel(severity),
      tags: {
        category,
        severity,
        errorKey
      },
      extra: {
        ...context,
        errorCount: currentCount + 1,
        lastErrorTime: this.lastErrorTime.get(errorKey)
      }
    });

    // Check for error rate limiting
    this.checkErrorRateLimit(errorKey, currentCount + 1);
  }

  /**
   * Capture API errors with request context
   */
  captureApiError(
    error: Error | string,
    request: Request,
    context: ErrorContext = {}
  ): void {
    const url = new URL(request.url);
    const method = request.method;
    const userAgent = request.headers.get('user-agent');
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';

    this.captureError(error, {
      ...context,
      url: url.pathname,
      method,
      userAgent,
      ip,
      query: Object.fromEntries(url.searchParams)
    }, 'MEDIUM', 'API');
  }

  /**
   * Capture database errors
   */
  captureDatabaseError(
    error: Error | string,
    operation: string,
    table: string,
    context: ErrorContext = {}
  ): void {
    this.captureError(error, {
      ...context,
      operation,
      table
    }, 'HIGH', 'DATABASE');
  }

  /**
   * Capture LLM errors
   */
  captureLLMError(
    error: Error | string,
    model: string,
    operation: string,
    context: ErrorContext = {}
  ): void {
    this.captureError(error, {
      ...context,
      model,
      operation
    }, 'MEDIUM', 'LLM');
  }

  /**
   * Capture authentication errors
   */
  captureAuthError(
    error: Error | string,
    userId?: string,
    context: ErrorContext = {}
  ): void {
    this.captureError(error, {
      ...context,
      userId
    }, 'HIGH', 'AUTHENTICATION');
  }

  /**
   * Capture validation errors
   */
  captureValidationError(
    error: Error | string,
    field?: string,
    value?: any,
    context: ErrorContext = {}
  ): void {
    this.captureError(error, {
      ...context,
      field,
      value: typeof value === 'string' ? value : JSON.stringify(value)
    }, 'LOW', 'VALIDATION');
  }

  /**
   * Map internal severity to Sentry level
   */
  private mapSeverityToSentryLevel(severity: keyof ErrorSeverity): Sentry.SeverityLevel {
    switch (severity) {
      case 'LOW':
        return 'info';
      case 'MEDIUM':
        return 'warning';
      case 'HIGH':
        return 'error';
      case 'CRITICAL':
        return 'fatal';
      default:
        return 'error';
    }
  }

  /**
   * Check for error rate limiting
   */
  private checkErrorRateLimit(errorKey: string, count: number): void {
    const lastError = this.lastErrorTime.get(errorKey);
    if (!lastError) return;

    const timeSinceLastError = Date.now() - lastError.getTime();
    const fiveMinutes = 5 * 60 * 1000;

    // If same error occurs more than 10 times in 5 minutes, escalate
    if (count > 10 && timeSinceLastError < fiveMinutes) {
      logger.warn('High error rate detected', {
        errorKey,
        count,
        timeWindow: '5 minutes'
      });

      // Send critical alert to Sentry
      Sentry.captureMessage(`High error rate for ${errorKey}: ${count} errors in 5 minutes`, {
        level: 'fatal',
        tags: {
          errorKey,
          errorRate: 'high'
        }
      });
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorBreakdown: Record<string, number>;
    recentErrors: Array<{ key: string; count: number; lastSeen: Date }>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    const errorBreakdown: Record<string, number> = {};
    this.errorCounts.forEach((count, key) => {
      errorBreakdown[key] = count;
    });

    const recentErrors = Array.from(this.errorCounts.entries()).map(([key, count]) => ({
      key,
      count,
      lastSeen: this.lastErrorTime.get(key) || new Date()
    })).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

    return {
      totalErrors,
      errorBreakdown,
      recentErrors: recentErrors.slice(0, 20) // Top 20 most recent errors
    };
  }

  /**
   * Clear error statistics
   */
  clearErrorStats(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
    logger.info('Error statistics cleared');
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, any>,
    level: Sentry.SeverityLevel = 'info'
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level
    });

    logger.debug('Breadcrumb added', { message, category, data, level });
  }

  /**
   * Set transaction context
   */
  setTransactionContext(
    name: string,
    operation: string,
    context: ErrorContext = {}
  ): void {
    Sentry.setContext('transaction', {
      name,
      operation,
      ...context
    });

    logger.debug('Transaction context set', { name, operation, context });
  }

  /**
   * Monitor performance
   */
  startPerformanceMonitoring(operation: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      
      // Log slow operations
      if (duration > 5000) { // 5 seconds
        logger.warn('Slow operation detected', {
          operation,
          duration,
          threshold: 5000
        });
      }

      // Send to Sentry for performance monitoring
      Sentry.addBreadcrumb({
        message: `Operation completed: ${operation}`,
        category: 'performance',
        data: { duration, operation },
        level: duration > 5000 ? 'warning' : 'info'
      });
    };
  }
}

// Export singleton instance
export const errorMonitoring = ErrorMonitoring.getInstance(); 