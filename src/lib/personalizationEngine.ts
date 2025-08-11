import { openaiClient } from '@/lib/openaiClient';

export interface UserBehavior {
  userId: string;
  preferredDataTypes: string[];
  frequentQueries: Array<{
    query: string;
    frequency: number;
    lastUsed: Date;
  }>;
  chartPreferences: Array<{
    chartType: string;
    dataType: string;
    frequency: number;
  }>;
  interactionPatterns: Array<{
    action: string;
    frequency: number;
    timeOfDay: string;
    dayOfWeek: string;
  }>;
  featureUsage: Record<string, number>;
}

export interface PersonalizedDashboard {
  userId: string;
  widgets: Array<{
    id: string;
    type: 'chart' | 'table' | 'metric' | 'insight';
    title: string;
    data: any;
    position: { x: number; y: number; width: number; height: number };
    refreshInterval: number;
  }>;
  layout: 'grid' | 'list' | 'custom';
  theme: 'light' | 'dark' | 'auto';
  lastUpdated: Date;
}

export interface PersonalizedInsight {
  userId: string;
  insight: string;
  relevance: number;
  actionability: number;
  category: 'sales' | 'marketing' | 'customer' | 'product' | 'general';
  suggestedActions: string[];
  timestamp: Date;
}

export interface AdaptiveUI {
  userId: string;
  preferredView: 'table' | 'chart' | 'list';
  quickActions: string[];
  shortcuts: Record<string, string>;
  interfacePreferences: {
    compactMode: boolean;
    showSuggestions: boolean;
    autoRefresh: boolean;
    notificationLevel: 'high' | 'medium' | 'low';
  };
}

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;
  private userBehaviors: Map<string, UserBehavior> = new Map();
  private dashboards: Map<string, PersonalizedDashboard> = new Map();
  private insights: Map<string, PersonalizedInsight[]> = new Map();
  private uiPreferences: Map<string, AdaptiveUI> = new Map();

  private constructor() {}

  static getInstance(): PersonalizationEngine {
    if (!PersonalizationEngine.instance) {
      PersonalizationEngine.instance = new PersonalizationEngine();
    }
    return PersonalizationEngine.instance;
  }

  async trackUserInteraction(userId: string, action: string, data?: any): Promise<void> {
    console.log('📊 Tracking user interaction:', { userId, action, data });
    
    let behavior = this.userBehaviors.get(userId);
    if (!behavior) {
      behavior = {
        userId,
        preferredDataTypes: [],
        frequentQueries: [],
        chartPreferences: [],
        interactionPatterns: [],
        featureUsage: {}
      };
      this.userBehaviors.set(userId, behavior);
    }

    // Track feature usage
    behavior.featureUsage[action] = (behavior.featureUsage[action] || 0) + 1;

    // Track interaction patterns
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(now);
    const dayOfWeek = this.getDayOfWeek(now);
    
    const existingPattern = behavior.interactionPatterns.find(p => 
      p.action === action && p.timeOfDay === timeOfDay && p.dayOfWeek === dayOfWeek
    );
    
    if (existingPattern) {
      existingPattern.frequency += 1;
    } else {
      behavior.interactionPatterns.push({
        action,
        frequency: 1,
        timeOfDay,
        dayOfWeek
      });
    }

    // Track queries if it's a data query
    if (action === 'data_query' && data?.query) {
      const existingQuery = behavior.frequentQueries.find(q => q.query === data.query);
      if (existingQuery) {
        existingQuery.frequency += 1;
        existingQuery.lastUsed = now;
      } else {
        behavior.frequentQueries.push({
          query: data.query,
          frequency: 1,
          lastUsed: now
        });
      }
    }

    // Track chart preferences if it's a chart generation
    if (action === 'chart_generation' && data?.chartType && data?.dataType) {
      const existingPreference = behavior.chartPreferences.find(p => 
        p.chartType === data.chartType && p.dataType === data.dataType
      );
      if (existingPreference) {
        existingPreference.frequency += 1;
      } else {
        behavior.chartPreferences.push({
          chartType: data.chartType,
          dataType: data.dataType,
          frequency: 1
        });
      }
    }

    // Update preferred data types
    if (data?.dataType && !behavior.preferredDataTypes.includes(data.dataType)) {
      behavior.preferredDataTypes.push(data.dataType);
    }

    // Limit arrays to prevent memory issues
    behavior.frequentQueries = behavior.frequentQueries
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    
    behavior.chartPreferences = behavior.chartPreferences
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    
    behavior.interactionPatterns = behavior.interactionPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  }

  async generatePersonalizedDashboard(userId: string, userData: any): Promise<PersonalizedDashboard> {
    console.log('🎨 Generating personalized dashboard for user:', userId);
    
    const behavior = this.userBehaviors.get(userId);
    if (!behavior) {
      return this.createDefaultDashboard(userId);
    }

    const widgets = [];

    // Add most frequently used data type widget
    if (behavior.preferredDataTypes.length > 0) {
      const topDataType = behavior.preferredDataTypes[0];
      widgets.push({
        id: `frequent-${topDataType}`,
        type: 'table' as const,
        title: `Recent ${topDataType}`,
        data: { dataType: topDataType, limit: 10 },
        position: { x: 0, y: 0, width: 6, height: 4 },
        refreshInterval: 300000 // 5 minutes
      });
    }

    // Add most used chart type
    if (behavior.chartPreferences.length > 0) {
      const topChart = behavior.chartPreferences[0];
      widgets.push({
        id: `chart-${topChart.dataType}`,
        type: 'chart' as const,
        title: `${topChart.dataType} Overview`,
        data: { 
          chartType: topChart.chartType, 
          dataType: topChart.dataType,
          dimension: 'status'
        },
        position: { x: 6, y: 0, width: 6, height: 4 },
        refreshInterval: 600000 // 10 minutes
      });
    }

    // Add key metrics widget
    widgets.push({
      id: 'key-metrics',
      type: 'metric' as const,
      title: 'Key Metrics',
      data: { metrics: ['total_contacts', 'total_deals', 'revenue'] },
      position: { x: 0, y: 4, width: 12, height: 2 },
      refreshInterval: 300000 // 5 minutes
    });

    // Add personalized insights widget
    const userInsights = this.insights.get(userId) || [];
    if (userInsights.length > 0) {
      widgets.push({
        id: 'personalized-insights',
        type: 'insight' as const,
        title: 'Personalized Insights',
        data: { insights: userInsights.slice(0, 3) },
        position: { x: 0, y: 6, width: 12, height: 3 },
        refreshInterval: 1800000 // 30 minutes
      });
    }

    const dashboard: PersonalizedDashboard = {
      userId,
      widgets,
      layout: 'grid',
      theme: 'auto',
      lastUpdated: new Date()
    };

    this.dashboards.set(userId, dashboard);
    return dashboard;
  }

  async generatePersonalizedInsights(userId: string, userData: any): Promise<PersonalizedInsight[]> {
    console.log('💡 Generating personalized insights for user:', userId);
    
    const behavior = this.userBehaviors.get(userId);
    if (!behavior) {
      return [];
    }

    const insights: PersonalizedInsight[] = [];

    // Generate insights based on user behavior
    const prompt = `
Generate personalized insights for a CRM user based on their behavior:

User Behavior:
- Preferred data types: ${behavior.preferredDataTypes.join(', ')}
- Most frequent queries: ${behavior.frequentQueries.slice(0, 3).map(q => q.query).join(', ')}
- Chart preferences: ${behavior.chartPreferences.slice(0, 3).map(p => `${p.chartType} for ${p.dataType}`).join(', ')}
- Feature usage: ${Object.entries(behavior.featureUsage).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ')}

User Data Summary:
- Total contacts: ${userData.contacts?.length || 0}
- Total deals: ${userData.deals?.length || 0}
- Total accounts: ${userData.accounts?.length || 0}

Generate 3-5 personalized insights that would be valuable for this user.
Each insight should include:
- The insight itself
- Relevance score (0-100)
- Actionability score (0-100)
- Category (sales/marketing/customer/product/general)
- 2-3 suggested actions

Return as JSON array of insights.
`;

    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [{ role: "system", content: prompt }],
        temperature: 0.7,
        max_tokens: 800
      }, {
        userId,
        operation: 'personalized_insights',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const generatedInsights = JSON.parse(content);
        const personalizedInsights: PersonalizedInsight[] = generatedInsights.map((insight: any) => ({
          userId,
          insight: insight.insight,
          relevance: insight.relevance,
          actionability: insight.actionability,
          category: insight.category,
          suggestedActions: insight.suggestedActions,
          timestamp: new Date()
        }));

        // Store insights
        this.insights.set(userId, personalizedInsights);
        return personalizedInsights;
      }
    } catch (error) {
      console.error('Error generating personalized insights:', error);
    }

    // Fallback insights
    return [
      {
        userId,
        insight: "You frequently view contact data. Consider setting up automated contact scoring to prioritize your most valuable prospects.",
        relevance: 85,
        actionability: 90,
        category: 'sales' as const,
        suggestedActions: ['Set up contact scoring rules', 'Create contact segments', 'Automate follow-up sequences'],
        timestamp: new Date()
      }
    ];
  }

  async adaptUI(userId: string): Promise<AdaptiveUI> {
    console.log('🎛️ Adapting UI for user:', userId);
    
    const behavior = this.userBehaviors.get(userId);
    if (!behavior) {
      return this.createDefaultUI(userId);
    }

    // Determine preferred view based on most used features
    const viewUsage = {
      table: behavior.featureUsage['view_data'] || 0,
      chart: behavior.featureUsage['chart_generation'] || 0,
      list: behavior.featureUsage['list_view'] || 0
    };
    
    const preferredView = Object.entries(viewUsage)
      .sort(([,a], [,b]) => b - a)[0][0] as 'table' | 'chart' | 'list';

    // Generate quick actions based on frequent queries
    const quickActions = behavior.frequentQueries
      .slice(0, 5)
      .map(query => query.query);

    // Create shortcuts based on most used features
    const shortcuts: Record<string, string> = {};
    const topFeatures = Object.entries(behavior.featureUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    topFeatures.forEach(([feature, count], index) => {
      shortcuts[`Ctrl+${index + 1}`] = feature;
    });

    // Determine interface preferences
    const interfacePreferences = {
      compactMode: behavior.featureUsage['compact_mode'] > 0,
      showSuggestions: behavior.featureUsage['suggestions'] > 0,
      autoRefresh: behavior.featureUsage['auto_refresh'] > 0,
      notificationLevel: this.determineNotificationLevel(behavior) as 'high' | 'medium' | 'low'
    };

    const adaptiveUI: AdaptiveUI = {
      userId,
      preferredView,
      quickActions,
      shortcuts,
      interfacePreferences
    };

    this.uiPreferences.set(userId, adaptiveUI);
    return adaptiveUI;
  }

  async getRecommendations(userId: string): Promise<string[]> {
    const behavior = this.userBehaviors.get(userId);
    if (!behavior) {
      return [
        'Start by exploring your contacts data',
        'Try creating a chart to visualize your data',
        'Ask questions about your CRM data in natural language'
      ];
    }

    const recommendations: string[] = [];

    // Recommend based on usage patterns
    if (behavior.featureUsage['view_data'] > behavior.featureUsage['chart_generation']) {
      recommendations.push('Try creating charts to better visualize your data trends');
    }

    if (behavior.preferredDataTypes.includes('contacts') && !behavior.preferredDataTypes.includes('deals')) {
      recommendations.push('Explore your deals data to understand your sales pipeline');
    }

    if (behavior.frequentQueries.length === 0) {
      recommendations.push('Try asking questions like "Which account has the most contacts?" or "Show me all deals over $10k"');
    }

    // Add personalized recommendations based on insights
    const userInsights = this.insights.get(userId) || [];
    userInsights.slice(0, 2).forEach(insight => {
      if (insight.suggestedActions.length > 0) {
        recommendations.push(insight.suggestedActions[0]);
      }
    });

    return recommendations.slice(0, 5);
  }

  private createDefaultDashboard(userId: string): PersonalizedDashboard {
    return {
      userId,
      widgets: [
        {
          id: 'welcome-widget',
          type: 'insight' as const,
          title: 'Welcome to Shabe AI',
          data: { 
            message: 'Start by exploring your data or asking questions in natural language!',
            suggestions: [
              'Try "show me all contacts"',
              'Ask "which account has the most contacts?"',
              'Create charts with "show deals by stage"'
            ]
          },
          position: { x: 0, y: 0, width: 12, height: 4 },
          refreshInterval: 0
        }
      ],
      layout: 'grid',
      theme: 'auto',
      lastUpdated: new Date()
    };
  }

  private createDefaultUI(userId: string): AdaptiveUI {
    return {
      userId,
      preferredView: 'table',
      quickActions: ['View contacts', 'Show deals', 'Create chart'],
      shortcuts: {
        'Ctrl+1': 'view_contacts',
        'Ctrl+2': 'view_deals',
        'Ctrl+3': 'create_chart'
      },
      interfacePreferences: {
        compactMode: false,
        showSuggestions: true,
        autoRefresh: false,
        notificationLevel: 'medium'
      }
    };
  }

  private getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  private determineNotificationLevel(behavior: UserBehavior): 'high' | 'medium' | 'low' {
    const totalInteractions = Object.values(behavior.featureUsage).reduce((sum, count) => sum + count, 0);
    
    if (totalInteractions > 100) return 'high';
    if (totalInteractions > 50) return 'medium';
    return 'low';
  }

  // Getter methods for external access
  getUserBehavior(userId: string): UserBehavior | undefined {
    return this.userBehaviors.get(userId);
  }

  getDashboard(userId: string): PersonalizedDashboard | undefined {
    return this.dashboards.get(userId);
  }

  getInsights(userId: string): PersonalizedInsight[] {
    return this.insights.get(userId) || [];
  }

  getUI(userId: string): AdaptiveUI | undefined {
    return this.uiPreferences.get(userId);
  }
}

export const personalizationEngine = PersonalizationEngine.getInstance(); 