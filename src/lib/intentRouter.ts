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

    if (intent.action === 'modify_chart') {
      logger.info('Handling chart modification request', {
        userId: context.userId
      });
    }

    // Use conversational handler for chart operations
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Chart operation',
      context.conversationManager,
      context
    );
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
        } else if (userMessage.includes('name') || userMessage.includes('list') || userMessage.includes('show')) {
          queryType = 'list';
        } else if (userMessage.includes('email') || userMessage.includes('phone') || userMessage.includes('company')) {
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

        // Generate intelligent response based on query type
        logger.info('Generating response content', {
          queryType,
          dataType,
          dataLength: data.length,
          userId: context.userId
        });
        
        switch (queryType) {
          case 'count':
            content = `You have ${data.length} ${dataType} in your database.`;
            logger.info('Generated count response', { content, userId: context.userId });
            break;
            
          case 'list':
            if (dataType === 'contacts') {
              const names = data.map(contact => {
                const firstName = contact.firstName || '';
                const lastName = contact.lastName || '';
                return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unknown';
              });
              
              if (names.length <= 10) {
                content = `Here are your ${dataType}:\n${names.join(', ')}`;
              } else {
                content = `You have ${data.length} ${dataType}. Here are the first 10:\n${names.slice(0, 10).join(', ')}...`;
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

        // Only include data field for list and details queries, not for simple counts
        const response: any = {
          type: 'text',
          content
        };
        
        logger.info('Final response object', {
          type: response.type,
          content: response.content,
          hasData: queryType === 'list' || queryType === 'details',
          userId: context.userId
        });
        
        // Add data field only for list and details queries where it's useful
        if (queryType === 'list' || queryType === 'details') {
          response.data = {
            dataType,
            queryType,
            count: data.length,
            items: data.slice(0, 10) // Show first 10 items
          };
        }
        
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

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling CRUD intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for CRUD operations
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'CRUD operation',
      context.conversationManager,
      context
    );
  }
}

// Email Intent Handler
class EmailIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'send_email';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling email intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for email operations
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Email operation',
      context.conversationManager,
      context
    );
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

// Create and configure the router
export const intentRouter = new IntentRouter();

// Register all handlers
intentRouter.registerHandler(new ChartIntentHandler());
intentRouter.registerHandler(new DataIntentHandler());
intentRouter.registerHandler(new CrudIntentHandler());
intentRouter.registerHandler(new EmailIntentHandler());
intentRouter.registerHandler(new AnalysisIntentHandler()); 