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

    // For view_data actions, provide a quick response using available data
    if (intent.action === 'view_data') {
      logger.info('Processing view_data action', {
        originalMessage: intent.originalMessage,
        userId: context.userId
      });
      
      const userMessage = intent.originalMessage.toLowerCase();
      
      // Check if user is asking about contact count
      if (userMessage.includes('contact') && 
          (userMessage.includes('how many') || userMessage.includes('count'))) {
        
        logger.info('Detected contact count query, using direct Convex query', {
          userMessage,
          userId: context.userId
        });
        
        try {
          // Get team ID from context
          const teamId = context.conversationManager?.getState()?.teamId;
          
          logger.info('Team ID for contact query', {
            teamId,
            userId: context.userId
          });
          
          if (teamId) {
            // Use Convex client directly instead of fetch
            const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
            const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
            
            logger.info('Successfully retrieved contacts from Convex', {
              contactCount: contacts.length,
              userId: context.userId
            });
            
            return {
              type: 'text',
              content: `You have ${contacts.length} contacts in your database.`,
              data: {
                contactCount: contacts.length,
                contacts: contacts.slice(0, 5) // Show first 5 for reference
              }
            };
          }
        } catch (error) {
          logger.error('Error getting contact count', error as Error, { userId: context.userId });
        }
       
       // Return a fallback response instead of calling conversational handler
       return {
         type: 'text',
         content: "I'm having trouble accessing your contacts right now. Please try again in a moment.",
         data: {
           error: 'Failed to retrieve contacts'
         }
       };
      }
    }

    // For non-count view_data operations, use conversational handler
    if (intent.action === 'view_data') {
      return await conversationalHandler.handleConversation(
        intent.context.userGoal || 'Data operation',
        context.conversationManager,
        context
      );
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