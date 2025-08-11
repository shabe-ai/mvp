import { Intent } from './intentClassifier';
import { ConversationManager } from './conversationManager';
import { ConversationResponse } from '@/types/chat';

export interface IntentHandler {
  canHandle(intent: Intent): boolean;
  handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse>;
}

export class IntentRouter {
  private handlers: IntentHandler[] = [];

  registerHandler(handler: IntentHandler): void {
    this.handlers.push(handler);
  }

  async routeIntent(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('🛣️ Routing intent:', intent.action, 'with confidence:', intent.confidence);
    
    // If intent needs clarification, return clarification response
    if (intent.metadata.needsClarification) {
      return {
        message: intent.metadata.clarificationQuestion || "Could you please clarify what you'd like me to help you with?",
        needsClarification: true,
              conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: 'clarification_requested',
        referringTo: intent.context.referringTo
      }
      };
    }

    // Find appropriate handler
    const handler = this.handlers.find(h => h.canHandle(intent));
    
    if (handler) {
      console.log('🛣️ Found handler for intent:', intent.action);
      return await handler.handle(intent, conversationManager, context);
    }

    // Fallback to general conversation
    console.log('🛣️ No specific handler found, falling back to general conversation');
    return {
      message: "I understand you want to work with your data, but I need a bit more information. Could you please be more specific about what you'd like to do?",
      needsClarification: true,
      conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: 'general_fallback',
        referringTo: intent.context.referringTo
      }
    };
  }
}

// Chart Intent Handler
export class ChartIntentHandler implements IntentHandler {
  canHandle(intent: Intent): boolean {
    return ['create_chart', 'modify_chart', 'analyze_data', 'export_data'].includes(intent.action);
  }

  async handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('📊 Handling chart intent:', intent.action);
    
    // Check if user is referring to current chart for modifications
    if (conversationManager.isReferringToCurrentChart(intent.originalMessage)) {
      return await this.handleChartModification(intent, conversationManager, context);
    }
    
    const { handleChartGeneration } = await import('@/lib/chatHandlers');
    
    // Build chart request from intent
    const chartRequest = this.buildChartRequest(intent, conversationManager);
    
    // Call existing chart generation logic
    const result = await handleChartGeneration(chartRequest, {}, context.sessionFiles || [], context.userId);
    
    // Update conversation state
    if (result.chartSpec) {
      conversationManager.setActiveChart({
        chartId: `chart-${Date.now()}`,
        chartType: intent.entities.chartType || 'bar',
        dataType: intent.entities.dataType || 'deals',
        dimension: (intent.entities.dimension as 'stage' | 'status' | 'industry' | 'type') || 'stage',
        title: result.chartSpec.title || 'Chart',
        lastModified: new Date(),
        insights: result.chartSpec.insights
      });
    }
    
    return {
      message: result.message,
      chartSpec: result.chartSpec,
      enhancedChart: result.enhancedChart,
      suggestions: conversationManager.getSuggestions(),
      conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: intent.action,
        referringTo: intent.context.referringTo
      }
    };
  }

  private async handleChartModification(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('🔄 Handling chart modification request');
    
    const activeChart = conversationManager.getState().currentContext.activeChart;
    if (!activeChart) {
      return {
        message: "I don't see an active chart to modify. Could you please create a chart first?",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'chart_modification',
          referringTo: 'no_active_chart'
        }
      };
    }

    // Extract the new chart type from the user's message
    const message = intent.originalMessage.toLowerCase();
    let newChartType: string | null = null;
    
    if (message.includes('pie')) newChartType = 'pie';
    else if (message.includes('bar')) newChartType = 'bar';
    else if (message.includes('line')) newChartType = 'line';
    else if (message.includes('area')) newChartType = 'area';
    else if (message.includes('scatter')) newChartType = 'scatter';
    
    if (!newChartType) {
      return {
        message: `I understand you want to modify the current ${activeChart.chartType} chart, but I need to know what type of chart you'd like. You can say "make it a pie chart", "change to bar chart", etc.`,
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'chart_modification',
          referringTo: 'chart_type_needed'
        }
      };
    }

    // Create a new chart with the same data but different type
    const modificationRequest = `show ${activeChart.dataType} by ${activeChart.dimension} as ${newChartType} chart`;
    
    try {
      const { handleChartGeneration } = await import('@/lib/chatHandlers');
      const result = await handleChartGeneration(modificationRequest, {}, context.sessionFiles || [], context.userId);
      
      // Update the conversation context
      conversationManager.updateContext(intent.originalMessage, 'chart_modified');
      
      return {
        ...result,
        message: `Perfect! I've converted your ${activeChart.chartType} chart to a ${newChartType} chart. ${result.message}`,
        conversationContext: {
          phase: 'modification',
          action: 'chart_modified',
          referringTo: 'current_chart'
        }
      };
      
    } catch (error) {
      console.error('❌ Chart modification failed:', error);
      return {
        message: `I encountered an error while converting your chart to a ${newChartType} chart. Please try again.`,
        conversationContext: {
          phase: 'error',
          action: 'chart_modification_failed',
          referringTo: 'current_chart'
        }
      };
    }
  }

  private buildChartRequest(intent: Intent, conversationManager: ConversationManager): string {
    let request = '';
    
    if (intent.action === 'create_chart') {
      request = 'create';
      if (intent.entities.chartType) request += ` ${intent.entities.chartType} chart`;
      if (intent.entities.dataType) request += ` of ${intent.entities.dataType}`;
      if (intent.entities.dimension) request += ` by ${intent.entities.dimension}`;
    } else if (intent.action === 'modify_chart') {
      request = 'modify';
      if (intent.entities.chartType) request += ` to ${intent.entities.chartType} chart`;
      if (intent.entities.action) request += ` ${intent.entities.action}`;
    } else if (intent.action === 'analyze_data') {
      request = 'analyze';
      if (intent.entities.action) request += ` ${intent.entities.action}`;
      if (intent.entities.target) request += ` ${intent.entities.target}`;
    } else if (intent.action === 'export_data') {
      request = 'export';
      if (intent.entities.action) request += ` ${intent.entities.action}`;
    }
    
    return request.trim();
  }
}

// Data Intent Handler
export class DataIntentHandler implements IntentHandler {
  canHandle(intent: Intent): boolean {
    return ['view_data', 'explore_data'].includes(intent.action);
  }

  async handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('📋 Handling data intent:', intent.action);
    
    const { handleDatabaseQuery } = await import('@/lib/chatHandlers');
    
    // Build data request from intent
    const dataRequest = this.buildDataRequest(intent);
    
    // Call existing database query logic
    const result = await handleDatabaseQuery(dataRequest, {}, context.userId);
    
    return {
      message: result.message,
      data: result.data,
      suggestions: conversationManager.getSuggestions(),
      conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: intent.action,
        referringTo: intent.context.referringTo
      }
    };
  }

  private buildDataRequest(intent: Intent): string {
    let request = 'view';
    if (intent.entities.dataType) request += ` ${intent.entities.dataType}`;
    if (intent.entities.dimension) request += ` by ${intent.entities.dimension}`;
    return request.trim();
  }
}

// Analysis Intent Handler
export class AnalyzeIntentHandler implements IntentHandler {
  canHandle(intent: Intent): boolean {
    return ['analyze_data'].includes(intent.action);
  }

  async handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('🔍 Handling analysis intent:', intent.action);
    
    // Import analysis engine
    const { analysisEngine } = await import('@/lib/analysisEngine');
    const { personalizationEngine } = await import('@/lib/personalizationEngine');
    
    // Track user interaction for personalization
    await personalizationEngine.trackUserInteraction(context.userId, 'analysis_request', {
      dataType: intent.entities.dataType,
      target: intent.entities.target
    });
    
    // Handle account analysis queries
    if (intent.entities.dataType === 'accounts' && intent.entities.target?.includes('most contacts')) {
      return await this.handleAccountContactAnalysis(intent, conversationManager, context);
    }
    
    // Handle sales pipeline analysis
    if (intent.entities.target?.includes('pipeline') || intent.entities.target?.includes('sales')) {
      return await this.handleSalesPipelineAnalysis(intent, conversationManager, context);
    }
    
    // Handle churn analysis
    if (intent.entities.target?.includes('churn') || intent.entities.target?.includes('retention')) {
      return await this.handleChurnAnalysis(intent, conversationManager, context);
    }
    
    // Handle revenue forecasting
    if (intent.entities.target?.includes('revenue') || intent.entities.target?.includes('forecast')) {
      return await this.handleRevenueForecast(intent, conversationManager, context);
    }
    
    // Handle market opportunity analysis
    if (intent.entities.target?.includes('opportunity') || intent.entities.target?.includes('market')) {
      return await this.handleMarketOpportunityAnalysis(intent, conversationManager, context);
    }
    
    // Handle other analysis types
    return {
      message: "I understand you want to analyze data, but I need more specific information about what you'd like to analyze. Could you please clarify?",
      needsClarification: true,
      conversationContext: {
        phase: 'clarification',
        action: 'analyze_data',
        referringTo: 'new_request'
      }
    };
  }

  private async handleSalesPipelineAnalysis(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('📊 Analyzing sales pipeline...');
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      const { analysisEngine } = await import('@/lib/analysisEngine');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      // Get all data
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      
      // Analyze pipeline
      const pipelineAnalysis = await analysisEngine.analyzeSalesPipeline(deals, contacts, accounts);
      
      // Generate response message
      let message = `**Sales Pipeline Analysis**\n\n`;
      message += `📊 **Pipeline Overview:**\n`;
      message += `• Total Deals: ${pipelineAnalysis.totalDeals}\n`;
      message += `• Total Value: $${pipelineAnalysis.totalValue.toLocaleString()}\n`;
      message += `• Average Deal Size: $${pipelineAnalysis.averageDealSize.toLocaleString()}\n`;
      message += `• Sales Velocity: ${pipelineAnalysis.salesVelocity} deals/month\n\n`;
      
      message += `📈 **Stage Breakdown:**\n`;
      pipelineAnalysis.stageBreakdown.forEach(stage => {
        message += `• ${stage.stage}: ${stage.count} deals ($${stage.value.toLocaleString()}) - ${stage.conversionRate.toFixed(1)}% conversion\n`;
      });
      
      if (pipelineAnalysis.insights.length > 0) {
        message += `\n💡 **Key Insights:**\n`;
        pipelineAnalysis.insights.forEach(insight => {
          message += `• ${insight}\n`;
        });
      }
      
      if (pipelineAnalysis.recommendations.length > 0) {
        message += `\n🎯 **Recommendations:**\n`;
        pipelineAnalysis.recommendations.forEach(rec => {
          message += `• ${rec}\n`;
        });
      }
      
      return {
        message,
        data: {
          records: pipelineAnalysis.stageBreakdown.map(stage => ({
            id: stage.stage,
            _id: stage.stage,
            name: stage.stage,
            count: stage.count,
            value: stage.value,
            conversionRate: stage.conversionRate,
            type: 'pipeline_analysis'
          })),
          type: 'pipeline_analysis',
          count: pipelineAnalysis.stageBreakdown.length,
          displayFormat: 'analysis'
        },
        suggestions: conversationManager.getSuggestions(),
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Sales pipeline analysis failed:', error);
      return {
        message: "I encountered an error while analyzing your sales pipeline. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleChurnAnalysis(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('🔮 Analyzing customer churn...');
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      const { analysisEngine } = await import('@/lib/analysisEngine');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      // Get all data
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      
      // Analyze churn
      const churnAnalysis = await analysisEngine.predictCustomerChurn(contacts, activities, deals);
      
      // Generate response message
      let message = `**Customer Churn Analysis**\n\n`;
      message += `📊 **Overall Churn Rate:** ${churnAnalysis.churnRate.toFixed(1)}%\n`;
      message += `⚠️ **At-Risk Customers:** ${churnAnalysis.atRiskCustomers.length}\n\n`;
      
      if (churnAnalysis.atRiskCustomers.length > 0) {
        message += `🔴 **High-Risk Customers:**\n`;
        churnAnalysis.atRiskCustomers.slice(0, 5).forEach(customer => {
          message += `• ${customer.customerName} (Risk: ${customer.riskScore.toFixed(0)}%) - ${customer.reasons.join(', ')}\n`;
        });
      }
      
      if (churnAnalysis.retentionFactors.length > 0) {
        message += `\n💡 **Retention Strategies:**\n`;
        churnAnalysis.retentionFactors.forEach(factor => {
          message += `• ${factor}\n`;
        });
      }
      
      return {
        message,
        data: {
          records: churnAnalysis.atRiskCustomers.map(customer => ({
            id: customer.customerId,
            _id: customer.customerId,
            name: customer.customerName,
            riskScore: customer.riskScore,
            lastActivity: customer.lastActivity,
            reasons: customer.reasons.join(', '),
            type: 'churn_analysis'
          })),
          type: 'churn_analysis',
          count: churnAnalysis.atRiskCustomers.length,
          displayFormat: 'analysis'
        },
        suggestions: conversationManager.getSuggestions(),
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Churn analysis failed:', error);
      return {
        message: "I encountered an error while analyzing customer churn. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleRevenueForecast(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('💰 Forecasting revenue...');
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      const { analysisEngine } = await import('@/lib/analysisEngine');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      // Get deals data
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      
      // Forecast revenue
      const revenueForecast = await analysisEngine.forecastRevenue(deals, []);
      
      // Generate response message
      let message = `**Revenue Forecast**\n\n`;
      message += `📊 **Current Month:** $${revenueForecast.currentMonth.toLocaleString()}\n`;
      message += `🔮 **Next Month:** $${revenueForecast.nextMonth.toLocaleString()}\n`;
      message += `📈 **Next Quarter:** $${revenueForecast.nextQuarter.toLocaleString()}\n`;
      message += `🎯 **Confidence:** ${revenueForecast.confidence.toFixed(0)}%\n\n`;
      
      if (revenueForecast.factors.length > 0) {
        message += `📋 **Key Factors:**\n`;
        revenueForecast.factors.forEach(factor => {
          const emoji = factor.impact === 'positive' ? '✅' : factor.impact === 'negative' ? '❌' : '➡️';
          message += `${emoji} ${factor.factor}: ${factor.description}\n`;
        });
      }
      
      message += `\n📈 **Trends:**\n`;
      revenueForecast.trends.forEach(trend => {
        const growthEmoji = trend.growth > 0 ? '📈' : trend.growth < 0 ? '📉' : '➡️';
        message += `${growthEmoji} ${trend.period}: $${trend.revenue.toLocaleString()} (${trend.growth > 0 ? '+' : ''}${trend.growth.toFixed(1)}%)\n`;
      });
      
      return {
        message,
        data: {
          records: revenueForecast.trends.map(trend => ({
            id: trend.period,
            _id: trend.period,
            name: trend.period,
            revenue: trend.revenue,
            growth: trend.growth,
            type: 'revenue_forecast'
          })),
          type: 'revenue_forecast',
          count: revenueForecast.trends.length,
          displayFormat: 'analysis'
        },
        suggestions: conversationManager.getSuggestions(),
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Revenue forecast failed:', error);
      return {
        message: "I encountered an error while forecasting revenue. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleMarketOpportunityAnalysis(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('🎯 Analyzing market opportunities...');
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      const { analysisEngine } = await import('@/lib/analysisEngine');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      // Get all data
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      
      // Analyze opportunities
      const opportunityAnalysis = await analysisEngine.analyzeMarketOpportunities(accounts, deals, contacts);
      
      // Generate response message
      let message = `**Market Opportunity Analysis**\n\n`;
      message += `📊 **Market Overview:**\n`;
      message += `• Total Opportunity: $${opportunityAnalysis.totalOpportunity.toLocaleString()}\n`;
      message += `• Addressable Market: $${opportunityAnalysis.addressableMarket.toLocaleString()}\n`;
      message += `• Current Market Share: ${opportunityAnalysis.marketShare.toFixed(1)}%\n`;
      message += `• Growth Potential: ${opportunityAnalysis.growthPotential.toFixed(1)}%\n\n`;
      
      if (opportunityAnalysis.topOpportunities.length > 0) {
        message += `🎯 **Top Opportunities:**\n`;
        opportunityAnalysis.topOpportunities.slice(0, 5).forEach(opp => {
          message += `• ${opp.accountName}: $${opp.opportunityValue.toLocaleString()} (${opp.probability.toFixed(0)}% probability, ${opp.timeframe})\n`;
        });
      }
      
      if (opportunityAnalysis.recommendations.length > 0) {
        message += `\n💡 **Recommendations:**\n`;
        opportunityAnalysis.recommendations.forEach(rec => {
          message += `• ${rec}\n`;
        });
      }
      
      return {
        message,
        data: {
          records: opportunityAnalysis.topOpportunities.map(opp => ({
            id: opp.accountId,
            _id: opp.accountId,
            name: opp.accountName,
            opportunityValue: opp.opportunityValue,
            probability: opp.probability,
            timeframe: opp.timeframe,
            type: 'market_opportunity'
          })),
          type: 'market_opportunity',
          count: opportunityAnalysis.topOpportunities.length,
          displayFormat: 'analysis'
        },
        suggestions: conversationManager.getSuggestions(),
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Market opportunity analysis failed:', error);
      return {
        message: "I encountered an error while analyzing market opportunities. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleAccountContactAnalysis(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('🔍 Analyzing accounts by contact count');
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      // Get all contacts and accounts
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      
      console.log('📊 Analysis data:', {
        contactsCount: contacts.length,
        accountsCount: accounts.length
      });
      
      // Count contacts per account
      const accountContactCounts = new Map<string, number>();
      
      contacts.forEach(contact => {
        if (contact.company) {
          const currentCount = accountContactCounts.get(contact.company) || 0;
          accountContactCounts.set(contact.company, currentCount + 1);
        }
      });
      
      // Find account with most contacts
      let maxContacts = 0;
      let accountWithMostContacts = '';
      
      accountContactCounts.forEach((count, accountName) => {
        if (count > maxContacts) {
          maxContacts = count;
          accountWithMostContacts = accountName;
        }
      });
      
      // Create analysis result
      const analysisResult = {
        accountWithMostContacts,
        maxContacts,
        totalAccounts: accountContactCounts.size,
        totalContacts: contacts.length,
        accountBreakdown: Array.from(accountContactCounts.entries()).map(([account, count]) => ({
          account,
          contactCount: count
        })).sort((a, b) => b.contactCount - a.contactCount)
      };
      
      console.log('📊 Analysis result:', analysisResult);
      
      // Generate response message
      let message = '';
      if (accountWithMostContacts && maxContacts > 0) {
        message = `Based on your CRM data, **${accountWithMostContacts}** has the most contacts with **${maxContacts} contacts**.\n\n`;
        message += `**Account Breakdown:**\n`;
        analysisResult.accountBreakdown.forEach((item, index) => {
          message += `${index + 1}. ${item.account}: ${item.contactCount} contacts\n`;
        });
        message += `\n**Summary:** You have ${analysisResult.totalContacts} total contacts across ${analysisResult.totalAccounts} accounts.`;
      } else {
        message = "I couldn't find any accounts with contacts in your CRM data. You may need to add some contacts with company information first.";
      }
      
      return {
        message,
        data: {
          records: analysisResult.accountBreakdown.map(item => ({
            id: item.account,
            _id: item.account,
            name: item.account,
            contactCount: item.contactCount,
            type: 'account_analysis'
          })),
          type: 'account_analysis',
          count: analysisResult.accountBreakdown.length,
          displayFormat: 'analysis'
        },
        suggestions: conversationManager.getSuggestions(),
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Account analysis failed:', error);
      return {
        message: "I encountered an error while analyzing your account data. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'analyze_data',
          referringTo: 'new_request'
        }
      };
    }
  }
}

// CRUD Intent Handler
export class CrudIntentHandler implements IntentHandler {
  canHandle(intent: Intent): boolean {
    return ['create_contact', 'update_contact', 'delete_contact', 'send_email'].includes(intent.action);
  }

  async handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling CRUD intent:', intent.action);
    
    // Check if this is a confirmation response
    const currentState = conversationManager.getState();
    const lastMessage = currentState.memory.sessionHistory[currentState.memory.sessionHistory.length - 1];
    
    console.log('🔍 Confirmation check debug:', {
      intentAction: intent.action,
      originalMessage: intent.originalMessage,
      lastMessageExists: !!lastMessage,
      lastMessageContext: lastMessage?.conversationContext,
      sessionHistoryLength: currentState.memory.sessionHistory.length
    });
    
    // If the last message was asking for confirmation and user said "yes"
    if (lastMessage?.conversationContext?.action === 'update_contact' && 
        lastMessage?.conversationContext?.phase === 'confirmation' &&
        intent.originalMessage.toLowerCase().includes('yes')) {
      console.log('✅ Confirmation detected! Calling handleContactUpdateConfirmation');
      return await this.handleContactUpdateConfirmation(intent, conversationManager, context);
    }
    
    console.log('❌ No confirmation detected, proceeding with normal intent handling');
    
    // Import the appropriate handler based on intent
    let handlerFunction: any;
    
    switch (intent.action) {
      case 'create_contact':
        // This would need to be implemented or imported
        return {
          message: "I can help you create a new contact. Please provide the contact's name and email address.",
          needsClarification: true,
          conversationContext: {
            phase: 'creation',
            action: 'create_contact',
            referringTo: 'new_request'
          }
        };
        
      case 'update_contact':
        return await this.handleContactUpdate(intent, conversationManager, context);
        
      case 'delete_contact':
        const { handleContactDeleteWithConfirmation } = await import('@/lib/chatHandlers');
        handlerFunction = handleContactDeleteWithConfirmation;
        break;
        
      case 'send_email':
        // This would need to be implemented or imported
        return {
          message: "I can help you send an email. Please specify who you'd like to email and what you'd like to say.",
          needsClarification: true,
          conversationContext: {
            phase: 'email',
            action: 'send_email',
            referringTo: 'new_request'
          }
        };
    }
    
    if (handlerFunction) {
      const result = await handlerFunction(intent.context.userGoal || '', context.userId);
      return {
        message: result.message,
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: intent.action,
          referringTo: intent.context.referringTo
        }
      };
    }
    
    return {
      message: "I'm not sure how to handle that request. Could you please be more specific?",
      needsClarification: true,
      conversationContext: {
        phase: 'clarification',
        action: 'unknown',
        referringTo: 'new_request'
      }
    };
  }

  private async handleContactUpdate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based contact update with intent:', intent);
    
    // Use LLM-extracted entities instead of regex
    const contactName = intent.entities.contactName;
    const field = intent.entities.field;
    const value = intent.entities.value;
    
    console.log('📝 LLM-extracted data:', { contactName, field, value });
    
    if (!contactName || !field || !value) {
      console.log('❌ Missing required data from LLM extraction');
      return {
        message: "I couldn't understand the update request. Please specify the contact name and what field to update. For example: 'update john smith's email to johnsmith@acme.com'",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'update_contact',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the contact in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up contacts for team...');
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      console.log('👥 Contacts found:', contacts.length);
      console.log('📋 Contact names:', contacts.map(c => `${c.firstName} ${c.lastName}`));
      
      const matchingContact = contacts.find(contact => {
        const contactFullName = contact.firstName && contact.lastName 
          ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
          : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
        const searchName = contactName.toLowerCase();
        
        const matches = contactFullName.includes(searchName) || 
               searchName.includes(contactFullName) ||
               contactFullName.split(' ').some((part: string) => searchName.includes(part)) ||
               searchName.split(' ').some((part: string) => contactFullName.includes(part));
        
        console.log(`🔍 Checking "${contactFullName}" against "${searchName}": ${matches}`);
        return matches;
      });
      
      if (!matchingContact) {
        console.log('❌ No matching contact found');
        return {
          message: `I couldn't find a contact named "${contactName}" in your database. Please check the spelling or create the contact first.`,
          conversationContext: {
            phase: 'error',
            action: 'update_contact',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching contact:', matchingContact);
      
      // Ask for confirmation before updating
      const confirmationMessage = `Please confirm the contact update:\n\n**Contact:** ${matchingContact.firstName} ${matchingContact.lastName}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      return {
        message: confirmationMessage,
        action: "confirm_update",
        contactId: matchingContact._id,
        field: field,
        value: value,
        contactName: `${matchingContact.firstName} ${matchingContact.lastName}`,
        conversationContext: {
          phase: 'confirmation',
          action: 'update_contact',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('Contact update failed:', error);
      return {
        message: "I encountered an error while processing the contact update. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'update_contact',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleContactUpdateConfirmation(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling contact update confirmation with intent:', intent);

    // Get the confirmation data from the last message's conversation context
    const currentState = conversationManager.getState();
    const lastMessage = currentState.memory.sessionHistory[currentState.memory.sessionHistory.length - 1];
    
    console.log('🔍 Confirmation data debug:', {
      lastMessageExists: !!lastMessage,
      lastMessageContext: lastMessage?.conversationContext,
      sessionHistoryLength: currentState.memory.sessionHistory.length
    });
    
    const contactId = lastMessage?.conversationContext?.contactId;
    const field = lastMessage?.conversationContext?.field;
    const value = lastMessage?.conversationContext?.value;
    const contactName = lastMessage?.conversationContext?.contactName;

    console.log('📝 Extracted confirmation data:', { contactId, field, value, contactName });

    if (!contactId || !field || !value) {
      console.log('❌ Missing required data for confirmation');
      return {
        message: "I couldn't process your confirmation. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'update_contact_confirmation',
          referringTo: 'new_request'
        }
      };
    }

    try {
      console.log('🚀 Starting database update...');
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      console.log('📊 Calling Convex mutation with:', {
        contactId,
        updates: { [field]: value }
      });
      
      // Update the contact in the database
      await convex.mutation(api.crm.updateContact, {
        contactId: contactId as any, // Cast to Convex ID type
        updates: { [field]: value }
      });

      console.log('✅ Contact updated successfully:', { contactId, field, value });

      return {
        message: `Great! I've updated the contact "${contactName}" to have "${field}" set to "${value}".`,
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'update_contact',
          referringTo: 'new_request'
        }
      };

    } catch (error) {
      console.error('❌ Contact update confirmation failed:', error);
      return {
        message: "I encountered an error while confirming the contact update. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'update_contact_confirmation',
          referringTo: 'new_request'
        }
      };
    }
  }
}

// General Conversation Handler
export class GeneralConversationHandler implements IntentHandler {
  canHandle(intent: Intent): boolean {
    return intent.action === 'general_conversation';
  }

  async handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('💬 Handling general conversation intent');
    
    const { handleGeneralConversation } = await import('@/lib/chatHandlers');
    
    // Call existing general conversation logic
    const result = await handleGeneralConversation(
      intent.context.userGoal || '',
      context.messages || [],
      context,
      context.userId
    );
    
    return {
      message: result.message || "I'm here to help! What would you like to do?",
      suggestions: conversationManager.getSuggestions(),
      conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: 'general_conversation',
        referringTo: intent.context.referringTo
      }
    };
  }
}

// Create and configure the router
export const intentRouter = new IntentRouter();

// Register handlers
intentRouter.registerHandler(new ChartIntentHandler());
intentRouter.registerHandler(new DataIntentHandler());
intentRouter.registerHandler(new AnalyzeIntentHandler());
intentRouter.registerHandler(new CrudIntentHandler());
intentRouter.registerHandler(new GeneralConversationHandler()); 