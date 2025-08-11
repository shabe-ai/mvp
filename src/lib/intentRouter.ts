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

// CRUD Intent Handler
export class CrudIntentHandler implements IntentHandler {
  canHandle(intent: Intent): boolean {
    return ['create_contact', 'update_contact', 'delete_contact', 'send_email'].includes(intent.action);
  }

  async handle(intent: Intent, conversationManager: ConversationManager, context: any): Promise<ConversationResponse> {
    console.log('👤 Handling CRUD intent:', intent.action);
    
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
      message: "I'm not sure how to handle that request yet. Could you please rephrase?",
      needsClarification: true,
      conversationContext: {
        phase: conversationManager.getState().currentContext.conversationPhase.current,
        action: 'general_fallback',
        referringTo: intent.context.referringTo
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
intentRouter.registerHandler(new CrudIntentHandler());
intentRouter.registerHandler(new GeneralConversationHandler()); 