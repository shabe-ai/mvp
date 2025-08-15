import { SimplifiedIntent } from './simplifiedIntentClassifier';
import { conversationalHandler } from './conversationalHandler';
import { logger } from './logger';

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
      userId: context.userId
    });

    // Find the appropriate handler
    const handler = this.handlers.find(h => h.canHandle(intent));
    
    if (handler) {
      logger.info('Found handler for intent', {
        action: intent.action,
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
      intent.userGoal || 'General conversation',
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
      intent.userGoal || 'Chart operation',
      context.conversationManager,
      context
    );
  }
}

// Data Intent Handler
class DataIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'query_data' || 
           intent.action === 'analyze_data' || 
           intent.action === 'export_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling data intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for data operations
    return await conversationalHandler.handleConversation(
      intent.userGoal || 'Data operation',
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
      intent.userGoal || 'CRUD operation',
      context.conversationManager,
      context
    );
  }
}

// Email Intent Handler
class EmailIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'send_email' || 
           intent.action === 'draft_email' || 
           intent.action === 'schedule_email';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling email intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for email operations
    return await conversationalHandler.handleConversation(
      intent.userGoal || 'Email operation',
      context.conversationManager,
      context
    );
  }
}

// Analysis Intent Handler
class AnalysisIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'analyze_performance' || 
           intent.action === 'generate_report' || 
           intent.action === 'provide_insights';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling analysis intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for analysis operations
    return await conversationalHandler.handleConversation(
      intent.userGoal || 'Analysis operation',
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