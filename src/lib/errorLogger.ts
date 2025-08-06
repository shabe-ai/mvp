import * as Sentry from '@sentry/nextjs';
import { safePostHog } from './posthog';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  userEmail?: string;
  additionalData?: Record<string, unknown>;
}

export class ErrorLogger {
  static captureError(
    error: Error | string,
    context?: ErrorContext
  ) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error captured:', errorMessage, context);
    }

    // Send to Sentry
    try {
      Sentry.captureException(error, {
        tags: {
          component: context?.component || 'unknown',
          action: context?.action || 'unknown',
        },
        user: context?.userId ? {
          id: context.userId,
          email: context.userEmail,
        } : undefined,
        extra: context?.additionalData,
      });
    } catch (sentryError) {
      console.error('Failed to send error to Sentry:', sentryError);
    }

    // Track in PostHog
    try {
      if (typeof window !== 'undefined') {
        safePostHog.capture('error_occurred', {
          error_message: errorMessage,
          error_type: error instanceof Error ? error.constructor.name : 'string',
          component: context?.component,
          action: context?.action,
          ...context?.additionalData,
        });
      }
    } catch (posthogError) {
      console.error('Failed to send error to PostHog:', posthogError);
    }
  }

  static captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext
  ) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📝 ${level.toUpperCase()}:`, message, context);
    }

    // Send to Sentry
    try {
      Sentry.captureMessage(message, {
        level,
        tags: {
          component: context?.component || 'unknown',
          action: context?.action || 'unknown',
        },
        user: context?.userId ? {
          id: context.userId,
          email: context.userEmail,
        } : undefined,
        extra: context?.additionalData,
      });
    } catch (sentryError) {
      console.error('Failed to send message to Sentry:', sentryError);
    }

    // Track in PostHog
    try {
      if (typeof window !== 'undefined') {
        safePostHog.capture('message_logged', {
          message,
          level,
          component: context?.component,
          action: context?.action,
          ...context?.additionalData,
        });
      }
    } catch (posthogError) {
      console.error('Failed to send message to PostHog:', posthogError);
    }
  }

  static capturePerformance(
    operation: string,
    duration: number,
    context?: ErrorContext
  ) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ Performance: ${operation} took ${duration}ms`, context);
    }

    // Send to Sentry
    try {
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `${operation} took ${duration}ms`,
        level: 'info',
        data: {
          operation,
          duration,
          ...context?.additionalData,
        },
      });
    } catch (sentryError) {
      console.error('Failed to send performance data to Sentry:', sentryError);
    }

    // Track in PostHog
    try {
      if (typeof window !== 'undefined') {
        safePostHog.capture('performance_measured', {
          operation,
          duration,
          component: context?.component,
          action: context?.action,
          ...context?.additionalData,
        });
      }
    } catch (posthogError) {
      console.error('Failed to send performance data to PostHog:', posthogError);
    }
  }

  static captureUserAction(
    action: string,
    properties: Record<string, unknown> = {},
    context?: ErrorContext
  ) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`👤 User Action: ${action}`, { properties, context });
    }

    // Track in PostHog
    try {
      if (typeof window !== 'undefined') {
        safePostHog.capture(action, {
          ...properties,
          component: context?.component,
          action: context?.action,
          ...context?.additionalData,
        });
      }
    } catch (posthogError) {
      console.error('Failed to send user action to PostHog:', posthogError);
    }
  }

  static setUser(userId: string, email?: string) {
    try {
      Sentry.setUser({
        id: userId,
        email,
      });
    } catch (error) {
      console.error('Failed to set user in Sentry:', error);
    }
  }

  static addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, unknown>
  ) {
    try {
      Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
      });
    } catch (error) {
      console.error('Failed to add breadcrumb to Sentry:', error);
    }
  }
}

// Convenience functions
export const logError = (error: Error | string, context?: ErrorContext) => {
  ErrorLogger.captureError(error, context);
};

export const logMessage = (
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
) => {
  ErrorLogger.captureMessage(message, level, context);
};

export const setUser = (userId: string, email?: string) => {
  ErrorLogger.setUser(userId, email);
};

export const addBreadcrumb = (message: string, category: string, data?: Record<string, unknown>) => {
  ErrorLogger.addBreadcrumb(message, category, data);
}; 