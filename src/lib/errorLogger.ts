import * as Sentry from '@sentry/nextjs';
import { safePostHog } from './posthog';

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  action?: string;
  component?: string;
  additionalData?: Record<string, any>;
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
        level: level as Sentry.SeverityLevel,
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
    data?: Record<string, any>
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

export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  ErrorLogger.addBreadcrumb(message, category, data);
}; 