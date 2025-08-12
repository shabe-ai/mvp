import { userDataEnhancer } from './userDataEnhancer';
import { specializedRAG } from './specializedRAG';

export interface RAGMetrics {
  timestamp: Date;
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  successRate: number;
  averageConfidence: number;
  domainBreakdown: {
    charts: number;
    analysis: number;
    crm: number;
    conversations: number;
  };
  learningProgress: {
    examplesAdded: number;
    patternsLearned: number;
    improvements: number;
  };
}

export interface RAGEvaluation {
  beforeRAG: {
    successRate: number;
    averageClarifications: number;
    userSatisfaction: number;
  };
  afterRAG: {
    successRate: number;
    averageClarifications: number;
    userSatisfaction: number;
  };
  improvement: {
    successRateImprovement: number;
    clarificationReduction: number;
    satisfactionImprovement: number;
  };
}

export class RAGMonitor {
  private metrics: RAGMetrics[] = [];
  private static instance: RAGMonitor;

  private constructor() {}

  static getInstance(): RAGMonitor {
    if (!RAGMonitor.instance) {
      RAGMonitor.instance = new RAGMonitor();
    }
    return RAGMonitor.instance;
  }

  /**
   * Track a new interaction for evaluation
   */
  async trackInteraction(
    userQuery: string,
    intent: string,
    confidence: number,
    success: boolean,
    clarificationsNeeded: number,
    responseTime: number
  ): Promise<void> {
    const currentMetrics = await this.getCurrentMetrics();
    
    const newMetrics: RAGMetrics = {
      timestamp: new Date(),
      totalInteractions: currentMetrics.totalInteractions + 1,
      successfulInteractions: currentMetrics.successfulInteractions + (success ? 1 : 0),
      failedInteractions: currentMetrics.failedInteractions + (success ? 0 : 1),
      successRate: ((currentMetrics.successfulInteractions + (success ? 1 : 0)) / (currentMetrics.totalInteractions + 1)) * 100,
      averageConfidence: (currentMetrics.averageConfidence * currentMetrics.totalInteractions + confidence) / (currentMetrics.totalInteractions + 1),
      domainBreakdown: await this.getDomainBreakdown(),
      learningProgress: await this.getLearningProgress()
    };

    this.metrics.push(newMetrics);
    
    console.log('📊 RAG Metrics Updated:', {
      successRate: newMetrics.successRate.toFixed(2) + '%',
      averageConfidence: newMetrics.averageConfidence.toFixed(2),
      totalInteractions: newMetrics.totalInteractions
    });
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<RAGMetrics> {
    if (this.metrics.length === 0) {
      return {
        timestamp: new Date(),
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        successRate: 0,
        averageConfidence: 0,
        domainBreakdown: { charts: 0, analysis: 0, crm: 0, conversations: 0 },
        learningProgress: { examplesAdded: 0, patternsLearned: 0, improvements: 0 }
      };
    }
    
    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get domain-specific breakdown
   */
  private async getDomainBreakdown() {
    const userDataStats = userDataEnhancer.getStats();
    const specializedStats = specializedRAG.getStats();
    
    return {
      charts: specializedStats.chartExamples,
      analysis: specializedStats.analysisExamples,
      crm: specializedStats.crmExamples,
      conversations: specializedStats.conversationExamples
    };
  }

  /**
   * Get learning progress metrics
   */
  private async getLearningProgress() {
    const userDataStats = userDataEnhancer.getStats();
    const specializedStats = specializedRAG.getStats();
    
    return {
      examplesAdded: userDataStats.totalExamples + 
                    specializedStats.chartExamples + 
                    specializedStats.analysisExamples + 
                    specializedStats.crmExamples,
      patternsLearned: this.metrics.length,
      improvements: this.calculateImprovements()
    };
  }

  /**
   * Calculate improvement trends
   */
  private calculateImprovements(): number {
    if (this.metrics.length < 2) return 0;
    
    const recentMetrics = this.metrics.slice(-10); // Last 10 interactions
    const olderMetrics = this.metrics.slice(-20, -10); // Previous 10 interactions
    
    if (olderMetrics.length === 0) return 0;
    
    const recentSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length;
    const olderSuccessRate = olderMetrics.reduce((sum, m) => sum + m.successRate, 0) / olderMetrics.length;
    
    return recentSuccessRate - olderSuccessRate;
  }

  /**
   * Generate evaluation report
   */
  async generateEvaluationReport(): Promise<RAGEvaluation> {
    const currentMetrics = await this.getCurrentMetrics();
    const recentMetrics = this.metrics.slice(-20); // Last 20 interactions
    const olderMetrics = this.metrics.slice(-40, -20); // Previous 20 interactions
    
    const afterRAG = {
      successRate: currentMetrics.successRate,
      averageClarifications: this.calculateAverageClarifications(recentMetrics),
      userSatisfaction: this.calculateUserSatisfaction(recentMetrics)
    };
    
    const beforeRAG = {
      successRate: olderMetrics.length > 0 ? 
        olderMetrics.reduce((sum, m) => sum + m.successRate, 0) / olderMetrics.length : 0,
      averageClarifications: this.calculateAverageClarifications(olderMetrics),
      userSatisfaction: this.calculateUserSatisfaction(olderMetrics)
    };
    
    return {
      beforeRAG,
      afterRAG,
      improvement: {
        successRateImprovement: afterRAG.successRate - beforeRAG.successRate,
        clarificationReduction: beforeRAG.averageClarifications - afterRAG.averageClarifications,
        satisfactionImprovement: afterRAG.userSatisfaction - beforeRAG.userSatisfaction
      }
    };
  }

  private calculateAverageClarifications(metrics: RAGMetrics[]): number {
    if (metrics.length === 0) return 0;
    // This would need to be enhanced with actual clarification tracking
    return 0.5; // Placeholder
  }

  private calculateUserSatisfaction(metrics: RAGMetrics[]): number {
    if (metrics.length === 0) return 0;
    // This would need to be enhanced with actual satisfaction tracking
    return 75; // Placeholder - would be based on user feedback
  }

  /**
   * Get detailed performance breakdown
   */
  async getDetailedBreakdown() {
    const currentMetrics = await this.getCurrentMetrics();
    const userDataStats = userDataEnhancer.getStats();
    const specializedStats = specializedRAG.getStats();
    
    return {
      overall: {
        totalInteractions: currentMetrics.totalInteractions,
        successRate: currentMetrics.successRate.toFixed(2) + '%',
        averageConfidence: currentMetrics.averageConfidence.toFixed(2),
        improvement: currentMetrics.learningProgress.improvements.toFixed(2) + '%'
      },
      domains: {
        general: userDataStats,
        charts: specializedStats.chartExamples,
        analysis: specializedStats.analysisExamples,
        crm: specializedStats.crmExamples,
        conversations: specializedStats.conversationExamples
      },
      learning: {
        examplesAdded: currentMetrics.learningProgress.examplesAdded,
        patternsLearned: currentMetrics.learningProgress.patternsLearned,
        recentImprovements: currentMetrics.learningProgress.improvements
      }
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): RAGMetrics[] {
    return [...this.metrics];
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = [];
    console.log('🔄 RAG Metrics Reset');
  }
}

// Export singleton instance
export const ragMonitor = RAGMonitor.getInstance(); 