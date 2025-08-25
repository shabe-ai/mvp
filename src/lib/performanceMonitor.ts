import { logMessage } from './errorLogger';

export interface PerformanceMetric {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  category: 'api' | 'render' | 'interaction' | 'navigation' | 'database' | 'integration';
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceThresholds {
  api: number; // milliseconds
  render: number;
  interaction: number;
  navigation: number;
  database: number;
  integration: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 500; // Keep last 500 metrics
  private thresholds: PerformanceThresholds = {
    api: 2000, // 2 seconds
    render: 1000, // 1 second
    interaction: 500, // 500ms
    navigation: 3000, // 3 seconds
    database: 1000, // 1 second
    integration: 5000 // 5 seconds
  };

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string, category: PerformanceMetric['category'], metadata?: Record<string, any>): string {
    const id = this.generateMetricId();
    const startTime = performance.now();

    // Store start time for later completion
    const metric: PerformanceMetric = {
      id,
      name,
      duration: 0,
      startTime,
      endTime: 0,
      category,
      metadata,
      userId: this.getCurrentUserId(),
      sessionId: this.getCurrentSessionId()
    };

    this.metrics.push(metric);
    return id;
  }

  /**
   * End timing an operation
   */
  endTimer(id: string, additionalMetadata?: Record<string, any>): PerformanceMetric | null {
    const metric = this.metrics.find(m => m.id === id);
    if (!metric) return null;

    const endTime = performance.now();
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;
    
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata };
    }

    // Check if performance is below threshold
    const threshold = this.thresholds[metric.category];
    if (metric.duration > threshold) {
      this.reportSlowOperation(metric);
    }

    // Log performance metric
    logMessage(metric.name, 'info', {
      component: 'performanceMonitor',
      action: 'metricRecorded',
      additionalData: {
        duration: metric.duration,
        category: metric.category,
        threshold,
        isSlow: metric.duration > threshold,
        ...metric.metadata
      }
    });

    // Clean up old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    return metric;
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(
    name: string,
    category: PerformanceMetric['category'],
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const id = this.startTimer(name, category, metadata);
    
    try {
      const result = await operation();
      this.endTimer(id, { success: true });
      return result;
    } catch (error) {
      this.endTimer(id, { success: false, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Time a synchronous operation
   */
  timeSync<T>(
    name: string,
    category: PerformanceMetric['category'],
    operation: () => T,
    metadata?: Record<string, any>
  ): T {
    const id = this.startTimer(name, category, metadata);
    
    try {
      const result = operation();
      this.endTimer(id, { success: true });
      return result;
    } catch (error) {
      this.endTimer(id, { success: false, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.category === category);
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(): PerformanceMetric[] {
    return this.metrics.filter(metric => {
      const threshold = this.thresholds[metric.category];
      return metric.duration > threshold;
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats: Record<string, any> = {};

    // Overall stats
    const totalMetrics = this.metrics.length;
    const avgDuration = totalMetrics > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalMetrics 
      : 0;

    stats.overall = {
      totalMetrics,
      avgDuration,
      slowOperations: this.getSlowOperations().length
    };

    // Stats by category
    const categories = ['api', 'render', 'interaction', 'navigation', 'database', 'integration'];
    categories.forEach(category => {
      const categoryMetrics = this.getMetricsByCategory(category);
      if (categoryMetrics.length > 0) {
        const avgDuration = categoryMetrics.reduce((sum, m) => sum + m.duration, 0) / categoryMetrics.length;
        const slowCount = categoryMetrics.filter(m => m.duration > this.thresholds[category as keyof PerformanceThresholds]).length;
        
        stats[category] = {
          count: categoryMetrics.length,
          avgDuration,
          slowCount,
          threshold: this.thresholds[category as keyof PerformanceThresholds]
        };
      }
    });

    return stats;
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(hoursOld: number = 24): number {
    const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(metric => {
      return metric.startTime > cutoffTime;
    });

    return initialCount - this.metrics.length;
  }

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current user ID (if available)
   */
  private getCurrentUserId(): string | undefined {
    // This would integrate with your auth system
    if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.props?.user?.id) {
      return (window as any).__NEXT_DATA__.props.user.id;
    }
    return undefined;
  }

  /**
   * Get current session ID
   */
  private getCurrentSessionId(): string | undefined {
    // This would integrate with your session management
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sessionId') || undefined;
    }
    return undefined;
  }

  /**
   * Report slow operations
   */
  private reportSlowOperation(metric: PerformanceMetric) {
    console.warn(`⚠️ Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms (threshold: ${this.thresholds[metric.category]}ms)`, {
      category: metric.category,
      metadata: metric.metadata
    });
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Convenience functions
export const timeAPI = (name: string, operation: () => Promise<any>, metadata?: Record<string, any>) =>
  performanceMonitor.timeAsync(name, 'api', operation, metadata);

export const timeRender = (name: string, operation: () => any, metadata?: Record<string, any>) =>
  performanceMonitor.timeSync(name, 'render', operation, metadata);

export const timeInteraction = (name: string, operation: () => any, metadata?: Record<string, any>) =>
  performanceMonitor.timeSync(name, 'interaction', operation, metadata);

export const timeDatabase = (name: string, operation: () => Promise<any>, metadata?: Record<string, any>) =>
  performanceMonitor.timeAsync(name, 'database', operation, metadata);

export const timeIntegration = (name: string, operation: () => Promise<any>, metadata?: Record<string, any>) =>
  performanceMonitor.timeAsync(name, 'integration', operation, metadata);

// React hook for component performance
export const usePerformanceTimer = (name: string, category: PerformanceMetric['category'] = 'render') => {
  const startTimer = () => performanceMonitor.startTimer(name, category);
  const endTimer = (id: string) => performanceMonitor.endTimer(id);
  
  return { startTimer, endTimer };
};
