import { openaiClient } from './openaiClient';
import { userDataEnhancer } from './userDataEnhancer';
import { logger } from './logger';

export interface SimplifiedIntent {
  action: 'create_chart' | 'modify_chart' | 'analyze_data' | 'export_data' | 'explore_data' | 'view_data' | 'send_email' | 
          'create_contact' | 'update_contact' | 'delete_contact' | 
          'create_account' | 'update_account' | 'delete_account' |
          'create_deal' | 'update_deal' | 'delete_deal' |
          'create_activity' | 'update_activity' | 'delete_activity' |
          'general_conversation';
  confidence: number;
  originalMessage: string;
  entities: Record<string, any>;
  context: {
    referringTo?: 'current_chart' | 'previous_chart' | 'new_request' | 'existing_data';
    userGoal?: string;
  };
  metadata: {
    isAmbiguous?: boolean;
    needsClarification?: boolean;
    clarificationQuestion?: string;
  };
}

export class SimplifiedIntentClassifier {
  private static instance: SimplifiedIntentClassifier;

  static getInstance(): SimplifiedIntentClassifier {
    if (!SimplifiedIntentClassifier.instance) {
      SimplifiedIntentClassifier.instance = new SimplifiedIntentClassifier();
    }
    return SimplifiedIntentClassifier.instance;
  }

  async classifyIntent(message: string, conversationState: any): Promise<SimplifiedIntent> {
    try {
      logger.info('Starting simplified intent classification', { 
        message: message.substring(0, 100),
        userId: conversationState.metadata?.userId 
      });
      
      // Build a simple, direct prompt for GPT
      const basePrompt = this.buildSimpleClassificationPrompt(message, conversationState);
      
      // Enhance prompt with RAG (user data examples) - keeping RAG intact
      const enhancedPrompt = userDataEnhancer.enhancePrompt(basePrompt, message);
      
      logger.debug('Using RAG-enhanced prompt for simplified intent classification', { 
        userId: conversationState.metadata?.userId 
      });
      
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: enhancedPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }, {
        userId: conversationState.metadata?.userId,
        operation: 'simplified_intent_classification',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from GPT for intent classification');
      }

      // Parse the JSON response
      let parsedIntent;
      try {
        parsedIntent = JSON.parse(content);
      } catch (parseError) {
        logger.error('Failed to parse GPT response as JSON', parseError instanceof Error ? parseError : new Error(String(parseError)), { 
          contentPreview: content.substring(0, 200),
          userId: conversationState.metadata?.userId 
        });
        // Fallback to general conversation
        return this.createFallbackIntent(message, 'Failed to parse intent response');
      }

      // Validate and normalize the intent
      const normalizedIntent = this.normalizeIntent(parsedIntent, message);
      
      logger.info('Simplified intent classification result', {
        action: normalizedIntent.action,
        confidence: normalizedIntent.confidence,
        entityCount: Object.keys(normalizedIntent.entities).length,
        userId: conversationState.metadata?.userId
      });

      return normalizedIntent;

    } catch (error) {
      logger.error('Simplified intent classification failed', error instanceof Error ? error : undefined, {
        message,
        userId: conversationState.metadata?.userId
      });
      
      return this.createFallbackIntent(message, 'Intent classification failed');
    }
  }

  private buildSimpleClassificationPrompt(message: string, conversationState: any): string {
    const conversationContext = this.buildConversationContext(conversationState);
    
    return `You are an AI assistant that classifies user intents for a CRM and data analysis system.

Available actions:
- create_chart: User wants to create a chart or visualization
- modify_chart: User wants to modify an existing chart
- analyze_data: User wants to analyze data or get insights
- export_data: User wants to export or download data
- explore_data: User wants to explore or browse data
- view_data: User wants to view specific data (contacts, deals, accounts, activities)
- send_email: User wants to send an email
- create_contact: User wants to create a new contact
- update_contact: User wants to update an existing contact
- delete_contact: User wants to delete a contact
- create_account: User wants to create a new account
- update_account: User wants to update an existing account
- delete_account: User wants to delete an account
- create_deal: User wants to create a new deal
- update_deal: User wants to update an existing deal
- delete_deal: User wants to delete a deal
- create_activity: User wants to create a new activity
- update_activity: User wants to update an existing activity
- delete_activity: User wants to delete an activity
- general_conversation: General chat, questions, or unclear requests

Examples:
- "how many contacts do i have" → action: "view_data", entities: {"dataType": "contacts", "query": "count"}
- "show me my contacts" → action: "view_data", entities: {"dataType": "contacts"}
- "what are the names of the contacts" → action: "view_data", entities: {"dataType": "contacts", "query": "list"}
- "list all contacts" → action: "view_data", entities: {"dataType": "contacts", "query": "list"}
- "show contact details" → action: "view_data", entities: {"dataType": "contacts", "query": "details"}
- "count my deals" → action: "view_data", entities: {"dataType": "deals", "query": "count"}
- "how many accounts" → action: "view_data", entities: {"dataType": "accounts", "query": "count"}
- "show me all deals" → action: "view_data", entities: {"dataType": "deals", "query": "list"}
- "what activities do i have" → action: "view_data", entities: {"dataType": "activities", "query": "list"}
- "list my accounts" → action: "view_data", entities: {"dataType": "accounts", "query": "list"}
- "show contact emails" → action: "view_data", entities: {"dataType": "contacts", "query": "details"}
- "create a bar chart" → action: "create_chart", entities: {"chartType": "bar"}
- "send email to john" → action: "send_email", entities: {"recipient": "john"}

Extract relevant entities like:
- chartType: line, bar, pie, area, scatter
- dataType: contacts, deals, accounts, activities
- dimension: stage, status, industry, type, source, probability
- contactName, accountName, dealName, activitySubject
- field, value, date, amount, email, phone, company, industry, website
- recipient, subject, content_type (for emails)
- query: count, list, show, display (for view_data actions)

Conversation context: ${conversationContext}

Return ONLY a JSON object with this exact structure:
{
  "action": "action_name",
  "confidence": 0.0-1.0,
  "entities": { "entity_name": "value" },
  "context": { "referringTo": "new_request|current_chart|previous_chart|existing_data" },
  "metadata": {
    "isAmbiguous": false,
    "needsClarification": false,
    "clarificationQuestion": null
  }
}

If the user's intent is unclear or ambiguous, set needsClarification to true and provide a helpful clarificationQuestion.`;
  }

  private buildConversationContext(conversationState: any): string {
    if (!conversationState || !conversationState.memory || !conversationState.memory.sessionHistory) {
      return 'No previous context available';
    }

    const history = conversationState.memory.sessionHistory;
    const recentMessages = history.slice(-3); // Last 3 messages for context

    if (recentMessages.length === 0) {
      return 'New conversation';
    }

    const contextParts = recentMessages.map((msg: any) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const action = msg.conversationContext?.action || 'general';
      return `${role}: ${action}`;
    });

    return `Recent context: ${contextParts.join(', ')}`;
  }

  private normalizeIntent(parsedIntent: any, originalMessage: string): SimplifiedIntent {
    // Ensure required fields exist
    const normalized: SimplifiedIntent = {
      action: this.validateAction(parsedIntent.action),
      confidence: this.validateConfidence(parsedIntent.confidence),
      originalMessage,
      entities: parsedIntent.entities || {},
      context: {
        referringTo: parsedIntent.context?.referringTo || 'new_request'
      },
      metadata: {
        isAmbiguous: parsedIntent.metadata?.isAmbiguous || false,
        needsClarification: parsedIntent.metadata?.needsClarification || false,
        clarificationQuestion: parsedIntent.metadata?.clarificationQuestion || undefined
      }
    };

    return normalized;
  }

  private validateAction(action: any): SimplifiedIntent['action'] {
    const validActions = [
      'create_chart', 'modify_chart', 'analyze_data', 'export_data', 'explore_data', 'view_data', 'send_email',
      'create_contact', 'update_contact', 'delete_contact',
      'create_account', 'update_account', 'delete_account',
      'create_deal', 'update_deal', 'delete_deal',
      'create_activity', 'update_activity', 'delete_activity',
      'general_conversation'
    ];

    if (typeof action === 'string' && validActions.includes(action)) {
      return action as SimplifiedIntent['action'];
    }

    console.warn('Invalid action received:', action);
    return 'general_conversation';
  }

  private validateConfidence(confidence: any): number {
    const num = typeof confidence === 'number' ? confidence : parseFloat(confidence);
    if (isNaN(num) || num < 0 || num > 1) {
      console.warn('Invalid confidence received:', confidence);
      return 0.5;
    }
    return num;
  }

  private createFallbackIntent(message: string, reason: string): SimplifiedIntent {
    console.warn('Creating fallback intent:', reason);
    
    return {
      action: 'general_conversation',
      confidence: 0.3,
      originalMessage: message,
      entities: {},
      context: {
        referringTo: 'new_request'
      },
      metadata: {
        isAmbiguous: true,
        needsClarification: true,
        clarificationQuestion: "I'm not sure what you'd like me to help you with. Could you please be more specific?"
      }
    };
  }
}

export const simplifiedIntentClassifier = SimplifiedIntentClassifier.getInstance();
