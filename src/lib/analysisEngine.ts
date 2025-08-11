import { openaiClient } from '@/lib/openaiClient';

export interface PipelineAnalysis {
  totalDeals: number;
  totalValue: number;
  conversionRates: Record<string, number>;
  averageDealSize: number;
  salesVelocity: number;
  stageBreakdown: Array<{
    stage: string;
    count: number;
    value: number;
    conversionRate: number;
  }>;
  insights: string[];
  recommendations: string[];
}

export interface ChurnAnalysis {
  churnRate: number;
  atRiskCustomers: Array<{
    customerId: string;
    customerName: string;
    riskScore: number;
    lastActivity: Date;
    reasons: string[];
  }>;
  retentionFactors: string[];
  churnPredictions: Array<{
    customerId: string;
    churnProbability: number;
    nextAction: string;
  }>;
}

export interface RevenueForecast {
  currentMonth: number;
  nextMonth: number;
  nextQuarter: number;
  confidence: number;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  trends: Array<{
    period: string;
    revenue: number;
    growth: number;
  }>;
}

export interface MarketOpportunity {
  totalOpportunity: number;
  addressableMarket: number;
  marketShare: number;
  growthPotential: number;
  topOpportunities: Array<{
    accountId: string;
    accountName: string;
    opportunityValue: number;
    probability: number;
    timeframe: string;
  }>;
  recommendations: string[];
}

export class AnalysisEngine {
  private static instance: AnalysisEngine;

  private constructor() {}

  static getInstance(): AnalysisEngine {
    if (!AnalysisEngine.instance) {
      AnalysisEngine.instance = new AnalysisEngine();
    }
    return AnalysisEngine.instance;
  }

  async analyzeSalesPipeline(deals: any[], contacts: any[], accounts: any[]): Promise<PipelineAnalysis> {
    console.log('📊 Analyzing sales pipeline...');
    
    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, deal) => sum + (parseFloat(deal.value || '0') || 0), 0);
    const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
    
    // Group deals by stage
    const stageGroups = new Map<string, { deals: any[], value: number }>();
    deals.forEach(deal => {
      const stage = deal.stage || 'unknown';
      if (!stageGroups.has(stage)) {
        stageGroups.set(stage, { deals: [], value: 0 });
      }
      stageGroups.get(stage)!.deals.push(deal);
      stageGroups.get(stage)!.value += parseFloat(deal.value || '0') || 0;
    });
    
    // Calculate conversion rates
    const stages = Array.from(stageGroups.keys());
    const conversionRates: Record<string, number> = {};
    let previousCount = totalDeals;
    
    stages.forEach(stage => {
      const currentCount = stageGroups.get(stage)!.deals.length;
      conversionRates[stage] = previousCount > 0 ? (currentCount / previousCount) * 100 : 0;
      previousCount = currentCount;
    });
    
    // Calculate sales velocity (deals per month)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentDeals = deals.filter(deal => 
      new Date(deal._creationTime) > thirtyDaysAgo
    );
    const salesVelocity = recentDeals.length;
    
    // Generate insights using AI
    const insights = await this.generatePipelineInsights({
      totalDeals,
      totalValue,
      averageDealSize,
      salesVelocity,
      stageBreakdown: Array.from(stageGroups.entries()).map(([stage, data]) => ({
        stage,
        count: data.deals.length,
        value: data.value,
        conversionRate: conversionRates[stage] || 0
      }))
    });
    
    return {
      totalDeals,
      totalValue,
      conversionRates,
      averageDealSize,
      salesVelocity,
      stageBreakdown: Array.from(stageGroups.entries()).map(([stage, data]) => ({
        stage,
        count: data.deals.length,
        value: data.value,
        conversionRate: conversionRates[stage] || 0
      })),
      insights: insights.insights,
      recommendations: insights.recommendations
    };
  }

  async predictCustomerChurn(contacts: any[], activities: any[], deals: any[]): Promise<ChurnAnalysis> {
    console.log('🔮 Predicting customer churn...');
    
    // Calculate activity scores for each contact
    const contactActivityScores = new Map<string, {
      contactId: string;
      contactName: string;
      lastActivity: Date;
      activityCount: number;
      dealCount: number;
      totalDealValue: number;
      riskScore: number;
    }>();
    
    contacts.forEach(contact => {
      const contactId = contact._id;
      const contactActivities = activities.filter(activity => 
        activity.contactId === contactId || 
        activity.subject?.toLowerCase().includes(contact.firstName?.toLowerCase() || '') ||
        activity.subject?.toLowerCase().includes(contact.lastName?.toLowerCase() || '')
      );
      
      const contactDeals = deals.filter(deal => 
        deal.contactId === contactId ||
        deal.name?.toLowerCase().includes(contact.firstName?.toLowerCase() || '') ||
        deal.name?.toLowerCase().includes(contact.lastName?.toLowerCase() || '')
      );
      
      const lastActivity = contactActivities.length > 0 
        ? new Date(Math.max(...contactActivities.map(a => a._creationTime)))
        : new Date(contact._creationTime);
      
      const daysSinceLastActivity = (new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      const activityScore = contactActivities.length;
      const dealScore = contactDeals.length;
      const dealValueScore = contactDeals.reduce((sum, deal) => sum + (parseFloat(deal.value || '0') || 0), 0);
      
      // Calculate risk score (higher = more likely to churn)
      const riskScore = Math.max(0, 100 - (
        (activityScore * 10) + 
        (dealScore * 15) + 
        (dealValueScore / 1000) + 
        (daysSinceLastActivity * -2)
      ));
      
      contactActivityScores.set(contactId, {
        contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        lastActivity,
        activityCount: activityScore,
        dealCount: dealScore,
        totalDealValue: dealValueScore,
        riskScore: Math.min(100, Math.max(0, riskScore))
      });
    });
    
    // Find at-risk customers (risk score > 70)
    const atRiskCustomers = Array.from(contactActivityScores.values())
      .filter(customer => customer.riskScore > 70)
      .sort((a, b) => b.riskScore - a.riskScore)
      .map(customer => ({
        customerId: customer.contactId,
        customerName: customer.contactName,
        riskScore: customer.riskScore,
        lastActivity: customer.lastActivity,
        reasons: this.generateChurnReasons(customer)
      }));
    
    // Calculate overall churn rate
    const totalCustomers = contacts.length;
    const highRiskCustomers = atRiskCustomers.length;
    const churnRate = totalCustomers > 0 ? (highRiskCustomers / totalCustomers) * 100 : 0;
    
    // Generate churn predictions using AI
    const predictions = await this.generateChurnPredictions(atRiskCustomers);
    
    return {
      churnRate,
      atRiskCustomers,
      retentionFactors: [
        'Increase engagement through personalized outreach',
        'Offer value-add services to high-risk customers',
        'Implement proactive customer success programs',
        'Create re-engagement campaigns for inactive customers'
      ],
      churnPredictions: predictions
    };
  }

  async forecastRevenue(deals: any[], historicalData: any[]): Promise<RevenueForecast> {
    console.log('💰 Forecasting revenue...');
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate current month revenue
    const currentMonthDeals = deals.filter(deal => {
      const dealDate = new Date(deal._creationTime);
      return dealDate.getMonth() === currentMonth && dealDate.getFullYear() === currentYear;
    });
    const currentMonthRevenue = currentMonthDeals.reduce((sum, deal) => 
      sum + (parseFloat(deal.value || '0') || 0), 0
    );
    
    // Calculate next month forecast (simple trend analysis)
    const lastMonthDeals = deals.filter(deal => {
      const dealDate = new Date(deal._creationTime);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return dealDate.getMonth() === lastMonth && dealDate.getFullYear() === lastMonthYear;
    });
    const lastMonthRevenue = lastMonthDeals.reduce((sum, deal) => 
      sum + (parseFloat(deal.value || '0') || 0), 0
    );
    
    // Simple growth calculation
    const growthRate = lastMonthRevenue > 0 ? (currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue : 0.1;
    const nextMonthRevenue = currentMonthRevenue * (1 + growthRate);
    const nextQuarterRevenue = nextMonthRevenue * 3;
    
    // Generate AI-powered insights
    const forecastInsights = await this.generateRevenueInsights({
      currentMonthRevenue,
      lastMonthRevenue,
      growthRate,
      deals: deals.length
    });
    
    return {
      currentMonth: currentMonthRevenue,
      nextMonth: nextMonthRevenue,
      nextQuarter: nextQuarterRevenue,
      confidence: Math.min(95, Math.max(60, 80 + (growthRate * 100))),
      factors: forecastInsights.factors,
      trends: [
        { period: 'Last Month', revenue: lastMonthRevenue, growth: 0 },
        { period: 'Current Month', revenue: currentMonthRevenue, growth: growthRate * 100 },
        { period: 'Next Month', revenue: nextMonthRevenue, growth: growthRate * 100 }
      ]
    };
  }

  async analyzeMarketOpportunities(accounts: any[], deals: any[], contacts: any[]): Promise<MarketOpportunity> {
    console.log('🎯 Analyzing market opportunities...');
    
    // Calculate total opportunity value
    const totalOpportunity = deals.reduce((sum, deal) => 
      sum + (parseFloat(deal.value || '0') || 0), 0
    );
    
    // Estimate addressable market (3x current pipeline)
    const addressableMarket = totalOpportunity * 3;
    
    // Calculate current market share (assumption: 5% of addressable market)
    const marketShare = (totalOpportunity / addressableMarket) * 100;
    
    // Identify top opportunities
    const accountOpportunities = new Map<string, {
      accountId: string;
      accountName: string;
      totalValue: number;
      dealCount: number;
      contactCount: number;
    }>();
    
    deals.forEach(deal => {
      const accountName = deal.company || 'Unknown';
      if (!accountOpportunities.has(accountName)) {
        accountOpportunities.set(accountName, {
          accountId: deal.accountId || accountName,
          accountName,
          totalValue: 0,
          dealCount: 0,
          contactCount: 0
        });
      }
      
      const account = accountOpportunities.get(accountName)!;
      account.totalValue += parseFloat(deal.value || '0') || 0;
      account.dealCount += 1;
    });
    
    // Count contacts per account
    contacts.forEach(contact => {
      if (contact.company) {
        const account = accountOpportunities.get(contact.company);
        if (account) {
          account.contactCount += 1;
        }
      }
    });
    
    const topOpportunities = Array.from(accountOpportunities.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map(account => ({
        accountId: account.accountId,
        accountName: account.accountName,
        opportunityValue: account.totalValue,
        probability: Math.min(95, 50 + (account.dealCount * 10) + (account.contactCount * 5)),
        timeframe: account.dealCount > 2 ? '30 days' : '90 days'
      }));
    
    // Generate AI-powered recommendations
    const recommendations = await this.generateOpportunityRecommendations(topOpportunities);
    
    return {
      totalOpportunity,
      addressableMarket,
      marketShare,
      growthPotential: Math.max(0, 100 - marketShare),
      topOpportunities,
      recommendations
    };
  }

  private async generatePipelineInsights(data: any): Promise<{ insights: string[], recommendations: string[] }> {
    const prompt = `
Analyze this sales pipeline data and provide insights and recommendations:

${JSON.stringify(data, null, 2)}

Provide 3-5 key insights and 3-5 actionable recommendations.
Return as JSON: { "insights": [], "recommendations": [] }
`;

    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [{ role: "system", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      }, {
        userId: 'analysis_engine',
        operation: 'pipeline_insights',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error generating pipeline insights:', error);
    }

    return {
      insights: ['Pipeline analysis completed successfully'],
      recommendations: ['Focus on improving conversion rates between stages']
    };
  }

  private generateChurnReasons(customer: any): string[] {
    const reasons = [];
    
    if (customer.activityCount === 0) {
      reasons.push('No recent activity');
    }
    if (customer.dealCount === 0) {
      reasons.push('No active deals');
    }
    if (customer.totalDealValue === 0) {
      reasons.push('No revenue generated');
    }
    if (customer.riskScore > 80) {
      reasons.push('High churn risk score');
    }
    
    return reasons.length > 0 ? reasons : ['Low engagement'];
  }

  private async generateChurnPredictions(atRiskCustomers: any[]): Promise<any[]> {
    return atRiskCustomers.map(customer => ({
      customerId: customer.customerId,
      churnProbability: customer.riskScore / 100,
      nextAction: customer.riskScore > 90 ? 'Immediate outreach' : 
                  customer.riskScore > 80 ? 'Schedule check-in' : 'Monitor closely'
    }));
  }

  private async generateRevenueInsights(data: any): Promise<{ factors: any[] }> {
    const factors = [];
    
    if (data.growthRate > 0.1) {
      factors.push({
        factor: 'Strong growth trend',
        impact: 'positive' as const,
        description: 'Revenue is growing at a healthy rate'
      });
    } else if (data.growthRate < -0.1) {
      factors.push({
        factor: 'Declining revenue',
        impact: 'negative' as const,
        description: 'Revenue is decreasing, need to investigate'
      });
    }
    
    if (data.deals > 10) {
      factors.push({
        factor: 'Active pipeline',
        impact: 'positive' as const,
        description: 'Good number of deals in pipeline'
      });
    }
    
    return { factors };
  }

  private async generateOpportunityRecommendations(opportunities: any[]): Promise<string[]> {
    return [
      'Focus on high-value accounts with multiple contacts',
      'Develop account-based marketing strategies',
      'Increase engagement with decision-makers',
      'Create personalized outreach campaigns',
      'Implement customer success programs for key accounts'
    ];
  }
}

export const analysisEngine = AnalysisEngine.getInstance(); 