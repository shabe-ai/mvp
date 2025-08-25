import { SimplifiedIntent } from './simplifiedIntentClassifier';
import { conversationalHandler } from './conversationalHandler';
import { logger } from './logger';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

interface IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean;
  handle(intent: SimplifiedIntent, context: any): Promise<any>;
}

interface IntentRouterContext {
  userId: string;
  conversationManager?: any;
  messages?: any[];
  userProfile?: any;
  companyData?: any;
  lastAction?: string;
}

class IntentRouter {
  private handlers: IntentHandler[] = [];

  registerHandler(handler: IntentHandler) {
    this.handlers.push(handler);
  }

  async routeIntent(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Routing intent', {
      action: intent.action,
      confidence: intent.confidence,
      userId: context.userId,
      originalMessage: intent.originalMessage,
      entities: intent.entities
    });

    // Find the appropriate handler
    const handler = this.handlers.find(h => h.canHandle(intent));
    
    if (handler) {
      logger.info('Found handler for intent', {
        action: intent.action,
        handlerType: handler.constructor.name,
        userId: context.userId
      });
      return await handler.handle(intent, context);
    }

    // Check if this is a follow-up question that should use conversation context
    if (intent.action === 'general_conversation' && context.conversationManager) {
      const conversationState = context.conversationManager.getState();
      const lastCompanyFilter = conversationState.currentContext.lastCompanyFilter;
      const lastDataType = conversationState.currentContext.lastDataType;
      
      if (lastCompanyFilter && lastDataType) {
        logger.info('Detected follow-up question, using conversation context', {
          lastCompanyFilter,
          lastDataType,
          originalMessage: intent.originalMessage,
          userId: context.userId
        });
        
        // Create a view_data intent for the follow-up question
        const followUpIntent = {
          action: 'view_data' as const,
          confidence: 0.8,
          originalMessage: intent.originalMessage,
          entities: {
            dataType: lastDataType,
            query: 'list',
            company: lastCompanyFilter
          },
          context: {
            referringTo: 'follow_up' as const,
            userGoal: intent.originalMessage
          },
          metadata: {
            isAmbiguous: false,
            needsClarification: false,
            clarificationQuestion: undefined
          }
        };
        
        // Route to data handler
        const dataHandler = this.handlers.find(h => h.canHandle(followUpIntent));
        if (dataHandler) {
          return await dataHandler.handle(followUpIntent, context);
        }
      }
    }

    logger.warn('No specific handler found, falling back to general conversation', {
      action: intent.action,
      userId: context.userId
    });

    // Fallback to general conversation
    return await conversationalHandler.handleConversation(
      intent.originalMessage || intent.context.userGoal || 'General conversation',
      context.conversationManager,
      context
    );
  }
}

// Chart Intent Handler
class ChartIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_chart' || 
           intent.action === 'modify_chart' || 
           intent.action === 'analyze_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling chart intent', {
      action: intent.action,
      userId: context.userId
    });

    if (intent.action === 'create_chart') {
      return await this.handleCreateChart(intent, context);
    } else if (intent.action === 'modify_chart') {
      return await this.handleModifyChart(intent, context);
    } else if (intent.action === 'analyze_data') {
      return await this.handleDataAnalysis(intent, context);
    }

    // Fallback
    return {
      type: 'text',
      content: 'I\'m not sure how to handle this chart request. Could you please be more specific?',
      hasData: false
    };
  }

  private async handleCreateChart(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    const { dataType, dimension } = intent.entities;
    
    logger.info('Creating chart', {
      dataType,
      dimension,
      userId: context.userId
    });

    if (!dataType) {
      return {
        type: 'text',
        content: 'I need to know what type of data you want to chart. Please specify the data type (e.g., contacts, deals, accounts).',
        hasData: false
      };
    }

    if (!dimension) {
      return {
        type: 'text',
        content: `I need to know what dimension to chart for ${dataType}. Please specify a dimension (e.g., stage, company, lead status).`,
        hasData: false
      };
    }

    try {
      // Get team ID first
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      
      if (!teams || teams.length === 0) {
      return {
          type: 'text',
          content: 'No team found for your account. Please contact your administrator.',
          hasData: false
        };
      }
      
      const teamId = teams[0]._id;
      
      // Fetch data based on dataType
      let data: any[] = [];
      if (dataType === 'deals') {
        data = await convex.query(api.crm.getDealsByTeam, { teamId });
      } else if (dataType === 'contacts') {
        data = await convex.query(api.crm.getContactsByTeam, { teamId });
      } else if (dataType === 'accounts') {
        data = await convex.query(api.crm.getAccountsByTeam, { teamId });
      } else if (dataType === 'activities') {
        data = await convex.query(api.crm.getActivitiesByTeam, { teamId });
      }

      logger.info('Data fetched for chart', {
        dataType,
        dataCount: data.length,
        rawData: data,
        userId: context.userId
      });

      if (data.length === 0) {
        return {
          type: 'text',
          content: `No ${dataType} found in your database. Please add some ${dataType} first.`,
          hasData: false
        };
      }

      // Determine chart type and aggregation method from intent
      const chartType = intent.entities?.chartType || 'bar';
      const aggregationField = intent.entities?.field;
      
      // Use sum aggregation if field is specified, otherwise use count
      let chartData;
      let yAxisDataKey;
      let aggregationMethod;
      
      if (aggregationField) {
        chartData = this.processDataForChartWithSum(data, dataType, dimension, aggregationField);
        yAxisDataKey = 'sum';
        aggregationMethod = `sum of ${aggregationField}`;
      } else {
        chartData = this.processDataForChart(data, dataType, dimension, true);
        yAxisDataKey = 'count';
        aggregationMethod = 'count';
      }
      
      logger.info('Chart data processed', {
        chartDataLength: chartData.length,
        chartData: chartData,
        chartType: chartType,
        aggregationMethod: aggregationMethod,
        userId: context.userId
      });

      return {
        type: 'text',
        content: `I've created a ${chartType} chart showing ${dataType} by ${dimension} (${aggregationMethod}). The chart will be displayed below.`,
        chartSpec: {
          chartType: chartType,
          data: chartData,
          dataType: dataType,
          dimension: dimension,
          title: `${dataType} by ${dimension} (${aggregationMethod})`,
          description: `Chart showing ${dataType} grouped by ${dimension} with ${aggregationMethod}`,
          chartConfig: {
            margin: { top: 20, right: 30, left: 20, bottom: 60 },
            height: 400,
            width: 600,
            xAxis: { dataKey: dimension },
            yAxis: { dataKey: yAxisDataKey }
          }
        },
        hasData: true
      };
    } catch (error) {
      logger.error('Error creating chart', error instanceof Error ? error : new Error(String(error)), {
        dataType,
        dimension,
        userId: context.userId
      });
    
    return {
        type: 'text',
        content: `Sorry, I encountered an error while creating the chart for ${dataType} by ${dimension}. Please try again.`,
        hasData: false
      };
    }
  }

  private async handleModifyChart(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    const { field, dimension, action } = intent.entities;
    
    logger.info('Handling chart modification request', {
      field,
      dimension,
      action,
      entities: intent.entities,
      userId: context.userId
    });

    // Handle column removal
    if (field === 'totals' || field === 'total') {
      // Get the current chart data and remove the 'total' column
      try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
        
        if (!teams || teams.length === 0) {
          return {
            type: 'text',
            content: 'No team found for your account. Please contact your administrator.',
            hasData: false
          };
        }
        
        const teamId = teams[0]._id;
        const data = await convex.query(api.crm.getDealsByTeam, { teamId });
        
        // Process data without total column
        const chartData = this.processDataForChart(data, 'deals', 'stage', false);
        
        logger.info('Chart modification completed', {
          originalDataLength: chartData.length,
          modifiedDataLength: chartData.length,
          userId: context.userId
        });
      
      return {
          type: 'text',
          content: 'I\'ve removed the totals column from the chart. The chart now shows only the count data.',
          chartSpec: {
            chartType: 'bar',
            data: chartData,
            dataType: 'deals',
            dimension: 'stage',
            title: 'deals by stage',
            description: 'Chart showing deals grouped by stage (counts only)',
            chartConfig: {
              margin: { top: 20, right: 30, left: 20, bottom: 60 },
              height: 400,
              width: 600,
              xAxis: { dataKey: 'stage' },
              yAxis: { dataKey: 'count' }
            }
          },
          hasData: true,
          modification: {
            type: 'remove_column',
            column: 'total'
          }
        };
    } catch (error) {
        logger.error('Error modifying chart', error instanceof Error ? error : new Error(String(error)), {
          field,
          userId: context.userId
        });
        
      return {
          type: 'text',
          content: 'Sorry, I encountered an error while modifying the chart. Please try again.',
          hasData: false
        };
      }
    }

    // Handle stacking
    if (intent.originalMessage.toLowerCase().includes('stack')) {
      try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
        
        if (!teams || teams.length === 0) {
          return {
            type: 'text',
            content: 'No team found for your account. Please contact your administrator.',
            hasData: false
          };
        }
        
        const teamId = teams[0]._id;
        const data = await convex.query(api.crm.getDealsByTeam, { teamId });
        
        // Process data for stacked chart (include total for stacking)
        const chartData = this.processDataForChart(data, 'deals', 'stage', true);
        
        logger.info('Chart stacking modification completed', {
          originalDataLength: chartData.length,
          userId: context.userId
        });
      
      return {
          type: 'text',
          content: 'I\'ve modified the chart to use stacked bars. The chart now shows stacked data.',
          chartSpec: {
            chartType: 'bar',
            data: chartData,
            dataType: 'deals',
            dimension: 'stage',
            title: 'deals by stage (stacked)',
            description: 'Chart showing deals grouped by stage with stacked bars',
            chartConfig: {
              margin: { top: 20, right: 30, left: 20, bottom: 60 },
              height: 400,
              width: 600,
              xAxis: { dataKey: 'stage' },
              yAxis: { dataKey: 'count' },
              stacked: true
            }
          },
          hasData: true,
          modification: {
            type: 'stack_chart'
          }
        };
    } catch (error) {
        logger.error('Error stacking chart', error instanceof Error ? error : new Error(String(error)), {
          userId: context.userId
        });
        
      return {
          type: 'text',
          content: 'Sorry, I encountered an error while stacking the chart. Please try again.',
          hasData: false
        };
      }
    }

    // Handle aggregation method changes
    if ((intent.entities?.query === 'sum' && intent.entities?.field) || 
        (intent.entities?.field && intent.originalMessage.toLowerCase().includes('instead of count'))) {
      try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
        
        if (!teams || teams.length === 0) {
          return {
            type: 'text',
            content: 'No team found for your account. Please contact your administrator.',
            hasData: false
          };
        }
        
        const teamId = teams[0]._id;
        const data = await convex.query(api.crm.getDealsByTeam, { teamId });
        
        // Process data with sum aggregation
        const sumField = intent.entities.field;
        const chartData = this.processDataForChartWithSum(data, 'deals', 'stage', sumField);
        
        logger.info('Chart aggregation modification completed', {
          originalDataLength: chartData.length,
          aggregationField: sumField,
          userId: context.userId
        });
        
        return {
          type: 'text',
          content: `I've changed the chart to show the sum of ${sumField} instead of count.`,
          chartSpec: {
            chartType: 'bar',
            data: chartData,
            dataType: 'deals',
            dimension: 'stage',
            title: `deals by stage (sum of ${sumField})`,
            description: `Chart showing deals grouped by stage with sum of ${sumField}`,
            chartConfig: {
              margin: { top: 20, right: 30, left: 20, bottom: 60 },
              height: 400,
              width: 600,
              xAxis: { dataKey: 'stage' },
              yAxis: { dataKey: 'sum' }
            }
          },
          hasData: true,
          modification: {
            type: 'change_aggregation',
            field: sumField,
            method: 'sum'
          }
        };
      } catch (error) {
        logger.error('Error changing chart aggregation', error instanceof Error ? error : new Error(String(error)), {
          userId: context.userId
        });
        
        return {
          type: 'text',
          content: 'Sorry, I encountered an error while changing the chart aggregation. Please try again.',
          hasData: false
        };
      }
    }

    // Handle chart type changes
    if (intent.entities?.chartType) {
      try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
        
        if (!teams || teams.length === 0) {
    return {
            type: 'text',
            content: 'No team found for your account. Please contact your administrator.',
            hasData: false
          };
        }
        
        const teamId = teams[0]._id;
        const data = await convex.query(api.crm.getDealsByTeam, { teamId });
        
        // Check if we should use sum aggregation (based on previous context or current data)
        // For now, we'll use sum of amount since that's what was previously set up
        const chartData = this.processDataForChartWithSum(data, 'deals', 'stage', 'amount');
        
        logger.info('Chart type modification completed', {
          originalDataLength: chartData.length,
          newChartType: intent.entities.chartType,
          aggregationMethod: 'sum',
          aggregationField: 'amount',
          userId: context.userId
        });
      
      return {
          type: 'text',
          content: `I've changed the chart to a ${intent.entities.chartType} chart showing the sum of amounts.`,
          chartSpec: {
            chartType: intent.entities.chartType,
            data: chartData,
            dataType: 'deals',
            dimension: 'stage',
            title: `deals by stage (${intent.entities.chartType} - sum of amounts)`,
            description: `Chart showing deals grouped by stage as ${intent.entities.chartType} with sum of amounts`,
            chartConfig: {
              margin: { top: 20, right: 30, left: 20, bottom: 60 },
              height: 400,
              width: 600,
              xAxis: { dataKey: 'stage' },
              yAxis: { dataKey: 'sum' }
            }
          },
          hasData: true,
          modification: {
            type: 'change_chart_type',
            chartType: intent.entities.chartType,
            aggregationMethod: 'sum',
            aggregationField: 'amount'
          }
        };
    } catch (error) {
        logger.error('Error changing chart type', error instanceof Error ? error : new Error(String(error)), {
          userId: context.userId
        });
        
      return {
          type: 'text',
          content: 'Sorry, I encountered an error while changing the chart type. Please try again.',
          hasData: false
        };
      }
    }

    // Handle other modifications
    const modificationType = intent.originalMessage.toLowerCase();
    if (modificationType.includes('group') || modificationType.includes('aggregate')) {
      try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
        
        if (!teams || teams.length === 0) {
          return {
            type: 'text',
            content: 'No team found for your account. Please contact your administrator.',
            hasData: false
          };
        }
        
        const teamId = teams[0]._id;
        const data = await convex.query(api.crm.getDealsByTeam, { teamId });
        
        // Process data for grouped chart (include total for grouping)
        const chartData = this.processDataForChart(data, 'deals', 'stage', true);
        
        logger.info('Chart grouping modification completed', {
          originalDataLength: chartData.length,
          userId: context.userId
        });
      
      return {
          type: 'text',
          content: 'I\'ve grouped the data on the X-axis. The chart now shows aggregated values.',
          chartSpec: {
            chartType: 'bar',
            data: chartData,
            dataType: 'deals',
            dimension: 'stage',
            title: 'deals by stage (grouped)',
            description: 'Chart showing deals grouped by stage',
            chartConfig: {
              margin: { top: 20, right: 30, left: 20, bottom: 60 },
              height: 400,
              width: 600,
              xAxis: { dataKey: 'stage' },
              yAxis: { dataKey: 'count' },
              grouped: true
            }
          },
          hasData: true,
          modification: {
            type: 'group_data'
          }
        };
    } catch (error) {
        logger.error('Error grouping chart', error instanceof Error ? error : new Error(String(error)), {
          userId: context.userId
        });
        
      return {
          type: 'text',
          content: 'Sorry, I encountered an error while grouping the chart. Please try again.',
          hasData: false
        };
      }
    }

    return {
      type: 'text',
      content: `I'm not sure how to modify the chart for "${field || dimension || 'this request'}". Please specify what you'd like to change.`,
      hasData: false
    };
  }

  private processDataForChart(data: any[], dataType: string, dimension: string, includeTotal: boolean = true): any[] {
    // Group data by the specified dimension
    const groupedData: { [key: string]: number } = {};
    
    data.forEach(item => {
      let value: string;
      
      if (dataType === 'deals') {
        value = item.stage || 'Unknown';
      } else if (dataType === 'contacts') {
        if (dimension === 'company') {
          value = item.company || 'Unknown';
        } else if (dimension === 'leadStatus') {
          value = item.leadStatus || 'Unknown';
        } else {
          value = 'Unknown';
        }
      } else if (dataType === 'accounts') {
        if (dimension === 'industry') {
          value = item.industry || 'Unknown';
        } else if (dimension === 'type') {
          value = item.type || 'Unknown';
        } else {
          value = 'Unknown';
        }
      } else {
        value = item[dimension] || 'Unknown';
      }
      
      groupedData[value] = (groupedData[value] || 0) + 1;
    });
    
    // Convert to chart data format that matches what the chart component expects
    // The chart component expects: xAxisDataKey for labels, and numeric columns for bars
    return Object.entries(groupedData).map(([name, count]) => {
      const baseData = {
        [dimension]: name,  // This will be used as xAxisDataKey
        count: count        // This will be used as dataKey for the bar
      };
      
      // Only add total if includeTotal is true
      if (includeTotal) {
      return {
          ...baseData,
          total: count  // Alternative numeric column
        };
      }
      
      return baseData;
    });
  }

  private processDataForChartWithSum(data: any[], dataType: string, dimension: string, sumField: string): any[] {
    // Group data by the specified dimension and sum the specified field
    const groupedData: { [key: string]: number } = {};
    
    data.forEach(item => {
      let value: string;
      
      if (dataType === 'deals') {
        value = item.stage || 'Unknown';
      } else if (dataType === 'contacts') {
        if (dimension === 'company') {
          value = item.company || 'Unknown';
        } else if (dimension === 'leadStatus') {
          value = item.leadStatus || 'Unknown';
        } else {
          value = 'Unknown';
        }
      } else if (dataType === 'accounts') {
        if (dimension === 'industry') {
          value = item.industry || 'Unknown';
        } else if (dimension === 'type') {
          value = item.type || 'Unknown';
        } else {
          value = 'Unknown';
        }
      } else {
        value = item[dimension] || 'Unknown';
      }
      
      // Sum the specified field instead of counting
      const fieldValue = item[sumField] || 0;
      groupedData[value] = (groupedData[value] || 0) + fieldValue;
    });
    
    // Convert to chart data format
    return Object.entries(groupedData).map(([name, sum]) => ({
      [dimension]: name,  // This will be used as xAxisDataKey
      sum: sum           // This will be used as dataKey for the bar
    }));
  }

  private async handleDataAnalysis(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    const { dataType } = intent.entities;
    
    logger.info('Analyzing data', {
      dataType,
      userId: context.userId
    });
      
      return {
      type: 'text',
      content: `I'll analyze your ${dataType || 'data'}. This feature is coming soon!`,
      hasData: false
    };
  }
}

// Data Intent Handler
class DataIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'analyze_data' || 
           intent.action === 'export_data' ||
           intent.action === 'explore_data' ||
           intent.action === 'view_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling data intent', {
      action: intent.action,
      originalMessage: intent.originalMessage,
      entities: intent.entities,
      userId: context.userId
    });

    // For view_data actions, provide intelligent responses using available data
    if (intent.action === 'view_data') {
      logger.info('Processing view_data action', {
        originalMessage: intent.originalMessage,
        userId: context.userId
      });
      
      const userMessage = intent.originalMessage.toLowerCase();
      


      try {
        // Use Convex client directly for all data queries
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        
        // Get team ID by querying user's teams
        let teamId: string;
        try {
          const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
          teamId = teams.length > 0 ? teams[0]._id : 'default';
          
          logger.info('Team ID retrieved for data query', {
            teamId,
            teamsCount: teams.length,
            userId: context.userId
          });
        } catch (error) {
          logger.error('Failed to get team ID', error as Error, { userId: context.userId });
        return {
            type: 'text',
            content: "I'm having trouble accessing your team data. Please try again in a moment.",
            data: { error: 'Failed to get team ID' }
          };
        }
        
        // Determine what data the user is asking about
        let dataType = 'contacts'; // default
        let queryType = 'list'; // default
        
        // Detect data type from user message
        if (userMessage.includes('contact')) {
          dataType = 'contacts';
        } else if (userMessage.includes('deal')) {
          dataType = 'deals';
        } else if (userMessage.includes('account')) {
          dataType = 'accounts';
        } else if (userMessage.includes('activity') || userMessage.includes('task')) {
          dataType = 'activities';
        }
        
                   // Detect query type
           if (userMessage.includes('how many') || userMessage.includes('count')) {
             queryType = 'count';
           } else if (userMessage.includes('details') || userMessage.includes('email') || userMessage.includes('phone') || userMessage.includes('company') || userMessage.includes("'s") || userMessage.includes('view')) {
             queryType = 'details';
           } else if (userMessage.includes('name') || userMessage.includes('list') || userMessage.includes('show')) {
             queryType = 'list';
           }
           
           // If we have a specific contact name in entities, default to details unless it's explicitly a count
           if (intent.entities?.contactName && queryType !== 'count') {
             queryType = 'details';
           }
        
        logger.info('Data query analysis', {
          dataType,
          queryType,
          userMessage,
          userId: context.userId
        });

        // Fetch data based on type
        let data: any[] = [];
        let content = '';
        
        switch (dataType) {
          case 'contacts':
            data = await convex.query(api.crm.getContactsByTeam, { teamId });
            break;
          case 'deals':
            data = await convex.query(api.crm.getDealsByTeam, { teamId });
            break;
          case 'accounts':
            data = await convex.query(api.crm.getAccountsByTeam, { teamId });
            break;
          case 'activities':
            data = await convex.query(api.crm.getActivitiesByTeam, { teamId });
            break;
          default:
            data = await convex.query(api.crm.getContactsByTeam, { teamId });
        }

        logger.info('Successfully retrieved data from Convex', {
          dataType,
          dataCount: data.length,
          userId: context.userId
        });

        // Apply filters based on entities or conversation context
        let companyFilter = intent.entities?.company;
        
        // If no company in current entities, check conversation context for previous company filter
        if (!companyFilter && context.conversationManager) {
          const conversationState = context.conversationManager.getState();
          companyFilter = conversationState.currentContext.lastCompanyFilter;
          if (companyFilter) {
            logger.info('Using company filter from conversation context', {
              company: companyFilter,
              userId: context.userId
            });
          }
        }
        
        if (companyFilter) {
          const companyFilterLower = companyFilter.toLowerCase();
          const originalCount = data.length;
          
          data = data.filter(item => {
            if (dataType === 'contacts') {
              return item.company && item.company.toLowerCase().includes(companyFilterLower);
            } else if (dataType === 'accounts') {
              return item.name && item.name.toLowerCase().includes(companyFilterLower);
            } else if (dataType === 'deals') {
              return item.accountName && item.accountName.toLowerCase().includes(companyFilterLower);
            }
            return true;
          });
          
          logger.info('Applied company filter', {
            company: companyFilter,
            originalCount,
            filteredCount: data.length,
            userId: context.userId
          });
          
          // Store the company filter in conversation context for future reference
          if (context.conversationManager) {
            context.conversationManager.updateFullContext({
              lastCompanyFilter: companyFilter,
              lastDataType: dataType
            });
          }
        }

        // Generate intelligent response based on query type
        logger.info('Generating response content', {
          queryType,
          dataType,
          dataLength: data.length,
          userId: context.userId
        });
        
        switch (queryType) {
          case 'count':
            if (companyFilter) {
              content = `You have ${data.length} ${dataType} at ${companyFilter} in your database.`;
            } else {
              content = `You have ${data.length} ${dataType} in your database.`;
            }
            logger.info('Generated count response', { content, userId: context.userId });
            break;
            
          case 'list':
            if (dataType === 'contacts') {
              const names = data.map(contact => {
                const firstName = contact.firstName || '';
                const lastName = contact.lastName || '';
                return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unknown';
              });
              
              if (companyFilter) {
                if (names.length <= 10) {
                  content = `Here are your ${dataType} at ${companyFilter}:\n${names.join(', ')}`;
                } else {
                  content = `You have ${data.length} ${dataType} at ${companyFilter}. Here are the first 10:\n${names.slice(0, 10).join(', ')}...`;
                }
              } else {
                if (names.length <= 10) {
                  content = `Here are your ${dataType}:\n${names.join(', ')}`;
                } else {
                  content = `You have ${data.length} ${dataType}. Here are the first 10:\n${names.slice(0, 10).join(', ')}...`;
                }
              }
            } else {
              const items = data.map(item => item.name || item.title || item.subject || 'Unknown');
              if (items.length <= 10) {
                content = `Here are your ${dataType}:\n${items.join(', ')}`;
              } else {
                content = `You have ${data.length} ${dataType}. Here are the first 10:\n${items.slice(0, 10).join(', ')}...`;
              }
            }
            break;
            
                       case 'details':
               if (dataType === 'contacts') {
                 // Check if we have a specific contact name in the entities
                 const contactName = intent.entities?.contactName;
                 
                 if (contactName) {
                   // Filter for the specific contact
                   const targetContact = data.find(contact => {
                     const fullName = contact.firstName && contact.lastName ? 
                       `${contact.firstName} ${contact.lastName}`.toLowerCase() : 
                       (contact.firstName || contact.lastName || '').toLowerCase();
                     return fullName.includes(contactName.toLowerCase());
                   });
                   
                   if (targetContact) {
                     const name = targetContact.firstName && targetContact.lastName ? 
                       `${targetContact.firstName} ${targetContact.lastName}` : 
                       targetContact.firstName || targetContact.lastName || 'Unknown';
                     const email = targetContact.email || 'No email';
                     const phone = targetContact.phone || 'No phone';
                     const company = targetContact.company || 'No company';
                     const leadStatus = targetContact.leadStatus || 'No status';
                     const notes = targetContact.notes || 'No notes';
                     
                     content = `Here are the details for ${name}:\n\n` +
                       `📧 Email: ${email}\n` +
                       `📞 Phone: ${phone}\n` +
                       `🏢 Company: ${company}\n` +
                       `📊 Lead Status: ${leadStatus}\n` +
                       `📝 Notes: ${notes}`;
                   } else {
                     content = `I couldn't find a contact named "${contactName}". Here are all your contacts:\n` +
                       data.map(contact => {
                         const name = contact.firstName && contact.lastName ? 
                           `${contact.firstName} ${contact.lastName}` : 
                           contact.firstName || contact.lastName || 'Unknown';
                         return `• ${name}`;
                       }).join('\n');
                   }
                 } else {
                   // Show details for first 5 contacts
                   const details = data.slice(0, 5).map(contact => {
                     const name = contact.firstName && contact.lastName ? 
                       `${contact.firstName} ${contact.lastName}` : 
                       contact.firstName || contact.lastName || 'Unknown';
                     const email = contact.email || 'No email';
                     const phone = contact.phone || 'No phone';
                     const company = contact.company || 'No company';
                     return `${name} (${email}, ${phone}, ${company})`;
                   });
                   content = `Here are the details for your ${dataType}:\n${details.join('\n')}`;
                 }
               } else {
                 const details = data.slice(0, 5).map(item => {
                   const name = item.name || item.title || item.subject || 'Unknown';
                   const description = item.description || 'No description';
                   return `${name}: ${description}`;
                 });
                 content = `Here are the details for your ${dataType}:\n${details.join('\n')}`;
               }
               break;
            
          default:
            content = `You have ${data.length} ${dataType} in your database.`;
        }

                   // Only include data field for details queries, not for simple counts or lists
           const response: any = {
             type: 'text',
             content
           };
           
           logger.info('Final response object', {
             type: response.type,
             content: response.content,
             hasData: queryType === 'details',
             userId: context.userId
           });
           
           // Don't add data field to avoid triggering Data Preview modal
           // The formatted content is sufficient for user display
        
        return response;
        
      } catch (error) {
        logger.error('Error retrieving data', error as Error, { 
          dataType: 'unknown',
          userId: context.userId 
        });
        
        return {
          type: 'text',
          content: "I'm having trouble accessing your data right now. Please try again in a moment.",
          data: {
            error: 'Failed to retrieve data'
          }
        };
      }
    }
    
    // For other data operations, use conversational handler
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Data operation',
      context.conversationManager,
      context
    );
  }
}

// CRUD Intent Handler
class CrudIntentHandler implements IntentHandler {
  private convex: ConvexHttpClient;

  constructor() {
    this.convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }

  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_contact' || 
           intent.action === 'update_contact' || 
           intent.action === 'delete_contact' ||
           intent.action === 'create_account' ||
           intent.action === 'update_account' ||
           intent.action === 'delete_account' ||
           intent.action === 'create_deal' ||
           intent.action === 'update_deal' ||
           intent.action === 'delete_deal';
  }

  private parseContactData(entities: any, originalMessage: string): {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    leadStatus?: string;
  } {
    // Try to extract from entities first
    let firstName = entities.firstName || '';
    let lastName = entities.lastName || '';
    let email = entities.email || '';
    let phone = entities.phone || '';
    let company = entities.company || '';
    let leadStatus = entities.leadStatus || '';

    // If we have a contactName, try to split it into first and last name
    if (entities.contactName && !firstName && !lastName) {
      const nameParts = entities.contactName.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // If we still don't have names, try to extract from the original message
    if (!firstName && !lastName) {
      const nameMatch = originalMessage.match(/([A-Za-z]+)\s+([A-Za-z]+)/);
      if (nameMatch) {
        firstName = nameMatch[1];
        lastName = nameMatch[2];
      }
    }

    // Extract email if not already found
    if (!email) {
      const emailMatch = originalMessage.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        email = emailMatch[1];
      }
    }

    // Extract phone if not already found
    if (!phone) {
      const phoneMatch = originalMessage.match(/(?:phone|tel|mobile|cell)[:\s-]*([0-9\-\(\)\s]+)/i);
      if (phoneMatch) {
        phone = phoneMatch[1].trim();
      }
    }

    // Extract company if not already found
    if (!company) {
      const companyMatch = originalMessage.match(/(?:company|corp|inc|llc)[:\s-]*([A-Za-z0-9\s]+)/i);
      if (companyMatch) {
        company = companyMatch[1].trim();
      }
    }

      return {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      company: company || undefined,
      leadStatus: leadStatus || undefined
    };
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling CRUD intent', {
      action: intent.action,
      userId: context.userId
    });

    // Handle all CRUD operations comprehensively
    switch (intent.action) {
      case 'create_contact':
        // Check if we have contact details in the intent entities
        if (intent.entities?.firstName || intent.entities?.email || intent.entities?.contactName) {
          // We have contact details, try to create the contact
          try {
            logger.info('Attempting to create contact with provided details', {
              entities: intent.entities,
              userId: context.userId
            });

            // Parse contact details from entities
            const contactData = this.parseContactData(intent.entities, intent.originalMessage);
            
            if (!contactData.firstName || !contactData.lastName || !contactData.email) {
              return {
                type: 'text',
                content: `I need more information to create the contact. Please provide:

**Required:**
• First Name
• Last Name  
• Email

You provided: ${JSON.stringify(contactData, null, 2)}

Please provide the missing required fields.`,
          conversationContext: {
                  phase: 'data_collection',
                  action: 'create_contact',
            referringTo: 'new_request'
          }
        };
      }
      
            // Get team ID
            const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
            const teamId = teams.length > 0 ? teams[0]._id : 'default';

            // Create the contact
            const contactId = await this.convex.mutation(api.crm.createContact, {
              teamId,
              createdBy: context.userId,
              firstName: contactData.firstName,
              lastName: contactData.lastName,
              email: contactData.email,
              phone: contactData.phone,
              company: contactData.company,
              leadStatus: (contactData.leadStatus as 'new' | 'contacted' | 'qualified' | 'unqualified') || 'new',
              contactType: 'contact',
              source: 'chat_creation'
            });

            logger.info('Contact created successfully', {
              contactId,
              contactData,
              userId: context.userId
            });
        
        return {
              type: 'text',
              content: `✅ Contact created successfully!

**Contact Details:**
• Name: ${contactData.firstName} ${contactData.lastName}
• Email: ${contactData.email}
${contactData.phone ? `• Phone: ${contactData.phone}` : ''}
${contactData.company ? `• Company: ${contactData.company}` : ''}
• Lead Status: ${contactData.leadStatus || 'new'}

The contact has been added to your database.`,
        conversationContext: {
                phase: 'exploration',
                action: 'create_contact',
                referringTo: 'new_request'
              }
            };

    } catch (error) {
            logger.error('Failed to create contact', error instanceof Error ? error : undefined, {
              entities: intent.entities,
              userId: context.userId
            });

      return {
              type: 'text',
              content: `❌ Sorry, I encountered an error while creating the contact. Please try again or provide the information in a different format.

Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conversationContext: {
                phase: 'data_collection',
                action: 'create_contact',
          referringTo: 'new_request'
        }
      };
    }
        } else {
          // No contact details provided, show data collection prompt
          return {
            type: 'text',
            content: `I'd be happy to help you create a new contact! 

To create a contact, I'll need some information from you. Please provide:

**Required:**
• First Name
• Last Name  
• Email

**Optional:**
• Phone Number
• Company
• Lead Status

You can provide this information in any format, for example:
"Create a contact for John Smith, john.smith@example.com, phone 555-0123, company TechCorp"

What details would you like to include for the new contact?`,
            suggestions: [
              "Create contact: John Smith, john@example.com",
              "Add contact: Sarah Wilson, sarah@company.com, phone 555-0123",
              "New contact: Mike Johnson, mike@tech.com, company TechStart"
            ],
        conversationContext: {
              phase: 'data_collection',
              action: 'create_contact',
          referringTo: 'new_request'
        }
      };
    }
    
      case 'create_account':
        return {
          type: 'text',
          content: `I'd be happy to help you create a new account! 

To create an account, I'll need some information from you. Please provide:

**Required:**
• Company Name

**Optional:**
• Industry
• Website
• Phone Number
• Annual Revenue
• Employee Count

You can provide this information in any format, for example:
"Create account for TechCorp, industry technology, website techcorp.com, revenue 5M"

What details would you like to include for the new account?`,
          suggestions: [
            "Create account: TechCorp, technology industry",
            "Add account: Global Solutions, website globalsolutions.com",
            "New account: Startup Inc, revenue 2M, 50 employees"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'create_account',
            referringTo: 'new_request'
          }
        };

      case 'create_deal':
        return {
          type: 'text',
          content: `I'd be happy to help you create a new deal! 

To create a deal, I'll need some information from you. Please provide:

**Required:**
• Deal Name
• Stage (prospecting, qualification, proposal, negotiation, closed_won, closed_lost)

**Optional:**
• Amount
• Contact/Account (if related)
• Close Date
• Probability
• Description

You can provide this information in any format, for example:
"Create deal for Software License, stage proposal, amount 50000, close date next month"

What details would you like to include for the new deal?`,
          suggestions: [
            "Create deal: Software License, proposal stage, 50K",
            "Add deal: Consulting Project, qualification, 25K",
            "New deal: Enterprise Contract, negotiation, 100K"
          ],
        conversationContext: {
            phase: 'data_collection',
            action: 'create_deal',
          referringTo: 'new_request'
        }
      };

      case 'update_contact':
        // Check if we have update details in the intent entities
        if (intent.entities?.contactName && intent.entities?.field && intent.entities?.value) {
          // We have update details, try to update the contact
          try {
            logger.info('Attempting to update contact with provided details', {
              entities: intent.entities,
              userId: context.userId
            });

            const contactName = intent.entities.contactName;
    const field = intent.entities.field;
    const value = intent.entities.value;
    
            // Get team ID
            const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
            const teamId = teams.length > 0 ? teams[0]._id : 'default';

            // Find the contact by name
            const contacts = await this.convex.query(api.crm.getContactsByTeam, { teamId });
            const targetContact = contacts.find(contact => {
              const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
              return fullName.includes(contactName.toLowerCase());
            });

            if (!targetContact) {
      return {
                type: 'text',
                content: `❌ I couldn't find a contact named "${contactName}". 

Available contacts:
${contacts.slice(0, 5).map(contact => {
  const name = contact.firstName && contact.lastName ? 
    `${contact.firstName} ${contact.lastName}` : 
    contact.firstName || contact.lastName || 'Unknown';
  return `• ${name}`;
}).join('\n')}

Please check the spelling or try a different contact name.`,
        conversationContext: {
                  phase: 'data_collection',
                  action: 'update_contact',
          referringTo: 'new_request'
        }
      };
    }
    
            // Validate field name and handle field name variations
            const validFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'title', 'leadStatus', 'notes'];
            
            // Handle field name variations (e.g., "note" -> "notes")
            let normalizedField = field;
            if (field === 'note') {
              normalizedField = 'notes';
            }
            
            if (!validFields.includes(normalizedField)) {
              return {
                type: 'text',
                content: `❌ Invalid field "${field}". 

Valid fields to update:
• firstName, lastName, email, phone, company, title, leadStatus, notes

Please specify a valid field to update.`,
          conversationContext: {
                  phase: 'data_collection',
                  action: 'update_contact',
            referringTo: 'new_request'
          }
        };
      }
      
            // Update the contact
            await this.convex.mutation(api.crm.updateContact, {
              contactId: targetContact._id,
              updates: { [normalizedField]: value }
            });

            logger.info('Contact updated successfully', {
              contactId: targetContact._id,
              field,
              value,
              userId: context.userId
            });

            const updatedName = targetContact.firstName && targetContact.lastName ? 
              `${targetContact.firstName} ${targetContact.lastName}` : 
              targetContact.firstName || targetContact.lastName || 'Unknown';

            return {
              type: 'text',
              content: `✅ Contact updated successfully!

**Updated Contact:**
• Name: ${updatedName}
• Field: ${normalizedField}
• New Value: ${value}

The changes have been saved to your database.`,
        conversationContext: {
                phase: 'exploration',
                action: 'update_contact',
          referringTo: 'new_request'
        }
      };

          } catch (error) {
            logger.error('Failed to update contact', error instanceof Error ? error : undefined, {
              entities: intent.entities,
              userId: context.userId
            });

      return {
              type: 'text',
              content: `❌ Sorry, I encountered an error while updating the contact. Please try again.

Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conversationContext: {
                phase: 'data_collection',
                action: 'update_contact',
          referringTo: 'new_request'
        }
      };
    }
        } else {
          // No update details provided, show data collection prompt
          return {
            type: 'text',
            content: `I'd be happy to help you update a contact! 

Please provide:
• Contact name (who to update)
• What field to update (email, phone, company, lead status, etc.)
• New value

For example:
"Update John Smith's email to john.new@company.com"
"Change Sarah Wilson's phone to 555-9999"
"Set Mike Johnson's lead status to qualified"

Which contact would you like to update and what changes should I make?`,
            suggestions: [
              "Update John Smith's email to john.new@company.com",
              "Change Sarah Wilson's phone to 555-9999",
              "Set Mike Johnson's lead status to qualified"
            ],
          conversationContext: {
              phase: 'data_collection',
              action: 'update_contact',
            referringTo: 'new_request'
          }
        };
      }
      
      case 'update_account':
        return {
          type: 'text',
          content: `I'd be happy to help you update an account! 

Please provide:
• Account name (which account to update)
• What field to update (industry, website, revenue, etc.)
• New value

For example:
"Update TechCorp's industry to software"
"Change Global Solutions revenue to 10M"
"Set Startup Inc website to startupinc.com"

Which account would you like to update and what changes should I make?`,
          suggestions: [
            "Update TechCorp's industry to software",
            "Change Global Solutions revenue to 10M",
            "Set Startup Inc website to startupinc.com"
          ],
        conversationContext: {
            phase: 'data_collection',
            action: 'update_account',
          referringTo: 'new_request'
        }
      };

      case 'update_deal':
        return {
          type: 'text',
          content: `I'd be happy to help you update a deal! 

Please provide:
• Deal name (which deal to update)
• What field to update (stage, amount, close date, etc.)
• New value

For example:
"Update Software License deal stage to closed_won"
"Change Consulting Project amount to 30K"
"Set Enterprise Contract close date to December 15"

Which deal would you like to update and what changes should I make?`,
          suggestions: [
            "Update Software License deal stage to closed_won",
            "Change Consulting Project amount to 30K",
            "Set Enterprise Contract close date to December 15"
          ],
        conversationContext: {
            phase: 'data_collection',
            action: 'update_deal',
          referringTo: 'new_request'
        }
      };

      case 'delete_contact':
        // Check if we have the contact name in the intent entities
        if (intent.entities?.contactName) {
          // We have the contact name, try to delete the contact
          try {
            logger.info('Attempting to delete contact with provided details', {
              entities: intent.entities,
              userId: context.userId
            });

            const contactName = intent.entities.contactName;

            // Get team ID
            const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';

            // Find the contact by name
            const contacts = await this.convex.query(api.crm.getContactsByTeam, { teamId });
            const targetContact = contacts.find(contact => {
              const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
              return fullName.includes(contactName.toLowerCase());
            });

            if (!targetContact) {
        return {
                type: 'text',
                content: `❌ I couldn't find a contact named "${contactName}". 

Available contacts:
${contacts.slice(0, 5).map(contact => {
  const name = contact.firstName && contact.lastName ? 
    `${contact.firstName} ${contact.lastName}` : 
    contact.firstName || contact.lastName || 'Unknown';
  return `• ${name}`;
}).join('\n')}

Please check the spelling or try a different contact name.`,
          conversationContext: {
                  phase: 'data_collection',
                  action: 'delete_contact',
            referringTo: 'new_request'
          }
        };
      }
      
            // Delete the contact
            await this.convex.mutation(api.crm.deleteContact, {
              contactId: targetContact._id
            });

            logger.info('Contact deleted successfully', {
              contactId: targetContact._id,
              contactName: `${targetContact.firstName} ${targetContact.lastName}`,
              userId: context.userId
            });

            const deletedName = targetContact.firstName && targetContact.lastName ? 
              `${targetContact.firstName} ${targetContact.lastName}` : 
              targetContact.firstName || targetContact.lastName || 'Unknown';

            return {
              type: 'text',
              content: `✅ Contact deleted successfully!

**Deleted Contact:**
• Name: ${deletedName}
• Email: ${targetContact.email || 'No email'}

The contact has been permanently removed from your database.`,
        conversationContext: {
                phase: 'exploration',
                action: 'delete_contact',
          referringTo: 'new_request'
        }
      };

          } catch (error) {
            logger.error('Failed to delete contact', error instanceof Error ? error : undefined, {
              entities: intent.entities,
              userId: context.userId
            });

      return {
              type: 'text',
              content: `❌ Sorry, I encountered an error while deleting the contact. Please try again.

Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conversationContext: {
                phase: 'data_collection',
                action: 'delete_contact',
          referringTo: 'new_request'
        }
      };
          }
        }

        // No contact name provided, show data collection prompt
        return {
          type: 'text',
          content: `I'd be happy to help you delete a contact! 

Please provide the name of the contact you want to delete.

For example:
"Delete John Smith"
"Remove Sarah Wilson from contacts"
"Delete contact Mike Johnson"

⚠️ **Warning**: This action cannot be undone. The contact and all associated data will be permanently removed.

Which contact would you like to delete?`,
          suggestions: [
            "Delete John Smith",
            "Remove Sarah Wilson from contacts",
            "Delete contact Mike Johnson"
          ],
          conversationContext: {
            phase: 'confirmation',
            action: 'delete_contact',
            referringTo: 'new_request'
          }
        };

      case 'delete_account':
        return {
          type: 'text',
          content: `I'd be happy to help you delete an account! 

Please provide the name of the account you want to delete.

For example:
"Delete TechCorp"
"Remove Global Solutions account"
"Delete account Startup Inc"

⚠️ **Warning**: This action cannot be undone. The account and all associated data will be permanently removed.

Which account would you like to delete?`,
          suggestions: [
            "Delete TechCorp",
            "Remove Global Solutions account",
            "Delete account Startup Inc"
          ],
        conversationContext: {
          phase: 'confirmation',
            action: 'delete_account',
            referringTo: 'new_request'
          }
        };

      case 'delete_deal':
        return {
          type: 'text',
          content: `I'd be happy to help you delete a deal! 

Please provide the name of the deal you want to delete.

For example:
"Delete Software License deal"
"Remove Consulting Project"
"Delete deal Enterprise Contract"

⚠️ **Warning**: This action cannot be undone. The deal and all associated data will be permanently removed.

Which deal would you like to delete?`,
          suggestions: [
            "Delete Software License deal",
            "Remove Consulting Project",
            "Delete deal Enterprise Contract"
          ],
        conversationContext: {
            phase: 'confirmation',
            action: 'delete_deal',
          referringTo: 'new_request'
        }
      };

      default:
        // For any other CRUD operations, use conversational handler
        return await conversationalHandler.handleConversation(
          intent.context.userGoal || 'CRUD operation',
          context.conversationManager,
          context
        );
    }

    // For other CRUD operations, use conversational handler
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'CRUD operation',
      context.conversationManager,
      context
    );
  }
}

// Email Intent Handler
class EmailIntentHandler implements IntentHandler {
  private convex: ConvexHttpClient;

  constructor() {
    this.convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }

  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'send_email';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling email intent', {
      action: intent.action,
      userId: context.userId
    });

    try {
      const recipient = intent.entities?.recipient;
      const contentType = intent.entities?.content_type;
      
      // Check conversation context for pending recipient from previous interaction
      const conversationContext = context.conversationManager?.getState()?.currentContext;
      const pendingRecipient = conversationContext?.pendingEmailRecipient;
      const pendingEmailAction = conversationContext?.action;

      logger.info('Email intent conversation context check', {
        hasConversationManager: !!context.conversationManager,
        hasState: !!context.conversationManager?.getState(),
        hasCurrentContext: !!conversationContext,
        pendingRecipient,
        pendingEmailAction,
        conversationContextKeys: conversationContext ? Object.keys(conversationContext) : [],
        fullCurrentContext: conversationContext,
        userId: context.userId
      });

      // Use recipient from current message or fall back to pending recipient from context
      let finalRecipient = recipient || pendingRecipient;

      // If no recipient but we have a pending email action, check if this is a continuation
      if (!finalRecipient && pendingEmailAction === 'send_email' && pendingRecipient) {
        // This might be a continuation message with content type
        const userMessage = intent.originalMessage.toLowerCase();
        const hasContentType = userMessage.includes('thank') || 
          userMessage.includes('follow') || 
          userMessage.includes('meeting') || 
          userMessage.includes('proposal') || 
          userMessage.includes('invoice') || 
          userMessage.includes('contract') ||
          userMessage.includes('about') ||
          userMessage.includes('regarding') ||
          userMessage.includes('concerning');

        if (hasContentType) {
          // This is a continuation with content type, use the pending recipient
          finalRecipient = pendingRecipient;
          logger.info('Email continuation detected', {
            originalMessage: intent.originalMessage,
            pendingRecipient,
            finalRecipient,
            contentType: intent.entities?.content_type,
            context: intent.entities?.context,
            userId: context.userId
          });
          // Continue with email drafting logic below
        } else {
          // Still no clear recipient or content
        return {
            type: 'text',
            content: `I'd be happy to help you send an email! 

Please provide the recipient's name or email address.

For example:
"Send an email to john@example.com"
"Email Sarah Johnson about the meeting"
"Send a thank you email to Mike Chen"

Who would you like to send an email to?`,
            suggestions: [
              "Send email to john@example.com",
              "Email Sarah Johnson",
              "Send thank you to Mike Chen"
            ],
        conversationContext: {
              phase: 'data_collection',
              action: 'send_email',
          referringTo: 'new_request'
        }
      };
    }
  }

      if (!finalRecipient) {
        return {
          type: 'text',
          content: `I'd be happy to help you send an email! 

Please provide the recipient's name or email address.

For example:
"Send an email to john@example.com"
"Email Sarah Johnson about the meeting"
"Send a thank you email to Mike Chen"

Who would you like to send an email to?`,
          suggestions: [
            "Send email to john@example.com",
            "Email Sarah Johnson",
            "Send thank you to Mike Chen"
          ],
        conversationContext: {
            phase: 'data_collection',
            action: 'send_email',
          referringTo: 'new_request'
        }
      };
    }
    
      // Get team ID and find the contact
      const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      const contacts = await this.convex.query(api.crm.getContactsByTeam, { teamId });

      logger.info('Email intent contact search', {
        recipient: finalRecipient,
        totalContacts: contacts.length,
        contactNames: contacts.map(c => `${c.firstName} ${c.lastName}`),
        userId: context.userId
      });

      // Find matching contact with more precise matching
      const matchingContact = contacts.find(contact => {
        const contactName = contact.firstName && contact.lastName 
          ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
          : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
        const searchName = finalRecipient.toLowerCase();
        
        // Exact match first
        if (contactName === searchName) {
          return true;
        }
        
        // Check if search name contains the full contact name
        if (searchName.includes(contactName) && contactName.length > 2) {
          return true;
        }
        
        // Check if contact name contains the search name
        if (contactName.includes(searchName) && searchName.length > 2) {
          return true;
        }
        
        // Check for partial matches on first name or last name
        const searchParts = searchName.split(' ').filter((part: string) => part.length > 1);
        const contactParts = contactName.split(' ').filter((part: string) => part.length > 1);
        
        // At least 2 parts should match
        const matchingParts = searchParts.filter((searchPart: string) => 
          contactParts.some((contactPart: string) => contactPart.includes(searchPart) || searchPart.includes(contactPart))
        );
        
        return matchingParts.length >= Math.min(2, searchParts.length);
      });

      if (matchingContact) {
        // Check if the user provided enough context about what they want to say
        const userMessage = intent.originalMessage.toLowerCase();
        const hasSpecificContent = contentType || 
          userMessage.includes('thank') || 
          userMessage.includes('follow') || 
          userMessage.includes('meeting') || 
          userMessage.includes('proposal') || 
          userMessage.includes('invoice') || 
          userMessage.includes('contract') ||
          userMessage.includes('about') ||
          userMessage.includes('regarding') ||
          userMessage.includes('concerning');

        if (!hasSpecificContent) {
          // User provided vague request, ask for more information
      return {
            type: 'text',
            content: `I found ${matchingContact.firstName} ${matchingContact.lastName} in your contacts. 

To help me draft a better email, could you tell me what you'd like to say to them? For example:

• "Send a thank you email to vigeash gobal"
• "Follow up with vigeash gobal about the meeting"
• "Send vigeash gobal an email about the proposal"
• "Email vigeash gobal regarding the invoice"

What would you like to communicate?`,
            suggestions: [
              `Send a thank you email to ${matchingContact.firstName}`,
              `Follow up with ${matchingContact.firstName} about the meeting`,
              `Send ${matchingContact.firstName} an email about the proposal`,
              `Email ${matchingContact.firstName} regarding the invoice`
            ],
        conversationContext: {
              phase: 'data_collection',
              action: 'send_email',
              referringTo: 'new_request',
              pendingEmailRecipient: matchingContact.firstName + ' ' + matchingContact.lastName
            }
          };
        }

        // Contact exists and user provided context, draft email
        const emailContent = this.generateEmailContent(matchingContact, contentType);
        
        const emailResponse = {
          type: 'email_draft',
          content: `I've drafted an email for you to ${matchingContact.firstName} ${matchingContact.lastName}.`,
          emailDraft: {
            to: matchingContact.email,
            subject: emailContent.subject,
            content: emailContent.content
          },
        conversationContext: {
            phase: 'confirmation',
            action: 'send_email',
          referringTo: 'new_request'
        }
      };
        
        logger.info('Email draft response created', {
          type: emailResponse.type,
          hasEmailDraft: !!emailResponse.emailDraft,
          emailDraftTo: emailResponse.emailDraft?.to,
          emailDraftSubject: emailResponse.emailDraft?.subject,
          userId: context.userId
        });
        
        return emailResponse;
      } else {
        // Contact doesn't exist
        return {
          type: 'text',
          content: `I couldn't find a contact named "${finalRecipient}" in your database. 

Would you like me to help you create a new contact for this person? Please provide their email address so I can add them to your contacts and then send the email.

For example:
"Create contact: ${finalRecipient}, ${finalRecipient.toLowerCase().replace(' ', '.')}@example.com"`,
          suggestions: [
            `Create contact: ${finalRecipient}, ${finalRecipient.toLowerCase().replace(' ', '.')}@example.com`,
            "Show me my contacts",
            "Send email to existing contact"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'create_contact',
            referringTo: 'new_request'
          }
        };
      }
      
    } catch (error) {
      logger.error('Error handling email intent', error instanceof Error ? error : undefined, {
        intent,
        userId: context.userId
      });

      return {
        type: 'text',
        content: `I encountered an issue while processing your email request. Please try again or provide more specific details about who you'd like to email.`,
        conversationContext: {
          phase: 'error',
          action: 'send_email',
          referringTo: 'new_request'
        }
      };
    }
  }

  private generateEmailContent(contact: any, contentType?: string): { subject: string; content: string } {
    const firstName = contact.firstName || 'there';
    const lastName = contact.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // Check for specific content types in the user's message
    const userMessage = contentType?.toLowerCase() || '';
    
    if (userMessage.includes('thank')) {
      return {
        subject: 'Thank You',
        content: `Dear ${fullName},

Thank you for taking the time to meet with me yesterday. I really appreciate the opportunity to discuss our collaboration.

I look forward to working together and will follow up with next steps soon.

Best regards,
[Your Name]`
      };
    } else if (userMessage.includes('follow')) {
      return {
        subject: 'Follow Up',
        content: `Dear ${fullName},

I hope this email finds you well. I wanted to follow up on our recent conversation and see if you have any questions or need additional information.

Please don't hesitate to reach out if there's anything I can help with.

Best regards,
[Your Name]`
      };
    } else if (userMessage.includes('meeting')) {
      return {
        subject: 'Meeting Follow-up',
        content: `Dear ${fullName},

Thank you for the productive meeting today. I wanted to follow up on the key points we discussed and confirm our next steps.

[Add specific meeting details and action items here]

Please let me know if you have any questions or if there's anything else you'd like to discuss.

Best regards,
[Your Name]`
      };
    } else if (userMessage.includes('proposal')) {
      return {
        subject: 'Proposal Discussion',
        content: `Dear ${fullName},

I hope this email finds you well. I wanted to discuss the proposal we've been working on and get your thoughts on the next steps.

[Add specific proposal details here]

I look forward to hearing your feedback and moving forward with this opportunity.

Best regards,
[Your Name]`
      };
    } else if (userMessage.includes('invoice')) {
      return {
        subject: 'Invoice Inquiry',
        content: `Dear ${fullName},

I hope you're doing well. I wanted to follow up regarding the recent invoice and ensure everything is on track.

[Add specific invoice details here]

Please let me know if you need any additional information or have any questions.

Best regards,
[Your Name]`
      };
    } else if (userMessage.includes('contract')) {
      return {
        subject: 'Contract Discussion',
        content: `Dear ${fullName},

I hope this email finds you well. I wanted to discuss the contract terms and ensure we're aligned on all the key points.

[Add specific contract details here]

I look forward to finalizing this agreement and moving forward with our partnership.

Best regards,
[Your Name]`
      };
    } else {
      return {
        subject: 'Hello',
        content: `Dear ${fullName},

I hope this message finds you well.

[Your message here]

Best regards,
[Your Name]`
      };
    }
  }
}

// Calendar Intent Handler
class CalendarIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_calendar_event';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling calendar event creation intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      // Parse event details from the intent
      const eventDetails = this.parseEventDetails(intent);
      
      // Resolve attendees to contacts in the database
      const attendees = await this.resolveAttendees(eventDetails.attendees, context);
      
      // Create event preview
      const eventPreview = {
        title: eventDetails.title || 'Meeting',
        date: eventDetails.date,
        time: eventDetails.time,
        duration: eventDetails.duration || 30,
        attendees: attendees,
        location: eventDetails.location || '',
        description: eventDetails.description || ''
      };

      // Generate preview message
      const previewMessage = this.generatePreviewMessage(eventPreview);

      logger.info('Created calendar event preview', {
        eventPreview,
        userId: context.userId
      });

      return {
        type: 'calendar_preview',
        content: previewMessage,
        eventPreview: eventPreview,
        conversationContext: {
          phase: 'confirmation',
          action: 'create_calendar_event',
          referringTo: 'new_request',
          eventPreview: eventPreview
        },
        metadata: {
          action: 'create_calendar_event',
          needsConfirmation: true
        }
      };

    } catch (error) {
      logger.error('Error handling calendar event creation', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'error',
        content: 'Sorry, I encountered an issue while creating the calendar event. Please try again with more specific details.',
        metadata: {
          action: 'create_calendar_event',
          error: true
        }
      };
    }
  }

  private parseEventDetails(intent: SimplifiedIntent): any {
    const entities = intent.entities || {};
    
    // Ensure attendees is always an array
    let attendees = [];
    if (entities.attendee) {
      attendees = Array.isArray(entities.attendee) ? entities.attendee : [entities.attendee];
    } else if (entities.attendees) {
      attendees = Array.isArray(entities.attendees) ? entities.attendees : [entities.attendees];
    }
    
    return {
      title: entities.title || 'Meeting',
      attendees: attendees,
      date: entities.date || 'today',
      time: entities.time || '9:00 AM',
      duration: entities.duration || 30,
      location: entities.location || '',
      description: entities.description || ''
    };
  }

  private async resolveAttendees(attendeeNames: string[], context: IntentRouterContext): Promise<any[]> {
    if (!attendeeNames || attendeeNames.length === 0) {
      return [];
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    try {
      // Get team ID from user's teams
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      if (!teams || teams.length === 0) {
        logger.warn('No teams found for user, cannot resolve attendees', { userId: context.userId });
        return attendeeNames.map(name => ({
          name,
          email: '',
          contactId: null,
          resolved: false
        }));
      }
      
      const teamId = teams[0]._id; // Use the first team

      // Get all contacts for the user's team
      const contacts = await convex.query(api.crm.getContactsByTeam, {
        teamId: teamId
      });

      const resolvedAttendees = [];

      for (const attendeeName of attendeeNames) {
        // Try to find contact by name (case insensitive)
        const contact = contacts.find((c: any) => {
          const fullName = c.firstName && c.lastName ? 
            `${c.firstName} ${c.lastName}` : 
            c.firstName || c.lastName || '';
          
          return fullName.toLowerCase().includes(attendeeName.toLowerCase()) ||
                 c.email?.toLowerCase().includes(attendeeName.toLowerCase());
        });

        if (contact) {
          const fullName = contact.firstName && contact.lastName ? 
            `${contact.firstName} ${contact.lastName}` : 
            contact.firstName || contact.lastName || 'Unknown';
          
          resolvedAttendees.push({
            name: fullName,
            email: contact.email,
            contactId: contact._id,
            resolved: true
          });
        } else {
          // If not found, add as unresolved attendee
          resolvedAttendees.push({
            name: attendeeName,
            email: '',
            contactId: null,
            resolved: false
          });
        }
      }

      return resolvedAttendees;

    } catch (error) {
      logger.error('Error resolving attendees', error instanceof Error ? error : new Error(String(error)), {
        attendeeNames,
        userId: context.userId
      });
      
      // Return unresolved attendees as fallback
      return attendeeNames.map(name => ({
        name,
        email: '',
        contactId: null,
        resolved: false
      }));
    }
  }

  private generatePreviewMessage(eventPreview: any): string {
    const { title, date, time, duration, attendees, location } = eventPreview;
    
    let message = `📅 **Calendar Event Preview**\n\n`;
    message += `**Meeting:** ${title}\n`;
    message += `**Date:** ${date}\n`;
    message += `**Time:** ${time} (${duration} minutes)\n`;
    
    if (attendees && attendees.length > 0) {
      message += `**Attendees:**\n`;
      attendees.forEach((attendee: any) => {
        if (attendee.resolved) {
          message += `- ${attendee.name} (${attendee.email})\n`;
        } else {
          message += `- ${attendee.name} (not found in contacts)\n`;
        }
      });
    }
    
    if (location) {
      message += `**Location:** ${location}\n`;
    }
    
    message += `\nPlease confirm the details above. You can modify any information before creating the event.`;
    
    return message;
  }
}

// Analysis Intent Handler
class AnalysisIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'analyze_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling analysis intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for analysis operations
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Analysis operation',
      context.conversationManager,
      context
    );
  }
}

// Profile Intent Handler
class ProfileIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'query_profile';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling profile query intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      
      // Get user's teams
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams?.[0]?._id;

      if (!teamId) {
        return {
          type: 'text',
          content: 'I couldn\'t find your team information. Please make sure you\'ve completed the onboarding process.',
          hasData: false
        };
      }

      // Get AI profile context
      const aiContext = await convex.query(api.profiles.getAIProfileContext, { 
        userId: context.userId, 
        teamId 
      });

      const { profileType, query } = intent.entities;
      
      if (profileType === 'company') {
        return this.handleCompanyQuery(aiContext.company, query);
      } else if (profileType === 'user') {
        return this.handleUserQuery(aiContext.user, query);
      } else {
        // If no specific profile type, return both
        return this.handleGeneralProfileQuery(aiContext, query);
      }

    } catch (error) {
      logger.error('Error handling profile query', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while retrieving your profile information. Please try again.',
        hasData: false
      };
    }
  }

  private handleCompanyQuery(companyData: any, query: string): any {
    if (!companyData) {
      return {
        type: 'text',
        content: 'I couldn\'t find your company information. Please complete your company profile in the admin section.',
        hasData: false
      };
    }

    let content = '';
    
    if (query === 'name') {
      content = `Your company name is **${companyData.name}**.`;
    } else if (query === 'details') {
      content = `**Company Information:**\n\n`;
      content += `**Name:** ${companyData.name}\n`;
      if (companyData.industry) content += `**Industry:** ${companyData.industry}\n`;
      if (companyData.companySize) content += `**Size:** ${companyData.companySize} employees\n`;
      if (companyData.annualRevenue) content += `**Revenue:** ${companyData.annualRevenue}\n`;
      if (companyData.businessModel) content += `**Business Model:** ${companyData.businessModel}\n`;
      if (companyData.targetMarket) content += `**Target Market:** ${companyData.targetMarket}\n`;
      if (companyData.teamSize) content += `**Team Size:** ${companyData.teamSize} people\n`;
      if (companyData.brandVoice) content += `**Brand Voice:** ${companyData.brandVoice}\n`;
    } else {
      content = `**Company Information:**\n\n`;
      content += `**Name:** ${companyData.name}\n`;
      if (companyData.industry) content += `**Industry:** ${companyData.industry}\n`;
      if (companyData.companySize) content += `**Size:** ${companyData.companySize} employees\n`;
    }

    return {
      type: 'text',
      content,
      hasData: true
    };
  }

  private handleUserQuery(userData: any, query: string): any {
    if (!userData) {
      return {
        type: 'text',
        content: 'I couldn\'t find your user information. Please complete your profile in the admin section.',
        hasData: false
      };
    }

    let content = '';
    
    if (query === 'name') {
      content = `Your name is **${userData.name}**.`;
    } else if (query === 'role' || query === 'title') {
      if (userData.title) {
        content = `Your job title is **${userData.title}**.`;
      } else if (userData.role) {
        content = `Your role is **${userData.role}**.`;
      } else {
        content = 'I don\'t have your job title or role information. You can update this in your profile settings.';
      }
    } else if (query === 'details') {
      content = `**Your Profile Information:**\n\n`;
      content += `**Name:** ${userData.name}\n`;
      if (userData.title) content += `**Title:** ${userData.title}\n`;
      if (userData.department) content += `**Department:** ${userData.department}\n`;
      if (userData.role) content += `**Role:** ${userData.role}\n`;
      if (userData.communicationStyle) content += `**Communication Style:** ${userData.communicationStyle}\n`;
      if (userData.preferredDetailLevel) content += `**Preferred Detail Level:** ${userData.preferredDetailLevel}\n`;
    } else {
      content = `**Your Profile Information:**\n\n`;
      content += `**Name:** ${userData.name}\n`;
      if (userData.title) content += `**Title:** ${userData.title}\n`;
      if (userData.department) content += `**Department:** ${userData.department}\n`;
    }

    return {
      type: 'text',
      content,
      hasData: true
    };
  }

  private handleGeneralProfileQuery(aiContext: any, query: string): any {
    let content = '';

    if (aiContext.company) {
      content += `**Company Information:**\n`;
      content += `**Name:** ${aiContext.company.name}\n`;
      if (aiContext.company.industry) content += `**Industry:** ${aiContext.company.industry}\n`;
      if (aiContext.company.companySize) content += `**Size:** ${aiContext.company.companySize} employees\n\n`;
    }

    if (aiContext.user) {
      content += `**Your Information:**\n`;
      content += `**Name:** ${aiContext.user.name}\n`;
      if (aiContext.user.title) content += `**Title:** ${aiContext.user.title}\n`;
      if (aiContext.user.department) content += `**Department:** ${aiContext.user.department}\n`;
    }

    if (!aiContext.company && !aiContext.user) {
      content = 'I couldn\'t find your profile information. Please complete your profile in the admin section.';
    }

    return {
      type: 'text',
      content,
      hasData: true
    };
  }
}

// LinkedIn Post Intent Handler
class LinkedInPostIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_linkedin_post';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling LinkedIn post intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { content, platform, schedule } = intent.entities;
      
      // Generate LinkedIn post content using AI
      const postContent = await this.generateLinkedInPost(content, context);
      
      // Create post preview
      const postPreview = {
        content: postContent,
        platform: 'linkedin',
        scheduledAt: schedule ? this.parseScheduleTime(schedule) : undefined,
        visibility: 'public',
        postType: 'text'
      };

      return {
        type: 'linkedin_post_preview',
        content: postPreview,
        hasData: true,
        needsConfirmation: true
      };

    } catch (error) {
      logger.error('Error handling LinkedIn post intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while creating your LinkedIn post. Please try again.',
        hasData: false
      };
    }
  }

  private async generateLinkedInPost(content: string, context: IntentRouterContext): Promise<string> {
    // Use the AI to generate LinkedIn post content
    const prompt = `Create a professional LinkedIn post about: ${content}

Please make it:
- Engaging and professional
- Include relevant hashtags
- Keep it under 1300 characters
- Add value to the reader
- Include a call-to-action if appropriate

Format the response as just the post content, no additional text.`;

    // Fix: Use proper URL construction for server-side requests
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.shabe.ai';
    const apiUrl = `${baseUrl}/api/chat`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        userId: context.userId,
        isLinkedInPost: true
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate LinkedIn post content');
    }

    const data = await response.json();
    return data.content || `Excited to share about ${content}! #innovation #business`;
  }

  private parseScheduleTime(schedule: string): string | undefined {
    // Simple schedule parsing - can be enhanced
    const now = new Date();
    
    if (schedule.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM
      return tomorrow.toISOString();
    }
    
    if (schedule.toLowerCase().includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0); // 9 AM
      return nextWeek.toISOString();
    }
    
    return undefined; // Post immediately
  }
}

// Create and configure the router
export const intentRouter = new IntentRouter();

// Register all handlers
intentRouter.registerHandler(new ChartIntentHandler());
intentRouter.registerHandler(new DataIntentHandler());
intentRouter.registerHandler(new CrudIntentHandler());
intentRouter.registerHandler(new EmailIntentHandler());
intentRouter.registerHandler(new CalendarIntentHandler());
intentRouter.registerHandler(new AnalysisIntentHandler());
intentRouter.registerHandler(new ProfileIntentHandler());
intentRouter.registerHandler(new LinkedInPostIntentHandler()); 