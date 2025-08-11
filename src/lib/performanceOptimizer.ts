import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  cacheHitRate: number;
  errorRate: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface OptimizationConfig {
  enableCaching: boolean;
  cacheTTL: number; // Default TTL in milliseconds
  maxCacheSize: number;
  enableResponseCompression: boolean;
  enableRequestBatching: boolean;
  enablePerformanceMonitoring: boolean;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private config: OptimizationConfig;

  private constructor() {
    this.config = {
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 100,
      enableResponseCompression: true,
      enableRequestBatching: true,
      enablePerformanceMonitoring: true
    };
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Cache data with TTL
   */
  setCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enableCaching) return;

    // Clean up expired entries
    this.cleanupCache();

    // Check cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Get cached data
   */
  getCache<T>(key: string): T | null {
    if (!this.config.enableCaching) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * Generate cache key for CRM data
   */
  generateCacheKey(userId: string, dataType: string, filters?: Record<string, any>): string {
    const filterString = filters ? JSON.stringify(filters) : '';
    return `crm_${userId}_${dataType}_${filterString}`;
  }

  /**
   * Batch multiple CRM queries for better performance
   */
  async batchCrmQueries(userId: string, queries: Array<{
    type: 'contacts' | 'accounts' | 'deals' | 'activities';
    filters?: Record<string, any>;
  }>): Promise<Record<string, any[]>> {
    if (!this.config.enableRequestBatching) {
      // Fallback to individual queries
      const results: Record<string, any[]> = {};
      for (const query of queries) {
        results[query.type] = await this.getCrmData(userId, query.type, query.filters);
      }
      return results;
    }

    const startTime = Date.now();
    const results: Record<string, any[]> = {};
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';

    // Execute queries in parallel
    const promises = queries.map(async (query) => {
      const cacheKey = this.generateCacheKey(userId, query.type, query.filters);
      const cached = this.getCache<any[]>(cacheKey);
      
      if (cached) {
        return { type: query.type, data: cached };
      }

      let data: any[] = [];
      switch (query.type) {
        case 'contacts':
          data = await convex.query(api.crm.getContactsByTeam, { teamId });
          break;
        case 'accounts':
          data = await convex.query(api.crm.getAccountsByTeam, { teamId });
          break;
        case 'deals':
          data = await convex.query(api.crm.getDealsByTeam, { teamId });
          break;
        case 'activities':
          data = await convex.query(api.crm.getActivitiesByTeam, { teamId });
          break;
      }

      // Apply filters if provided
      if (query.filters) {
        data = this.applyFilters(data, query.filters);
      }

      // Cache the result
      this.setCache(cacheKey, data, 2 * 60 * 1000); // 2 minutes for CRM data

      return { type: query.type, data };
    });

    const queryResults = await Promise.all(promises);
    
    // Organize results
    for (const result of queryResults) {
      results[result.type] = result.data;
    }

    // Record performance metrics
    this.recordMetrics({
      responseTime: Date.now() - startTime,
      cacheHitRate: this.calculateCacheHitRate(),
      errorRate: 0,
      memoryUsage: this.getMemoryUsage(),
      timestamp: new Date()
    });

    return results;
  }

  /**
   * Get CRM data with caching
   */
  async getCrmData(userId: string, dataType: string, filters?: Record<string, any>): Promise<any[]> {
    const cacheKey = this.generateCacheKey(userId, dataType, filters);
    const cached = this.getCache<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';

    let data: any[] = [];
    switch (dataType) {
      case 'contacts':
        data = await convex.query(api.crm.getContactsByTeam, { teamId });
        break;
      case 'accounts':
        data = await convex.query(api.crm.getAccountsByTeam, { teamId });
        break;
      case 'deals':
        data = await convex.query(api.crm.getDealsByTeam, { teamId });
        break;
      case 'activities':
        data = await convex.query(api.crm.getActivitiesByTeam, { teamId });
        break;
    }

    // Apply filters if provided
    if (filters) {
      data = this.applyFilters(data, filters);
    }

    // Cache the result
    this.setCache(cacheKey, data, 2 * 60 * 1000); // 2 minutes for CRM data

    return data;
  }

  /**
   * Apply filters to data
   */
  private applyFilters(data: any[], filters: Record<string, any>): any[] {
    return data.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict least used cache entries
   */
  private evictLeastUsed(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    // Remove 20% of least used entries
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    if (this.metrics.length === 0) return 0;
    
    const recentMetrics = this.metrics.slice(-10);
    const totalRequests = recentMetrics.length;
    const cacheHits = recentMetrics.filter(m => m.cacheHitRate > 0.5).length;
    
    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  /**
   * Get memory usage (approximate)
   */
  private getMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.data).length;
    }
    return totalSize;
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    if (!this.config.enablePerformanceMonitoring) return;

    this.metrics.push(metrics);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    cacheSize: number;
    memoryUsage: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        cacheSize: this.cache.size,
        memoryUsage: this.getMemoryUsage()
      };
    }

    const recentMetrics = this.metrics.slice(-20);
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    const avgCacheHitRate = recentMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / recentMetrics.length;
    const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;

    return {
      averageResponseTime: avgResponseTime,
      cacheHitRate: avgCacheHitRate,
      errorRate: avgErrorRate,
      cacheSize: this.cache.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance(); 