import * as Sentry from '@sentry/nextjs';
import { logError, logMessage } from './errorLogger';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  data?: any;
  timestamp: string;
  userAgent?: string;
  url?: string;
  method?: string;
}

export interface ErrorReport {
  id: string;
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'ui' | 'api' | 'auth' | 'integration' | 'database' | 'network' | 'unknown';
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

class EnhancedErrorTracker {
  private static instance: EnhancedErrorTracker;
  private errorReports: ErrorReport[] = [];
  private maxReports = 100; // Keep last 100 error reports
  private errorPatterns: Map<string, number> = new Map(); // Track error frequency

  private constructor() {}

  static getInstance(): EnhancedErrorTracker {
    if (!EnhancedErrorTracker.instance) {
      EnhancedErrorTracker.instance = new EnhancedErrorTracker();
    }
    return EnhancedErrorTracker.instance;
  }

  /**
   * Track an error with enhanced context
   */
  trackError(
    error: Error,
    context: Partial<ErrorContext> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    category: 'ui' | 'api' | 'auth' | 'integration' | 'database' | 'network' | 'unknown' = 'unknown'
  ): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();

    // Enhance context with additional information
    const enhancedContext: ErrorContext = {
      timestamp,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...context
    };

    // Create error report
    const errorReport: ErrorReport = {
      id: errorId,
      error,
      context: enhancedContext,
      severity,
      category,
      resolved: false,
      createdAt: timestamp
    };

    // Add to reports
    this.errorReports.unshift(errorReport);
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(0, this.maxReports);
    }

    // Track error pattern
    const errorPattern = this.getErrorPattern(error);
    this.errorPatterns.set(errorPattern, (this.errorPatterns.get(errorPattern) || 0) + 1);

    // Log to external services
    this.logToExternalServices(error, enhancedContext, severity, category);

    // Log locally
    logError(`Error ${errorId}: ${error.message}`, {
      component: enhancedContext.component,
      action: enhancedContext.action,
      userId: enhancedContext.userId,
      additionalData: {
        errorId,
        errorName: error.name,
        errorStack: error.stack,
        severity,
        category,
        ...enhancedContext
      }
    });

    return errorId;
  }

  /**
   * Mark an error as resolved
   */
  markResolved(errorId: string, resolution?: string): boolean {
    const report = this.errorReports.find(r => r.id === errorId);
    if (report) {
      report.resolved = true;
      report.resolvedAt = new Date().toISOString();
      report.resolution = resolution;

      logMessage(`Error ${errorId} marked as resolved`, 'info', {
        component: 'errorTracker',
        action: 'markResolved',
        additionalData: {
          errorId,
          resolution,
          timeToResolution: new Date(report.resolvedAt).getTime() - new Date(report.createdAt).getTime()
        }
      });

      return true;
    }
    return false;
  }

  /**
   * Get all error reports
   */
  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): ErrorReport[] {
    return this.errorReports.filter(r => !r.resolved);
  }

  /**
   * Get error patterns (frequency analysis)
   */
  getErrorPatterns(): Map<string, number> {
    return new Map(this.errorPatterns);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: string): ErrorReport[] {
    return this.errorReports.filter(r => r.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: string): ErrorReport[] {
    return this.errorReports.filter(r => r.severity === severity);
  }

  /**
   * Clear resolved errors older than specified days
   */
  clearOldResolvedErrors(daysOld: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const initialCount = this.errorReports.length;
    this.errorReports = this.errorReports.filter(report => {
      if (report.resolved && report.resolvedAt) {
        return new Date(report.resolvedAt) > cutoffDate;
      }
      return true;
    });

    return initialCount - this.errorReports.length;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract error pattern for frequency tracking
   */
  private getErrorPattern(error: Error): string {
    return `${error.name}:${error.message.split('\n')[0]}`;
  }

  /**
   * Log to external services (Sentry, etc.)
   */
  private logToExternalServices(
    error: Error,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical',
    category: string
  ) {
    try {
      // Set Sentry severity
      const sentryLevel = this.mapSeverityToSentryLevel(severity);
      
      // Add context to Sentry
      Sentry.withScope(scope => {
        scope.setLevel(sentryLevel);
        scope.setTag('category', category);
        scope.setTag('severity', severity);
        scope.setContext('error_context', context as Record<string, any>);
        scope.setUser({
          id: context.userId,
          sessionId: context.sessionId
        });
        
        Sentry.captureException(error);
      });

      // Track performance for critical errors
      if (severity === 'critical') {
        logMessage('critical_error', 'error', {
          component: 'errorTracker',
          action: 'criticalError',
          additionalData: {
            errorName: error.name,
            errorMessage: error.message,
            category,
            context
          }
        });
      }
    } catch (loggingError) {
      console.error('Failed to log error to external services:', loggingError);
    }
  }

  /**
   * Map internal severity to Sentry level
   */
  private mapSeverityToSentryLevel(severity: string): Sentry.SeverityLevel {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'fatal';
      default: return 'error';
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const total = this.errorReports.length;
    const resolved = this.errorReports.filter(r => r.resolved).length;
    const unresolved = total - resolved;
    
    const byCategory = this.errorReports.reduce((acc, report) => {
      acc[report.category] = (acc[report.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = this.errorReports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      resolved,
      unresolved,
      byCategory,
      bySeverity,
      topPatterns: Array.from(this.errorPatterns.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    };
  }
}

// Export singleton instance
export const errorTracker = EnhancedErrorTracker.getInstance();

// Convenience functions
export const trackError = (
  error: Error,
  context?: Partial<ErrorContext>,
  severity?: 'low' | 'medium' | 'high' | 'critical',
  category?: 'ui' | 'api' | 'auth' | 'integration' | 'database' | 'network' | 'unknown'
) => errorTracker.trackError(error, context, severity, category);

export const trackUIError = (error: Error, component?: string, action?: string) =>
  trackError(error, { component, action }, 'medium', 'ui');

export const trackAPIError = (error: Error, endpoint?: string, method?: string) =>
  trackError(error, { url: endpoint, method }, 'high', 'api');

export const trackAuthError = (error: Error, userId?: string) =>
  trackError(error, { userId }, 'high', 'auth');

export const trackIntegrationError = (error: Error, integration?: string) =>
  trackError(error, { component: integration }, 'medium', 'integration');

export const trackDatabaseError = (error: Error, operation?: string) =>
  trackError(error, { action: operation }, 'high', 'database');

export const trackNetworkError = (error: Error, url?: string) =>
  trackError(error, { url }, 'medium', 'network');
