import * as Sentry from '@sentry/nextjs';

export interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

export interface LogContext {
  userId?: string;
  operation?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context: LogContext;
  masked?: boolean;
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  private constructor() {}

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  /**
   * Mask PII data in strings
   */
  private maskPII(text: string): string {
    if (!text) return text;

    // Mask email addresses
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    
    // Mask phone numbers
    text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    
    // Mask credit card numbers
    text = text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]');
    
    // Mask SSN
    text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
    
    // Mask IP addresses
    text = text.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
    
    // Mask user IDs (Clerk format)
    text = text.replace(/\buser_[a-zA-Z0-9]{20,}\b/g, '[USER_ID]');
    
    // Mask Convex IDs
    text = text.replace(/\b[a-zA-Z0-9]{20,}\b/g, (match) => {
      // Don't mask short IDs or common patterns
      if (match.length < 20 || /^(yes|no|true|false|null)$/i.test(match)) {
        return match;
      }
      return '[ID]';
    });

    return text;
  }

  /**
   * Mask PII in context objects
   */
  private maskContext(context: LogContext): LogContext {
    const masked: LogContext = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        masked[key] = this.maskPII(value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskContext(value as LogContext);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }

  /**
   * Add log entry
   */
  private addLog(level: string, message: string, context: LogContext = {}): void {
    const maskedContext = this.maskContext(context);
    const logEntry: LogEntry = {
      level,
      message: this.maskPII(message),
      timestamp: new Date().toISOString(),
      context: maskedContext,
      masked: true
    };

    this.logs.push(logEntry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Send to Sentry for errors
    if (level === 'error') {
      Sentry.captureException(new Error(message), {
        extra: maskedContext
      });
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context: LogContext = {}): void {
    this.addLog('debug', message, context);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [DEBUG] ${message}`, context);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context: LogContext = {}): void {
    this.addLog('info', message, context);
    console.log(`ℹ️ [INFO] ${message}`, context);
  }

  /**
   * Warn level logging
   */
  warn(message: string, context: LogContext = {}): void {
    this.addLog('warn', message, context);
    console.warn(`⚠️ [WARN] ${message}`, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context: LogContext = {}): void {
    this.addLog('error', message, context);
    console.error(`❌ [ERROR] ${message}`, error, context);
    
    // Send to Sentry
    Sentry.captureException(error || new Error(message), {
      extra: context
    });
  }

  /**
   * Log API request
   */
  logApiRequest(method: string, path: string, userId?: string, context: LogContext = {}): void {
    this.info(`API Request: ${method} ${path}`, {
      userId,
      method,
      path,
      ...context
    });
  }

  /**
   * Log API response
   */
  logApiResponse(method: string, path: string, statusCode: number, userId?: string, context: LogContext = {}): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this[level](`API Response: ${method} ${path} - ${statusCode}`, {
      userId,
      method,
      path,
      statusCode,
      ...context
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, table: string, userId?: string, context: LogContext = {}): void {
    this.info(`Database Operation: ${operation} on ${table}`, {
      userId,
      operation,
      table,
      ...context
    });
  }

  /**
   * Log LLM operation
   */
  logLLMOperation(operation: string, model: string, userId?: string, context: LogContext = {}): void {
    this.info(`LLM Operation: ${operation} using ${model}`, {
      userId,
      operation,
      model,
      ...context
    });
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Export singleton instance
export const logger = StructuredLogger.getInstance(); 