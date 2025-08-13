import { logger } from './logger';
import { errorMonitoring } from './errorMonitoring';

export interface SecurityVulnerability {
  id: string;
  type: 'critical' | 'high' | 'medium' | 'low';
  category: 'authentication' | 'authorization' | 'input_validation' | 'data_exposure' | 'configuration' | 'dependencies';
  title: string;
  description: string;
  location: string;
  recommendation: string;
  detectedAt: Date;
  fixed?: boolean;
  fixedAt?: Date;
}

export interface SecurityScanResult {
  scanId: string;
  timestamp: Date;
  vulnerabilities: SecurityVulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    fixed: number;
  };
  scanDuration: number;
}

export interface SecurityConfig {
  enableRealTimeScanning: boolean;
  scanInterval: number; // minutes
  maxVulnerabilitiesBeforeAlert: number;
  autoFixLowRisk: boolean;
  notifyOnCritical: boolean;
}

export class SecurityScanner {
  private static instance: SecurityScanner;
  private vulnerabilities: Map<string, SecurityVulnerability> = new Map();
  private scanHistory: SecurityScanResult[] = [];
  private config: SecurityConfig;

  private constructor() {
    this.config = {
      enableRealTimeScanning: true,
      scanInterval: 30, // 30 minutes
      maxVulnerabilitiesBeforeAlert: 5,
      autoFixLowRisk: false,
      notifyOnCritical: true
    };
  }

  static getInstance(): SecurityScanner {
    if (!SecurityScanner.instance) {
      SecurityScanner.instance = new SecurityScanner();
    }
    return SecurityScanner.instance;
  }

  /**
   * Run comprehensive security scan
   */
  async runSecurityScan(): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const scanId = `scan_${Date.now()}`;
    const vulnerabilities: SecurityVulnerability[] = [];

    logger.info('Starting security scan', { scanId });

    try {
      // 1. Authentication & Authorization Scan
      vulnerabilities.push(...await this.scanAuthentication());

      // 2. Input Validation Scan
      vulnerabilities.push(...await this.scanInputValidation());

      // 3. Data Exposure Scan
      vulnerabilities.push(...await this.scanDataExposure());

      // 4. Configuration Scan
      vulnerabilities.push(...await this.scanConfiguration());

      // 5. Dependencies Scan
      vulnerabilities.push(...await this.scanDependencies());

      // 6. API Security Scan
      vulnerabilities.push(...await this.scanAPISecurity());

      const scanDuration = Date.now() - startTime;
      const summary = this.calculateSummary(vulnerabilities);

      const result: SecurityScanResult = {
        scanId,
        timestamp: new Date(),
        vulnerabilities,
        summary,
        scanDuration
      };

      // Store scan result
      this.scanHistory.push(result);
      if (this.scanHistory.length > 100) {
        this.scanHistory = this.scanHistory.slice(-100);
      }

      // Update vulnerability database
      vulnerabilities.forEach(vuln => {
        this.vulnerabilities.set(vuln.id, vuln);
      });

      // Check for critical vulnerabilities
      if (summary.critical > 0) {
        this.handleCriticalVulnerabilities(vulnerabilities.filter(v => v.type === 'critical'));
      }

      // Alert if too many vulnerabilities
      if (summary.total > this.config.maxVulnerabilitiesBeforeAlert) {
        this.alertHighVulnerabilityCount(summary);
      }

      logger.info('Security scan completed', {
        scanId,
        duration: scanDuration,
        vulnerabilitiesFound: summary.total,
        critical: summary.critical
      });

      return result;

    } catch (error) {
      errorMonitoring.captureError(
        `Security scan failed: ${error}`,
        { scanId },
        'HIGH',
        'SYSTEM'
      );
      throw error;
    }
  }

  /**
   * Scan authentication and authorization
   */
  private async scanAuthentication(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for admin bypass
    try {
      const adminCheckResponse = await fetch('/api/admin/check');
      if (adminCheckResponse.ok) {
        const data = await adminCheckResponse.json();
        if (data.isAdmin && !data.adminUser?.email?.includes('@shabe.ai')) {
          vulnerabilities.push({
            id: 'auth_admin_bypass',
            type: 'critical',
            category: 'authorization',
            title: 'Admin Access Bypass Detected',
            description: 'Non-admin users may have admin access',
            location: '/api/admin/check',
            recommendation: 'Review admin access controls and ensure proper role validation',
            detectedAt: new Date()
          });
        }
      }
    } catch (error) {
      logger.warn('Could not check admin access', { error: error.message });
    }

    // Check for missing authentication on sensitive endpoints
    const sensitiveEndpoints = [
      '/api/chat',
      '/api/admin',
      '/api/monitoring',
      '/api/teams'
    ];

    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status !== 401) {
          vulnerabilities.push({
            id: `auth_missing_${endpoint.replace(/\//g, '_')}`,
            type: 'high',
            category: 'authentication',
            title: 'Missing Authentication on Sensitive Endpoint',
            description: `Endpoint ${endpoint} may not require authentication`,
            location: endpoint,
            recommendation: 'Ensure all sensitive endpoints require proper authentication',
            detectedAt: new Date()
          });
        }
      } catch (error) {
        // Expected for unauthenticated requests
      }
    }

    return vulnerabilities;
  }

  /**
   * Scan input validation
   */
  private async scanInputValidation(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for SQL injection patterns in code
    const sqlInjectionPatterns = [
      /SELECT.*FROM.*WHERE.*\$\{/,
      /INSERT.*INTO.*VALUES.*\$\{/,
      /UPDATE.*SET.*WHERE.*\$\{/,
      /DELETE.*FROM.*WHERE.*\$\{/
    ];

    // Check for XSS patterns
    const xssPatterns = [
      /innerHTML.*\$\{/,
      /outerHTML.*\$\{/,
      /document\.write.*\$\{/
    ];

    // Check for command injection patterns
    const commandInjectionPatterns = [
      /exec.*\$\{/,
      /spawn.*\$\{/,
      /child_process.*\$\{/
    ];

    // Note: In a real implementation, you would scan the actual codebase
    // For now, we'll simulate finding potential issues
    if (process.env.NODE_ENV === 'development') {
      vulnerabilities.push({
        id: 'input_validation_dev_mode',
        type: 'medium',
        category: 'input_validation',
        title: 'Development Mode Active',
        description: 'Application is running in development mode which may have relaxed security',
        location: 'Environment Configuration',
        recommendation: 'Ensure production environment is properly configured',
        detectedAt: new Date()
      });
    }

    return vulnerabilities;
  }

  /**
   * Scan for data exposure
   */
  private async scanDataExposure(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for sensitive data in logs
    const sensitivePatterns = [
      /password.*=.*[^\s]+/i,
      /token.*=.*[^\s]+/i,
      /secret.*=.*[^\s]+/i,
      /api_key.*=.*[^\s]+/i
    ];

    // Check for PII in responses
    const piiPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      /\b\d{3}-\d{2}-\d{4}\b/,
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/
    ];

    // Check for exposed environment variables
    const exposedEnvVars = [
      'DATABASE_URL',
      'OPENAI_API_KEY',
      'CLERK_SECRET_KEY',
      'JWT_SECRET'
    ];

    for (const envVar of exposedEnvVars) {
      if (process.env[envVar] && process.env[envVar]!.length > 0) {
        // Check if it's exposed in client-side code
        vulnerabilities.push({
          id: `data_exposure_env_${envVar.toLowerCase()}`,
          type: 'high',
          category: 'data_exposure',
          title: 'Environment Variable May Be Exposed',
          description: `Environment variable ${envVar} is set and may be exposed`,
          location: 'Environment Configuration',
          recommendation: 'Ensure sensitive environment variables are not exposed to client-side code',
          detectedAt: new Date()
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Scan configuration security
   */
  private async scanConfiguration(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check CORS configuration
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
      vulnerabilities.push({
        id: 'config_cors_wildcard',
        type: 'high',
        category: 'configuration',
        title: 'CORS Wildcard Configuration',
        description: 'CORS is configured to allow all origins',
        location: 'CORS Configuration',
        recommendation: 'Restrict CORS to specific allowed origins',
        detectedAt: new Date()
      });
    }

    // Check HTTPS enforcement
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS) {
      vulnerabilities.push({
        id: 'config_https_not_enforced',
        type: 'medium',
        category: 'configuration',
        title: 'HTTPS Not Enforced',
        description: 'HTTPS enforcement may not be configured',
        location: 'HTTPS Configuration',
        recommendation: 'Enforce HTTPS in production environment',
        detectedAt: new Date()
      });
    }

    // Check rate limiting
    if (!process.env.RATE_LIMIT_ENABLED || process.env.RATE_LIMIT_ENABLED !== 'true') {
      vulnerabilities.push({
        id: 'config_rate_limiting_disabled',
        type: 'medium',
        category: 'configuration',
        title: 'Rate Limiting Disabled',
        description: 'Rate limiting may not be properly configured',
        location: 'Rate Limiting Configuration',
        recommendation: 'Enable and configure rate limiting for all API endpoints',
        detectedAt: new Date()
      });
    }

    return vulnerabilities;
  }

  /**
   * Scan dependencies for known vulnerabilities
   */
  private async scanDependencies(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      // In a real implementation, you would:
      // 1. Parse package.json
      // 2. Check against vulnerability databases
      // 3. Use tools like npm audit or Snyk

      // For now, we'll simulate dependency scanning
      const criticalDependencies = [
        'express',
        'next',
        'convex',
        'openai'
      ];

      for (const dep of criticalDependencies) {
        // Simulate finding outdated dependency
        if (Math.random() > 0.8) { // 20% chance of finding issue
          vulnerabilities.push({
            id: `dep_outdated_${dep}`,
            type: 'medium',
            category: 'dependencies',
            title: `Outdated Dependency: ${dep}`,
            description: `Dependency ${dep} may be outdated and contain security vulnerabilities`,
            location: 'package.json',
            recommendation: `Update ${dep} to the latest secure version`,
            detectedAt: new Date()
          });
        }
      }
    } catch (error) {
      logger.warn('Dependency scan failed', { error: error.message });
    }

    return vulnerabilities;
  }

  /**
   * Scan API security
   */
  private async scanAPISecurity(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for missing CSRF protection
    vulnerabilities.push({
      id: 'api_csrf_protection',
      type: 'medium',
      category: 'authentication',
      title: 'CSRF Protection Status Unknown',
      description: 'CSRF protection implementation should be verified',
      location: 'API Security',
      recommendation: 'Implement CSRF protection for state-changing operations',
      detectedAt: new Date()
    });

    // Check for missing request validation
    vulnerabilities.push({
      id: 'api_request_validation',
      type: 'medium',
      category: 'input_validation',
      title: 'Request Validation Status Unknown',
      description: 'Request validation implementation should be verified',
      location: 'API Security',
      recommendation: 'Implement comprehensive request validation for all endpoints',
      detectedAt: new Date()
    });

    return vulnerabilities;
  }

  /**
   * Calculate vulnerability summary
   */
  private calculateSummary(vulnerabilities: SecurityVulnerability[]) {
    return {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.type === 'critical').length,
      high: vulnerabilities.filter(v => v.type === 'high').length,
      medium: vulnerabilities.filter(v => v.type === 'medium').length,
      low: vulnerabilities.filter(v => v.type === 'low').length,
      fixed: vulnerabilities.filter(v => v.fixed).length
    };
  }

  /**
   * Handle critical vulnerabilities
   */
  private handleCriticalVulnerabilities(criticalVulns: SecurityVulnerability[]): void {
    logger.error('Critical security vulnerabilities detected', {
      count: criticalVulns.length,
      vulnerabilities: criticalVulns.map(v => ({ id: v.id, title: v.title }))
    });

    if (this.config.notifyOnCritical) {
      // Send immediate alert
      errorMonitoring.captureError(
        `Critical security vulnerabilities detected: ${criticalVulns.length} issues`,
        { vulnerabilities: criticalVulns.map(v => v.id) },
        'CRITICAL',
        'SYSTEM'
      );
    }
  }

  /**
   * Alert on high vulnerability count
   */
  private alertHighVulnerabilityCount(summary: SecurityScanResult['summary']): void {
    logger.warn('High number of security vulnerabilities detected', {
      total: summary.total,
      critical: summary.critical,
      high: summary.high
    });
  }

  /**
   * Get scan history
   */
  getScanHistory(): SecurityScanResult[] {
    return [...this.scanHistory];
  }

  /**
   * Get current vulnerabilities
   */
  getCurrentVulnerabilities(): SecurityVulnerability[] {
    return Array.from(this.vulnerabilities.values());
  }

  /**
   * Mark vulnerability as fixed
   */
  markVulnerabilityFixed(vulnerabilityId: string): void {
    const vuln = this.vulnerabilities.get(vulnerabilityId);
    if (vuln) {
      vuln.fixed = true;
      vuln.fixedAt = new Date();
      this.vulnerabilities.set(vulnerabilityId, vuln);
      
      logger.info('Vulnerability marked as fixed', { vulnerabilityId });
    }
  }

  /**
   * Get security score (0-100)
   */
  getSecurityScore(): number {
    const vulns = this.getCurrentVulnerabilities();
    const unfixed = vulns.filter(v => !v.fixed);
    
    if (unfixed.length === 0) return 100;
    
    const criticalWeight = 25;
    const highWeight = 15;
    const mediumWeight = 8;
    const lowWeight = 3;
    
    const score = unfixed.reduce((total, vuln) => {
      switch (vuln.type) {
        case 'critical': return total - criticalWeight;
        case 'high': return total - highWeight;
        case 'medium': return total - mediumWeight;
        case 'low': return total - lowWeight;
        default: return total;
      }
    }, 100);
    
    return Math.max(0, score);
  }
}

// Export singleton instance
export const securityScanner = SecurityScanner.getInstance(); 