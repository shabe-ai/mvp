import { Intent } from './intentClassifier';
import { ConversationManager } from './conversationManager';
import { ConversationResponse } from '@/types/chat';
import { userDataEnhancer } from './userDataEnhancer';
import { ragMonitor } from './ragMonitor';

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
    
    const startTime = Date.now();
    
    // Simplified confirmation logic - let the individual handlers deal with confirmations
    // This removes the complex override logic that was causing inconsistencies
    
    // If intent needs clarification, return clarification response
    if (intent.metadata.needsClarification) {
      const response = {
        message: intent.metadata.clarificationQuestion || "Could you please clarify what you'd like me to help you with?",
        needsClarification: true,
              conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: 'clarification_requested',
        referringTo: intent.context.referringTo
      }
      };
      
      // Track clarification interaction
      await ragMonitor.trackInteraction(
        intent.originalMessage,
        intent.action,
        intent.confidence,
        false, // Not successful (needs clarification)
        1, // Clarification needed
        Date.now() - startTime
      );
      
      return response;
    }

    // Find appropriate handler
    const handler = this.handlers.find(h => h.canHandle(intent));
    
    if (handler) {
      console.log('🛣️ Found handler for intent:', intent.action);
      const response = await handler.handle(intent, conversationManager, context);
      
      // Log successful interaction for RAG learning
      if (response && !response.error && !response.needsClarification) {
        await userDataEnhancer.logSuccessfulInteraction(
          intent.originalMessage,
          intent.action,
          intent.entities,
          intent.context.referringTo
        );
      }
      
      // Track interaction for monitoring
      await ragMonitor.trackInteraction(
        intent.originalMessage,
        intent.action,
        intent.confidence,
        !response.error && !response.needsClarification, // Success if no error and no clarification needed
        response.needsClarification ? 1 : 0, // Clarifications needed
        Date.now() - startTime
      );
      
      return response;
    }

    // Fallback to general conversation
    console.log('🛣️ No specific handler found, falling back to general conversation');
    const fallbackResponse = {
      message: "I understand you want to work with your data, but I need a bit more information. Could you please be more specific about what you'd like to do?",
      needsClarification: true,
      conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: 'general_fallback',
        referringTo: intent.context.referringTo
      }
    };
    
    // Track fallback interaction
    await ragMonitor.trackInteraction(
      intent.originalMessage,
      intent.action,
      intent.confidence,
      false, // Not successful (fallback)
      1, // Clarification needed
      Date.now() - startTime
    );
    
    return fallbackResponse;
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
    
    // Check if this is a count query (how many X do I have)
    const isCountQuery = this.isCountQuery(intent);
    
    if (isCountQuery) {
      return await this.handleCountQuery(intent, conversationManager, context);
    }

    // Check if this is a name list query (what are their names)
    const isNameListQuery = this.isNameListQuery(intent);
    
    if (isNameListQuery) {
      return await this.handleNameListQuery(intent, conversationManager, context);
    }
    
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

  private isCountQuery(intent: Intent): boolean {
    const message = intent.originalMessage.toLowerCase();
    return message.includes('how many') || message.includes('count');
  }

  private isNameListQuery(intent: Intent): boolean {
    const message = intent.originalMessage.toLowerCase();
    return message.includes('what are their names') || 
           message.includes('what are the names') || 
           message.includes('list their names') ||
           message.includes('who are my contacts') ||
           message.includes('list contact names');
  }

  private async handleCountQuery(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('🔢 Handling count query for:', intent.entities.dataType);
      console.log('🔢 User ID:', context.userId);
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🔢 Team ID:', teamId);
      
      let count = 0;
      let dataType = intent.entities.dataType || 'contacts';
      
      // Get count based on data type
      switch (dataType) {
        case 'contacts':
          // Force fresh database query with no caching
          console.log('🔢 Executing fresh database query for contacts...');
          const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
          count = contacts.length;
          console.log('🔢 Contact count debug:', { 
            teamId, 
            count, 
            contactsLength: contacts.length,
            contactNames: contacts.map(c => c.firstName + ' ' + c.lastName)
          });
          console.log('🔢 Full contact data:', contacts.map(c => ({
            id: c._id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            company: c.company
          })));
          
          // Double-check the count
          if (count !== contacts.length) {
            console.log('🔢 WARNING: Count mismatch detected!');
            count = contacts.length;
          }
          break;
        case 'deals':
          const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
          count = deals.length;
          break;
        case 'accounts':
          const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
          count = accounts.length;
          break;
        case 'activities':
          const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
          count = activities.length;
          break;
        default:
          const defaultContacts = await convex.query(api.crm.getContactsByTeam, { teamId });
          count = defaultContacts.length;
          dataType = 'contacts';
      }
      
      // Generate appropriate response
      const message = `You have ${count} ${dataType}${count !== 1 ? '' : ''}.`;
      
      console.log('🔢 Final response:', { message, count, dataType });
      
      return {
        message,
        data: {
          records: [],
          type: dataType,
          count: count,
          displayFormat: 'count'
        },
        suggestions: [
          `Show me my ${dataType}`,
          `Create a chart of my ${dataType}`,
          `View my ${dataType} details`
        ],
        conversationContext: {
          phase: 'exploration',
          action: 'view_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Count query failed:', error);
      return {
        message: `I'm having trouble counting your ${intent.entities.dataType || 'data'}. Let me show you the data instead.`,
        suggestions: [
          "Show me my contacts",
          "View my deals",
          "Check my accounts"
        ],
        conversationContext: {
          phase: 'error',
          action: 'view_data',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleNameListQuery(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    try {
      console.log('📝 Handling name list query for:', intent.entities.dataType);
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Get user's team
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      let dataType = intent.entities.dataType || 'contacts';
      let records: any[] = [];
      
      // Get records based on data type
      switch (dataType) {
        case 'contacts':
          records = await convex.query(api.crm.getContactsByTeam, { teamId });
          break;
        case 'deals':
          records = await convex.query(api.crm.getDealsByTeam, { teamId });
          break;
        case 'accounts':
          records = await convex.query(api.crm.getAccountsByTeam, { teamId });
          break;
        case 'activities':
          records = await convex.query(api.crm.getActivitiesByTeam, { teamId });
          break;
        default:
          records = await convex.query(api.crm.getContactsByTeam, { teamId });
          dataType = 'contacts';
      }
      
      // Generate names list
      let namesList: string[] = [];
      let message = '';
      
      if (dataType === 'contacts') {
        namesList = records.map(contact => `${contact.firstName} ${contact.lastName}`.trim());
        message = `Your contacts are: ${namesList.join(', ')}.`;
      } else if (dataType === 'deals') {
        namesList = records.map(deal => deal.name || deal.title || 'Unnamed Deal');
        message = `Your deals are: ${namesList.join(', ')}.`;
      } else if (dataType === 'accounts') {
        namesList = records.map(account => account.name || 'Unnamed Account');
        message = `Your accounts are: ${namesList.join(', ')}.`;
      } else {
        namesList = records.map(activity => activity.subject || activity.title || 'Unnamed Activity');
        message = `Your activities are: ${namesList.join(', ')}.`;
      }
      
      return {
        message,
        data: {
          records: records,
          type: dataType,
          count: records.length,
          displayFormat: 'list'
        },
        suggestions: [
          `Show me my ${dataType}`,
          `Create a chart of my ${dataType}`,
          `View my ${dataType} details`
        ],
        conversationContext: {
          phase: 'exploration',
          action: 'view_data',
          referringTo: 'new_request'
        }
      };
      
    } catch (error) {
      console.error('❌ Name list query failed:', error);
      return {
        message: `I'm having trouble listing your ${intent.entities.dataType || 'contacts'}. Let me show you the data instead.`,
        suggestions: [
          "Show me my contacts",
          "View my deals",
          "Check my accounts"
        ],
        conversationContext: {
          phase: 'error',
          action: 'view_data',
          referringTo: 'new_request'
        }
      };
    }
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
    return [
      'create_contact', 'update_contact', 'delete_contact',
      'create_account', 'update_account', 'delete_account',
      'create_deal', 'update_deal', 'delete_deal',
      'create_activity', 'update_activity', 'delete_activity',
      'send_email'
    ].includes(intent.action);
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
    
    // Enhanced confirmation detection
    const isConfirmationResponse = (
      lastMessage?.conversationContext?.action === 'update_contact' && 
      lastMessage?.conversationContext?.phase === 'confirmation' &&
      (intent.originalMessage.toLowerCase().includes('yes') || 
       intent.originalMessage.toLowerCase().includes('confirm') ||
       intent.originalMessage.toLowerCase().includes('correct') ||
       intent.originalMessage.toLowerCase().includes('ok') ||
       intent.originalMessage.toLowerCase().includes('sure'))
    );
    
    // Fallback: Check if this looks like a confirmation response even if intent classification failed
    const isLikelyConfirmation = (
      lastMessage?.conversationContext?.action === 'update_contact' && 
      lastMessage?.conversationContext?.phase === 'confirmation' &&
      intent.originalMessage.toLowerCase().trim().length <= 10 && // Short response
      (intent.originalMessage.toLowerCase().includes('yes') || 
       intent.originalMessage.toLowerCase().includes('y') ||
       intent.originalMessage.toLowerCase().includes('ok') ||
       intent.originalMessage.toLowerCase().includes('sure'))
    );
    
    console.log('🔍 Enhanced confirmation detection:', {
      isConfirmationResponse,
      isLikelyConfirmation,
      lastMessageAction: lastMessage?.conversationContext?.action,
      lastMessagePhase: lastMessage?.conversationContext?.phase,
      userResponse: intent.originalMessage.toLowerCase(),
      responseLength: intent.originalMessage.length
    });
    
    // If the last message was asking for confirmation and user said "yes"
    if (isConfirmationResponse || isLikelyConfirmation) {
      console.log('✅ Confirmation detected! Calling handleContactUpdateConfirmation');
      return await this.handleContactUpdateConfirmation(intent, conversationManager, context);
    }
    
    console.log('❌ No confirmation detected, proceeding with normal intent handling');
    
    // Import the appropriate handler based on intent
    let handlerFunction: any;
    
    switch (intent.action) {
      case 'create_contact':
        return await this.handleContactCreate(intent, conversationManager, context);
        
      case 'update_contact':
        return await this.handleContactUpdate(intent, conversationManager, context);
        
      case 'delete_contact':
        return await this.handleContactDelete(intent, conversationManager, context);
        
      case 'create_account':
        return await this.handleAccountCreate(intent, conversationManager, context);
        
      case 'update_account':
        return await this.handleAccountUpdate(intent, conversationManager, context);
        
      case 'delete_account':
        return await this.handleAccountDelete(intent, conversationManager, context);
        
      case 'create_deal':
        return await this.handleDealCreate(intent, conversationManager, context);
        
      case 'update_deal':
        return await this.handleDealUpdate(intent, conversationManager, context);
        
      case 'delete_deal':
        return await this.handleDealDelete(intent, conversationManager, context);
        
      case 'create_activity':
        return await this.handleActivityCreate(intent, conversationManager, context);
        
      case 'update_activity':
        return await this.handleActivityUpdate(intent, conversationManager, context);
        
      case 'delete_activity':
        return await this.handleActivityDelete(intent, conversationManager, context);
        
      case 'send_email':
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

  private async handleContactCreate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based contact creation with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const contactName = intent.entities.contactName;
    const email = intent.entities.email;
    const company = intent.entities.company;
    
    console.log('📝 LLM-extracted data:', { contactName, email, company });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!contactName || !email) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ contactName:', contactName);
      console.log('❌ email:', email);
      return {
        message: "I couldn't understand the contact creation request. Please specify the contact's name and email address.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'create_contact',
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
        
        // More precise matching logic
        const searchWords = searchName.split(' ').filter(word => word.length > 0);
        const contactWords = contactFullName.split(' ').filter(word => word.length > 0);
        
        // Check for exact full name match first
        if (contactFullName === searchName) {
          console.log(`🔍 Exact match: "${contactFullName}" === "${searchName}"`);
          return true;
        }
        
        // Check if all search words are found in the contact name
        const allSearchWordsFound = searchWords.every(searchWord => 
          contactWords.some(contactWord => contactWord.includes(searchWord) || searchWord.includes(contactWord))
        );
        
        // Check if all contact words are found in the search name
        const allContactWordsFound = contactWords.every(contactWord => 
          searchWords.some(searchWord => contactWord.includes(searchWord) || searchWord.includes(contactWord))
        );
        
        const matches = allSearchWordsFound || allContactWordsFound;
        
        console.log(`🔍 Checking "${contactFullName}" against "${searchName}": ${matches}`);
        console.log(`🔍 Search words: [${searchWords.join(', ')}]`);
        console.log(`🔍 Contact words: [${contactWords.join(', ')}]`);
        console.log(`🔍 All search words found: ${allSearchWordsFound}`);
        console.log(`🔍 All contact words found: ${allContactWordsFound}`);
        
        return matches;
      });
      
      if (matchingContact) {
        console.log('❌ Contact already exists');
        return {
          message: `A contact named "${contactName}" already exists in your database. Please update it instead.`,
          conversationContext: {
            phase: 'error',
            action: 'create_contact',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Contact does not exist, proceeding with creation');
      
      // Ask for confirmation before creating
      const confirmationMessage = `Please confirm the contact creation:\n\n**Contact:** ${contactName}\n**Email:** ${email}\n**Company:** ${company || 'N/A'}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_create",
        contactId: null, // Will be set after creation
        field: null,
        value: null,
        contactName: contactName,
        conversationContext: {
          phase: 'confirmation',
          action: 'create_contact',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          contactName: contactName,
          email: email,
          company: company || undefined
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Contact creation failed:', error);
      return {
        message: "I encountered an error while processing the contact creation. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'create_contact',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleContactUpdate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based contact update with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const contactName = intent.entities.contactName;
    const field = intent.entities.field;
    const value = intent.entities.value;
    
    console.log('📝 LLM-extracted data:', { contactName, field, value });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!contactName || !field || !value) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ contactName:', contactName);
      console.log('❌ field:', field);
      console.log('❌ value:', value);
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
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_update",
        contactId: matchingContact._id,
        field: field,
        value: value,
        contactName: `${matchingContact.firstName} ${matchingContact.lastName}`,
        conversationContext: {
          phase: 'confirmation',
          action: 'update_contact',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          contactId: matchingContact._id,
          field: field,
          value: value,
          contactName: `${matchingContact.firstName} ${matchingContact.lastName}`
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
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

  private async handleContactDelete(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based contact deletion with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Check if this is a number selection response (e.g., "delete 1", "1", "number 2")
    const message = intent.originalMessage.toLowerCase();
    const numberMatch = message.match(/(?:delete\s+)?(?:number\s+)?(\d+)/);
    
    if (numberMatch) {
      console.log('🔢 Number selection detected:', numberMatch[1]);
      
      // Get the conversation context to see if we have matching contacts
      const conversationState = conversationManager.getState();
      const lastMessage = conversationState.memory.sessionHistory[conversationState.memory.sessionHistory.length - 1];
      
      if (lastMessage?.conversationContext?.matchingContacts) {
        const matchingContacts = lastMessage.conversationContext.matchingContacts;
        const selectedIndex = parseInt(numberMatch[1]) - 1; // Convert to 0-based index
        
        console.log('🔍 Selected index:', selectedIndex, 'from', matchingContacts.length, 'contacts');
        
        if (selectedIndex >= 0 && selectedIndex < matchingContacts.length) {
          const selectedContact = matchingContacts[selectedIndex];
          console.log('✅ Selected contact:', selectedContact);
          
          // Ask for confirmation before deleting
          const confirmationMessage = `Please confirm the contact deletion:\n\n**Contact:** ${selectedContact.name}\n**Email:** ${selectedContact.email || 'N/A'}\n**Company:** ${selectedContact.company || 'N/A'}\n\nThis action cannot be undone. Are you sure you want to delete this contact? Please respond with "yes" to confirm or "no" to cancel.`;
          
          return {
            message: confirmationMessage,
            action: "confirm_delete",
            contactId: selectedContact.id,
            contactName: selectedContact.name,
            conversationContext: {
              phase: 'confirmation',
              action: 'delete_contact',
              referringTo: 'new_request',
              contactId: selectedContact.id,
              contactName: selectedContact.name
            }
          };
        } else {
          return {
            message: `Invalid selection. Please choose a number between 1 and ${matchingContacts.length}.`,
            needsClarification: true,
            conversationContext: {
              phase: 'clarification',
              action: 'delete_contact',
              referringTo: 'new_request',
              matchingContacts: matchingContacts
            }
          };
        }
      }
    }
    
    // Use LLM-extracted entities instead of regex
    const contactName = intent.entities.contactName;
    
    console.log('📝 LLM-extracted data:', { contactName });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!contactName) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ contactName:', contactName);
      return {
        message: "I couldn't understand the contact deletion request. Please specify the contact name.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'delete_contact',
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
      
      // Find ALL matching contacts (not just the first one)
      const matchingContacts = contacts.filter(contact => {
        const contactFullName = contact.firstName && contact.lastName 
          ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
          : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
        const searchName = contactName.toLowerCase();
        
        // More precise matching logic
        const searchWords = searchName.split(' ').filter(word => word.length > 0);
        const contactWords = contactFullName.split(' ').filter(word => word.length > 0);
        
        // Check for exact full name match first
        if (contactFullName === searchName) {
          console.log(`🔍 Exact match: "${contactFullName}" === "${searchName}"`);
          return true;
        }
        
        // Check if all search words are found in the contact name
        const allSearchWordsFound = searchWords.every(searchWord => 
          contactWords.some(contactWord => contactWord.includes(searchWord) || searchWord.includes(contactWord))
        );
        
        // Check if all contact words are found in the search name
        const allContactWordsFound = contactWords.every(contactWord => 
          searchWords.some(searchWord => contactWord.includes(searchWord) || searchWord.includes(contactWord))
        );
        
        const matches = allSearchWordsFound || allContactWordsFound;
        
        console.log(`🔍 Checking "${contactFullName}" against "${searchName}": ${matches}`);
        console.log(`🔍 Search words: [${searchWords.join(', ')}]`);
        console.log(`🔍 Contact words: [${contactWords.join(', ')}]`);
        console.log(`🔍 All search words found: ${allSearchWordsFound}`);
        console.log(`🔍 All contact words found: ${allContactWordsFound}`);
        
        return matches;
      });
      
      console.log('🔍 Found matching contacts:', matchingContacts.length);
      
      if (matchingContacts.length === 0) {
        console.log('❌ No matching contact found');
        return {
          message: `I couldn't find a contact named "${contactName}" in your database. Please check the spelling.`,
          conversationContext: {
            phase: 'error',
            action: 'delete_contact',
            referringTo: 'new_request'
          }
        };
      }
      
      // If multiple contacts found, ask user to specify which one
      if (matchingContacts.length > 1) {
        console.log('⚠️ Multiple matching contacts found, asking for clarification');
        
        const contactOptions = matchingContacts.map((contact, index) => {
          const fullName = `${contact.firstName} ${contact.lastName}`;
          const email = contact.email || 'No email';
          const company = contact.company || 'No company';
          return `${index + 1}. ${fullName} (${email}) at ${company}`;
        }).join('\n');
        
        const clarificationMessage = `I found ${matchingContacts.length} contacts with the name "${contactName}":\n\n${contactOptions}\n\nPlease specify which one you want to delete by saying the number (1, 2, 3, etc.) or provide more details like their email or company.`;
        
        return {
          message: clarificationMessage,
          needsClarification: true,
          data: {
            records: matchingContacts.map((contact: any) => ({
              id: contact._id,
              _id: contact._id,
              created: new Date(contact._creationTime).toLocaleDateString(),
              name: `${contact.firstName} ${contact.lastName}`,
              email: contact.email || '',
              phone: contact.phone || '',
              company: contact.company || '',
              title: contact.title || '',
              status: contact.leadStatus || '',
              type: contact.contactType || '',
              source: contact.source || ''
            })),
            type: 'contacts',
            count: matchingContacts.length,
            displayFormat: 'table'
          },
          conversationContext: {
            phase: 'clarification',
            action: 'delete_contact',
            referringTo: 'new_request',
            matchingContacts: matchingContacts.map(c => ({
              id: c._id,
              name: `${c.firstName} ${c.lastName}`,
              email: c.email,
              company: c.company
            }))
          }
        };
      }
      
      // Single contact found - proceed with deletion confirmation
      const matchingContact = matchingContacts[0];
      console.log('✅ Found single matching contact:', matchingContact);
      
      // Ask for confirmation before deleting
      const confirmationMessage = `Please confirm the contact deletion:\n\n**Contact:** ${matchingContact.firstName} ${matchingContact.lastName}\n**Email:** ${matchingContact.email || 'N/A'}\n**Company:** ${matchingContact.company || 'N/A'}\n\nThis action cannot be undone. Are you sure you want to delete this contact? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_delete",
        contactId: matchingContact._id,
        contactName: `${matchingContact.firstName} ${matchingContact.lastName}`,
        conversationContext: {
          phase: 'confirmation',
          action: 'delete_contact',
          referringTo: 'new_request',
          contactId: matchingContact._id,
          contactName: `${matchingContact.firstName} ${matchingContact.lastName}`
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Contact deletion failed:', error);
      return {
        message: "I encountered an error while processing the contact deletion. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'delete_contact',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleAccountCreate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based account creation with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const accountName = intent.entities.accountName;
    const industry = intent.entities.industry;
    const website = intent.entities.website;
    
    console.log('📝 LLM-extracted data:', { accountName, industry, website });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!accountName) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ accountName:', accountName);
      return {
        message: "I couldn't understand the account creation request. Please specify the account name.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'create_account',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the account in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up accounts for team...');
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      console.log('🏦 Accounts found:', accounts.length);
      console.log('📋 Account names:', accounts.map(a => a.name));
      
      const matchingAccount = accounts.find(account => account.name.toLowerCase() === accountName.toLowerCase());
      
      if (matchingAccount) {
        console.log('❌ Account already exists');
        return {
          message: `An account named "${accountName}" already exists in your database. Please update it instead.`,
          conversationContext: {
            phase: 'error',
            action: 'create_account',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Account does not exist, proceeding with creation');
      
      // Ask for confirmation before creating
      const confirmationMessage = `Please confirm the account creation:\n\n**Account:** ${accountName}\n**Industry:** ${industry || 'N/A'}\n**Website:** ${website || 'N/A'}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_create",
        accountId: null, // Will be set after creation
        field: null,
        value: null,
        accountName: accountName,
        conversationContext: {
          phase: 'confirmation',
          action: 'create_account',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          accountName: accountName,
          industry: industry || undefined,
          website: website || undefined
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Account creation failed:', error);
      return {
        message: "I encountered an error while processing the account creation. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'create_account',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleAccountUpdate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based account update with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const accountName = intent.entities.accountName;
    const field = intent.entities.field;
    const value = intent.entities.value;
    
    console.log('📝 LLM-extracted data:', { accountName, field, value });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!accountName || !field || !value) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ accountName:', accountName);
      console.log('❌ field:', field);
      console.log('❌ value:', value);
      return {
        message: "I couldn't understand the update request. Please specify the account name and what field to update. For example: 'update acme's industry to technology'",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'update_account',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the account in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up accounts for team...');
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      console.log('🏦 Accounts found:', accounts.length);
      console.log('📋 Account names:', accounts.map(a => a.name));
      
      const matchingAccount = accounts.find(account => account.name.toLowerCase() === accountName.toLowerCase());
      
      if (!matchingAccount) {
        console.log('❌ No matching account found');
        return {
          message: `I couldn't find an account named "${accountName}" in your database. Please check the spelling or create the account first.`,
          conversationContext: {
            phase: 'error',
            action: 'update_account',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching account:', matchingAccount);
      
      // Ask for confirmation before updating
      const confirmationMessage = `Please confirm the account update:\n\n**Account:** ${matchingAccount.name}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_update",
        accountId: matchingAccount._id,
        field: field,
        value: value,
        accountName: matchingAccount.name,
        conversationContext: {
          phase: 'confirmation',
          action: 'update_account',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          accountId: matchingAccount._id,
          field: field,
          value: value,
          accountName: matchingAccount.name
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Account update failed:', error);
      return {
        message: "I encountered an error while processing the account update. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'update_account',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleAccountDelete(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based account deletion with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entity for account name
    const accountName = intent.entities.accountName;
    
    console.log('📝 LLM-extracted data:', { accountName });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!accountName) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ accountName:', accountName);
      return {
        message: "I couldn't understand the delete request. Please specify the account name to delete.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'delete_account',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the account in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up accounts for team...');
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      console.log('🏦 Accounts found:', accounts.length);
      console.log('📋 Account names:', accounts.map(a => a.name));
      
      const matchingAccount = accounts.find(account => account.name.toLowerCase() === accountName.toLowerCase());
      
      if (!matchingAccount) {
        console.log('❌ No matching account found');
        return {
          message: `I couldn't find an account named "${accountName}" in your database to delete.`,
          conversationContext: {
            phase: 'error',
            action: 'delete_account',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching account for deletion:', matchingAccount);
      
      // Ask for confirmation before deleting
      const confirmationMessage = `Please confirm the account deletion:\n\n**Account:** ${matchingAccount.name}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_delete",
        accountId: matchingAccount._id,
        accountName: matchingAccount.name,
        conversationContext: {
          phase: 'confirmation',
          action: 'delete_account',
          referringTo: 'new_request',
          accountId: matchingAccount._id,
          accountName: matchingAccount.name
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Account deletion failed:', error);
      return {
        message: "I encountered an error while processing the account deletion. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'delete_account',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleDealCreate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based deal creation with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const dealName = intent.entities.dealName;
    const amount = intent.entities.amount;
    const stage = intent.entities.stage;
    const closeDate = intent.entities.closeDate;
    const account = intent.entities.account;
    
    console.log('📝 LLM-extracted data:', { dealName, amount, stage, closeDate, account });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!dealName || !amount || !stage || !closeDate || !account) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ dealName:', dealName);
      console.log('❌ amount:', amount);
      console.log('❌ stage:', stage);
      console.log('❌ closeDate:', closeDate);
      console.log('❌ account:', account);
      return {
        message: "I couldn't understand the deal creation request. Please specify the deal name, amount, stage, close date, and account.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'create_deal',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the account in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up accounts for team...');
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      console.log('🏦 Accounts found:', accounts.length);
      console.log('📋 Account names:', accounts.map(a => a.name));
      
      const matchingAccount = accounts.find(acc => acc.name.toLowerCase() === account.toLowerCase());
      
      if (!matchingAccount) {
        console.log('❌ No matching account found for deal');
        return {
          message: `I couldn't find an account named "${account}" in your database. Please check the spelling or create the account first.`,
          conversationContext: {
            phase: 'error',
            action: 'create_deal',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching account for deal:', matchingAccount);
      
      // Ask for confirmation before creating
      const confirmationMessage = `Please confirm the deal creation:\n\n**Deal:** ${dealName}\n**Amount:** $${amount}\n**Stage:** ${stage}\n**Close Date:** ${closeDate}\n**Account:** ${matchingAccount.name}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_create",
        dealId: null, // Will be set after creation
        field: null,
        value: null,
        dealName: dealName,
        conversationContext: {
          phase: 'confirmation',
          action: 'create_deal',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          dealName: dealName,
          amount: amount,
          stage: stage,
          closeDate: closeDate,
          account: matchingAccount._id,
          accountName: matchingAccount.name
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Deal creation failed:', error);
      return {
        message: "I encountered an error while processing the deal creation. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'create_deal',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleDealUpdate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based deal update with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const dealName = intent.entities.dealName;
    const field = intent.entities.field;
    const value = intent.entities.value;
    
    console.log('�� LLM-extracted data:', { dealName, field, value });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!dealName || !field || !value) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ dealName:', dealName);
      console.log('❌ field:', field);
      console.log('❌ value:', value);
      return {
        message: "I couldn't understand the update request. Please specify the deal name and what field to update. For example: 'update deal123's amount to 100000'",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'update_deal',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the deal in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up deals for team...');
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      console.log('🔔 Deals found:', deals.length);
      console.log('📋 Deal names:', deals.map(d => d.name));
      
      const matchingDeal = deals.find(deal => deal.name.toLowerCase() === dealName.toLowerCase());
      
      if (!matchingDeal) {
        console.log('❌ No matching deal found');
        return {
          message: `I couldn't find a deal named "${dealName}" in your database. Please check the spelling or create the deal first.`,
          conversationContext: {
            phase: 'error',
            action: 'update_deal',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching deal:', matchingDeal);
      
      // Ask for confirmation before updating
      const confirmationMessage = `Please confirm the deal update:\n\n**Deal:** ${matchingDeal.name}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_update",
        dealId: matchingDeal._id,
        field: field,
        value: value,
        dealName: matchingDeal.name,
        conversationContext: {
          phase: 'confirmation',
          action: 'update_deal',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          dealId: matchingDeal._id,
          field: field,
          value: value,
          dealName: matchingDeal.name
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Deal update failed:', error);
      return {
        message: "I encountered an error while processing the deal update. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'update_deal',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleDealDelete(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based deal deletion with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entity for deal name
    const dealName = intent.entities.dealName;
    
    console.log('📝 LLM-extracted data:', { dealName });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!dealName) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ dealName:', dealName);
      return {
        message: "I couldn't understand the delete request. Please specify the deal name to delete.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'delete_deal',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the deal in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up deals for team...');
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      console.log('🔔 Deals found:', deals.length);
      console.log('📋 Deal names:', deals.map(d => d.name));
      
      const matchingDeal = deals.find(deal => deal.name.toLowerCase() === dealName.toLowerCase());
      
      if (!matchingDeal) {
        console.log('❌ No matching deal found');
        return {
          message: `I couldn't find a deal named "${dealName}" in your database to delete.`,
          conversationContext: {
            phase: 'error',
            action: 'delete_deal',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching deal for deletion:', matchingDeal);
      
      // Ask for confirmation before deleting
      const confirmationMessage = `Please confirm the deal deletion:\n\n**Deal:** ${matchingDeal.name}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_delete",
        dealId: matchingDeal._id,
        dealName: matchingDeal.name,
        conversationContext: {
          phase: 'confirmation',
          action: 'delete_deal',
          referringTo: 'new_request',
          dealId: matchingDeal._id,
          dealName: matchingDeal.name
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Deal deletion failed:', error);
      return {
        message: "I encountered an error while processing the deal deletion. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'delete_deal',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleActivityCreate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based activity creation with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const activityType = intent.entities.activityType;
    const subject = intent.entities.subject;
    const date = intent.entities.date;
    const account = intent.entities.account;
    const contact = intent.entities.contact;
    
    console.log('📝 LLM-extracted data:', { activityType, subject, date, account, contact });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!activityType || !subject || !date) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ activityType:', activityType);
      console.log('❌ subject:', subject);
      console.log('❌ date:', date);
      return {
        message: "I couldn't understand the activity creation request. Please specify the activity type, subject, and date.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'create_activity',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the account and contact in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up accounts for team...');
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      console.log('🏦 Accounts found:', accounts.length);
      console.log('📋 Account names:', accounts.map(a => a.name));
      
      const matchingAccount = account ? accounts.find(acc => acc.name.toLowerCase() === account.toLowerCase()) : null;
      
      let matchingContact = null;
      if (contact) {
        console.log('🔍 Looking up contacts for team...');
        const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
        console.log('👥 Contacts found:', contacts.length);
        console.log('📋 Contact names:', contacts.map(c => `${c.firstName} ${c.lastName}`));
        
        matchingContact = contacts.find(c => c.firstName?.toLowerCase() === contact.toLowerCase() || c.lastName?.toLowerCase() === contact.toLowerCase());
      }
      
      if (!matchingAccount && !matchingContact) {
        console.log('❌ No matching account or contact found for activity');
        return {
          message: `I couldn't find an account or contact named "${account || contact}" in your database. Please check the spelling or create them first.`,
          conversationContext: {
            phase: 'error',
            action: 'create_activity',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching account/contact for activity:', matchingAccount || matchingContact);
      
      // Ask for confirmation before creating
      const confirmationMessage = `Please confirm the activity creation:\n\n**Activity Type:** ${activityType}\n**Subject:** ${subject}\n**Date:** ${date}\n**Account:** ${matchingAccount?.name || matchingContact?.firstName + ' ' + matchingContact?.lastName}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_create",
        activityId: null, // Will be set after creation
        field: null,
        value: null,
        activityType: activityType,
        subject: subject,
        date: date,
        account: matchingAccount?._id || matchingContact?._id,
        conversationContext: {
          phase: 'confirmation',
          action: 'create_activity',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          activityType: activityType,
          subject: subject,
          date: date,
          account: matchingAccount?._id || matchingContact?._id,
          accountName: matchingAccount?.name || matchingContact?.firstName + ' ' + matchingContact?.lastName
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Activity creation failed:', error);
      return {
        message: "I encountered an error while processing the activity creation. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'create_activity',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleActivityUpdate(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based activity update with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entities instead of regex
    const activityType = intent.entities.activityType;
    const subject = intent.entities.subject;
    const date = intent.entities.date;
    const field = intent.entities.field;
    const value = intent.entities.value;
    
    console.log('�� LLM-extracted data:', { activityType, subject, date, field, value });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!activityType || !subject || !date || !field || !value) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ activityType:', activityType);
      console.log('❌ subject:', subject);
      console.log('❌ date:', date);
      console.log('❌ field:', field);
      console.log('❌ value:', value);
      return {
        message: "I couldn't understand the update request. Please specify the activity type, subject, date, and what field to update. For example: 'update deal123's amount to 100000'",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'update_activity',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the activity in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up activities for team...');
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
      console.log('🔔 Activities found:', activities.length);
      console.log('📋 Activity subjects:', activities.map(a => a.subject));
      
      const matchingActivity = activities.find(activity => activity.subject.toLowerCase() === subject.toLowerCase());
      
      if (!matchingActivity) {
        console.log('❌ No matching activity found');
        return {
          message: `I couldn't find an activity with subject "${subject}" in your database. Please check the spelling or create the activity first.`,
          conversationContext: {
            phase: 'error',
            action: 'update_activity',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching activity:', matchingActivity);
      
      // Ask for confirmation before updating
      const confirmationMessage = `Please confirm the activity update:\n\n**Activity Type:** ${matchingActivity.type}\n**Subject:** ${matchingActivity.subject}\n**Status:** ${matchingActivity.status}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_update",
        activityId: matchingActivity._id,
        field: field,
        value: value,
        activityType: matchingActivity.type,
        subject: matchingActivity.subject,
        status: matchingActivity.status,
        conversationContext: {
          phase: 'confirmation',
          action: 'update_activity',
          referringTo: 'new_request',
          // Include CRUD fields in conversationContext
          activityId: matchingActivity._id,
          field: field,
          value: value,
          activityType: matchingActivity.type,
          subject: matchingActivity.subject,
          status: matchingActivity.status
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Activity update failed:', error);
      return {
        message: "I encountered an error while processing the activity update. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'update_activity',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleActivityDelete(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling LLM-based activity deletion with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));
    
    // Use LLM-extracted entity for activity subject
    const subject = intent.entities.subject;
    
    console.log('📝 LLM-extracted data:', { subject });
    console.log('📝 Full entities object:', JSON.stringify(intent.entities, null, 2));
    
    if (!subject) {
      console.log('❌ Missing required data from LLM extraction');
      console.log('❌ subject:', subject);
      return {
        message: "I couldn't understand the delete request. Please specify the activity subject to delete.",
        needsClarification: true,
        conversationContext: {
          phase: 'clarification',
          action: 'delete_activity',
          referringTo: 'new_request'
        }
      };
    }
    
    try {
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      // Find the activity in the database
      console.log('🔍 Looking up teams for user...');
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      console.log('📋 Teams found:', teams.length);
      
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      console.log('🏢 Using team ID:', teamId);
      
      console.log('🔍 Looking up activities for team...');
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
      console.log('🔔 Activities found:', activities.length);
      console.log('📋 Activity subjects:', activities.map(a => a.subject));
      
      const matchingActivity = activities.find(activity => activity.subject.toLowerCase() === subject.toLowerCase());
      
      if (!matchingActivity) {
        console.log('❌ No matching activity found');
        return {
          message: `I couldn't find an activity with subject "${subject}" in your database to delete.`,
          conversationContext: {
            phase: 'error',
            action: 'delete_activity',
            referringTo: 'new_request'
          }
        };
      }
      
      console.log('✅ Found matching activity for deletion:', matchingActivity);
      
      // Ask for confirmation before deleting
      const confirmationMessage = `Please confirm the activity deletion:\n\n**Activity Type:** ${matchingActivity.type}\n**Subject:** ${matchingActivity.subject}\n**Status:** ${matchingActivity.status}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
      const confirmationResponse = {
        message: confirmationMessage,
        action: "confirm_delete",
        activityId: matchingActivity._id,
        activityType: matchingActivity.type,
        subject: matchingActivity.subject,
        status: matchingActivity.status,
        conversationContext: {
          phase: 'confirmation',
          action: 'delete_activity',
          referringTo: 'new_request',
          activityId: matchingActivity._id,
          activityType: matchingActivity.type,
          subject: matchingActivity.subject,
          status: matchingActivity.status
        }
      };
      
      console.log('📝 Confirmation response being sent:', JSON.stringify(confirmationResponse, null, 2));
      
      return confirmationResponse;
      
    } catch (error) {
      console.error('Activity deletion failed:', error);
      return {
        message: "I encountered an error while processing the activity deletion. Please try again.",
        conversationContext: {
          phase: 'error',
          action: 'delete_activity',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async handleContactUpdateConfirmation(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling contact update confirmation with intent:', intent);
    console.log('👤 Full intent object:', JSON.stringify(intent, null, 2));

    // Get the confirmation data from the last message's conversation context
    const currentState = conversationManager.getState();
    const lastMessage = currentState.memory.sessionHistory[currentState.memory.sessionHistory.length - 1];
    
    console.log('🔍 Confirmation data debug:', {
      lastMessageExists: !!lastMessage,
      lastMessageContext: lastMessage?.conversationContext,
      sessionHistoryLength: currentState.memory.sessionHistory.length,
      fullLastMessage: JSON.stringify(lastMessage, null, 2)
    });
    
    const contactId = lastMessage?.conversationContext?.contactId;
    const field = lastMessage?.conversationContext?.field;
    const value = lastMessage?.conversationContext?.value;
    const contactName = lastMessage?.conversationContext?.contactName;

    console.log('📝 Extracted confirmation data:', { contactId, field, value, contactName });

    if (!contactId || !field || !value) {
      console.log('❌ Missing required data for confirmation');
      console.log('❌ contactId:', contactId);
      console.log('❌ field:', field);
      console.log('❌ value:', value);
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
      console.log('🚀 User ID from context:', context.userId);
      
      // Import Convex for database operations
      const { convex } = await import('@/lib/convex');
      const { api } = await import('@/convex/_generated/api');
      
      console.log('📊 Calling Convex mutation with:', {
        contactId,
        updates: { [field]: value }
      });
      
      // Update the contact in the database
      const result = await convex.mutation(api.crm.updateContact, {
        contactId: contactId as any, // Cast to Convex ID type
        updates: { [field]: value }
      });

      console.log('✅ Contact update mutation result:', result);
      console.log('✅ Contact updated successfully:', { contactId, field, value });

      // Verify the update by querying the contact
      try {
        console.log('🔍 Verifying update by querying contact...');
        const updatedContact = await convex.query(api.crm.getContactById, { contactId: contactId as any });
        console.log('🔍 Updated contact data:', updatedContact);
      } catch (verifyError) {
        console.log('⚠️ Could not verify update:', verifyError);
      }

      return {
        message: `Great! I've updated the contact "${contactName}" to have "${field}" set to "${value}".`,
        action: "contact_updated", // Add this to trigger table refresh
        conversationContext: {
          phase: conversationManager.getState().currentContext.conversationPhase.current,
          action: 'update_contact',
          referringTo: 'new_request'
        }
      };

    } catch (error) {
      console.error('❌ Contact update confirmation failed:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        contactId,
        field,
        value
      });
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