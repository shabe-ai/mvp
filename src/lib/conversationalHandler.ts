import { openaiClient } from './openaiClient';
import { simplifiedIntentClassifier } from './simplifiedIntentClassifier';
import { intentRouter } from './intentRouter';
import { ConversationManager } from './conversationManager';
import { logger } from './logger';
import { edgeCaseHandler } from './edgeCaseHandler';
import { enhancedRAGHandler } from './enhancedRAGHandler';
import { adaptiveLearningSystem } from './adaptiveLearningSystem';

export interface ConversationalUnderstanding {
  action: string;
  entities: Record<string, any>;
  confidence: number;
  userIntent: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  suggestedActions?: string[];
}

export interface ConversationalResponse {
  message: string;
  action?: string;
  data?: any;
  chartSpec?: any;
  enhancedChart?: any;
  suggestions?: string[];
  needsClarification?: boolean;
  conversationContext?: any;
  ragInsights?: {
    relevantDocuments?: any[];
    documentAnalysis?: any;
    contextEnhancement?: string;
  };
  personalizationApplied?: {
    communicationStyle?: string;
    detailLevel?: string;
    responseLength?: string;
    proactiveSuggestions?: boolean;
  };
  learningInsights?: {
    patternDetected?: string;
    preferenceApplied?: string;
    improvementSuggestion?: string;
  };
}

class ConversationCache {
  private cache = new Map<string, ConversationalUnderstanding>();
  private maxSize = 1000;

  generateKey(message: string, context: any): string {
    const normalizedMessage = message.toLowerCase().trim();
    const contextHash = JSON.stringify({
      userId: context.userId,
      teamId: context.teamId,
      lastAction: context.lastAction
    });
    return `${normalizedMessage}:${contextHash}`;
  }

  get(key: string): ConversationalUnderstanding | undefined {
    return this.cache.get(key);
  }

  set(key: string, understanding: ConversationalUnderstanding): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, understanding);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get all keys for pattern matching
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Delete a specific key
  delete(key: string): void {
    this.cache.delete(key);
  }
}

class EdgeCache {
  private static readonly commonPatterns = new Map([
    // Data viewing patterns
    ['show me contacts', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['show contacts', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['list contacts', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    // Count patterns removed to ensure fresh database queries
    ['show me deals', { action: 'view_data', dataType: 'deals', confidence: 0.95 }],
    ['show deals', { action: 'view_data', dataType: 'deals', confidence: 0.95 }],
    ['list deals', { action: 'view_data', dataType: 'deals', confidence: 0.95 }],
    // Count patterns removed to ensure fresh database queries
    ['show me accounts', { action: 'view_data', dataType: 'accounts', confidence: 0.95 }],
    ['show accounts', { action: 'view_data', dataType: 'accounts', confidence: 0.95 }],
    ['list accounts', { action: 'view_data', dataType: 'accounts', confidence: 0.95 }],
    // Count patterns removed to ensure fresh database queries
    
    // Name listing patterns
    ['what are their names', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['what are the names', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['list their names', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['show me their names', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['who are my contacts', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    ['list contact names', { action: 'view_data', dataType: 'contacts', confidence: 0.95 }],
    
    // Note: Removed count patterns from edge cache to ensure fresh database queries
    
    // Chart patterns
    ['create a chart', { action: 'create_chart', confidence: 0.9 }],
    ['make a chart', { action: 'create_chart', confidence: 0.9 }],
    ['build a chart', { action: 'create_chart', confidence: 0.9 }],
    
    // Email patterns
    ['send email', { action: 'send_email', confidence: 0.9 }],
    ['send an email', { action: 'send_email', confidence: 0.9 }],
    ['email someone', { action: 'send_email', confidence: 0.9 }],
    
    // Help patterns
    ['help', { action: 'general_conversation', confidence: 0.8 }],
    ['what can you do', { action: 'general_conversation', confidence: 0.8 }],
    ['how does this work', { action: 'general_conversation', confidence: 0.8 }],
    
    // Greeting patterns
    ['hello', { action: 'general_conversation', confidence: 0.9 }],
    ['hi', { action: 'general_conversation', confidence: 0.9 }],
    ['hey', { action: 'general_conversation', confidence: 0.9 }],
    ['good morning', { action: 'general_conversation', confidence: 0.9 }],
    ['good afternoon', { action: 'general_conversation', confidence: 0.9 }],
    ['good evening', { action: 'general_conversation', confidence: 0.9 }],
    ['hello how are you', { action: 'general_conversation', confidence: 0.9 }],
    ['hi how are you', { action: 'general_conversation', confidence: 0.9 }],
    ['hey how are you', { action: 'general_conversation', confidence: 0.9 }],
    ['how are you', { action: 'general_conversation', confidence: 0.9 }],
    ['how are you doing', { action: 'general_conversation', confidence: 0.9 }],
    ['what\'s up', { action: 'general_conversation', confidence: 0.9 }],
    ['sup', { action: 'general_conversation', confidence: 0.9 }],
    ['thanks', { action: 'general_conversation', confidence: 0.9 }],
    ['thank you', { action: 'general_conversation', confidence: 0.9 }],
    ['bye', { action: 'general_conversation', confidence: 0.9 }],
    ['goodbye', { action: 'general_conversation', confidence: 0.9 }],
    ['see you', { action: 'general_conversation', confidence: 0.9 }]
  ]);

  static get(message: string): ConversationalUnderstanding | undefined {
    const normalized = message.toLowerCase().trim();
    const pattern = this.commonPatterns.get(normalized);
    
    if (pattern) {
      return {
        action: pattern.action,
        entities: pattern,
        confidence: pattern.confidence,
        userIntent: message,
        needsClarification: false
      };
    }
    
    return undefined;
  }
}

export class ConversationalHandler {
  private static instance: ConversationalHandler;
  private cache = new ConversationCache();

  static getInstance(): ConversationalHandler {
    if (!ConversationalHandler.instance) {
      ConversationalHandler.instance = new ConversationalHandler();
    }
    return ConversationalHandler.instance;
  }

  async handleConversation(
    message: string,
    conversationManager: ConversationManager,
    context: any
  ): Promise<ConversationalResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting conversational handling', { message: message.substring(0, 100) });

      // 1. Check edge case handler first (handles greetings, etc.)
      const edgeCaseContext = {
        userId: context.userId,
        operation: 'conversational_handling',
        input: message,
        timestamp: new Date(),
        retryCount: 0
      };
      
      const edgeCaseResult = await edgeCaseHandler.checkEdgeCases(message, edgeCaseContext);
      if (edgeCaseResult.handled) {
        logger.info('Edge case handled', { result: edgeCaseResult.result });
        return {
          message: edgeCaseResult.result.message,
          suggestions: edgeCaseResult.result.suggestions || [],
          conversationContext: {
            phase: 'exploration',
            action: 'general_conversation',
            referringTo: 'new_request'
          }
        };
      }

      // 2. Check edge cache (fastest path for common patterns)
      // Skip edge cache for count queries to ensure fresh data
      const isCountQuery = message.toLowerCase().includes('how many') || message.toLowerCase().includes('count');
      
      logger.debug('Count query check', { 
        message: message.substring(0, 100), 
        isCountQuery,
        userId: context.userId 
      });
      
              // Force count queries to go through structured analysis
        if (isCountQuery) {
          logger.info('Force routing count query to structured analysis', { 
            userId: context.userId 
          });
        
                  // Clear any cached responses for count queries
          this.clearCacheForPattern('how many');
          this.clearCacheForPattern('count');
          
          // Clear performance optimizer cache for fresh data
          try {
            const { performanceOptimizer } = await import('@/lib/performanceOptimizer');
            performanceOptimizer.clearCache();
            logger.debug('Cleared performance optimizer cache for count query', { 
              userId: context.userId 
            });
          } catch (error) {
            logger.warn('Failed to clear performance optimizer cache', { 
              error: error instanceof Error ? error.message : String(error),
              userId: context.userId 
            });
          }
        
        const structured = await this.analyzeWithStructured(message, conversationManager);
        if (structured && structured.confidence > 0.7) {
          console.log('🔍 Using structured analysis for count query');
          // Route directly to intent router for count queries to avoid timeout
          const simplifiedIntent = {
            action: structured.action as 'create_chart' | 'modify_chart' | 'analyze_data' | 'export_data' | 'explore_data' | 'view_data' | 'send_email' | 'create_contact' | 'update_contact' | 'delete_contact' | 'create_account' | 'update_account' | 'delete_account' | 'create_deal' | 'update_deal' | 'delete_deal' | 'create_activity' | 'update_activity' | 'delete_activity' | 'general_conversation',
            confidence: structured.confidence,
            originalMessage: message,
            entities: structured.entities,
            context: {
              referringTo: 'new_request' as const,
              userGoal: message
            },
            metadata: {
              isAmbiguous: structured.needsClarification,
              needsClarification: structured.needsClarification,
              clarificationQuestion: structured.clarificationQuestion
            }
          };
          return await intentRouter.routeIntent(simplifiedIntent, { ...context, conversationManager });
        } else {
          console.log('🔍 Structured analysis failed or low confidence for count query, forcing structured routing anyway');
          // Force structured routing even if confidence is low for count queries
          if (structured) {
            console.log('🔍 Using structured analysis with lower confidence for count query');
            // Route directly to intent router for count queries to avoid timeout
            const simplifiedIntent = {
              action: structured.action as 'create_chart' | 'modify_chart' | 'analyze_data' | 'export_data' | 'explore_data' | 'view_data' | 'send_email' | 'create_contact' | 'update_contact' | 'delete_contact' | 'create_account' | 'update_account' | 'delete_account' | 'create_deal' | 'update_deal' | 'delete_deal' | 'create_activity' | 'update_activity' | 'delete_activity' | 'general_conversation',
              confidence: structured.confidence,
              originalMessage: message,
              entities: structured.entities,
              context: {
                referringTo: 'new_request' as const,
                userGoal: message
              },
              metadata: {
                isAmbiguous: structured.needsClarification,
                needsClarification: structured.needsClarification,
                clarificationQuestion: structured.clarificationQuestion
              }
            };
            return await intentRouter.routeIntent(simplifiedIntent, { ...context, conversationManager });
          } else {
            // If structured analysis completely failed, create a basic count intent
            console.log('🔍 Creating basic count intent for query:', message);
            const simplifiedIntent = {
              action: 'view_data' as const,
              confidence: 0.8,
              originalMessage: message,
              entities: { dataType: 'contacts' },
              context: {
                referringTo: 'new_request' as const,
                userGoal: message
              },
              metadata: {
                isAmbiguous: false,
                needsClarification: false
              }
            };
            // Route directly to intent router for count queries to avoid timeout
            return await intentRouter.routeIntent(simplifiedIntent, { ...context, conversationManager });
          }
        }
      }
      
      if (!isCountQuery) {
        const edgeResult = EdgeCache.get(message);
        if (edgeResult) {
          logger.info('Edge cache hit', { action: edgeResult.action, confidence: edgeResult.confidence });
          return await this.executeAction(edgeResult, conversationManager, context);
        }
      } else {
        console.log('🔍 Skipping edge cache for count query');
      }

      // 2. Try structured analysis (reliable and fast)
      try {
        const structured = await this.analyzeWithStructured(message, conversationManager);
        if (structured && structured.confidence > 0.7) {
          logger.info('Using structured analysis', { action: structured.action, confidence: structured.confidence });
          return await this.executeAction(structured, conversationManager, context);
        }
      } catch (error) {
        logger.warn('Structured analysis failed, using GPT fallback', { error: error instanceof Error ? error.message : String(error) });
      }

      // 3. Check cached GPT result (skip for count queries)
      if (!isCountQuery) {
        try {
          const cached = await this.getCachedUnderstanding(message, context);
          if (cached) {
            logger.info('Using cached GPT understanding', { action: cached.action, confidence: cached.confidence });
            return await this.executeAction(cached, conversationManager, context);
          }
        } catch (error) {
          logger.warn('Cache lookup failed, proceeding to fresh GPT analysis', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      // 4. Fallback to fresh GPT analysis
      logger.info('Using fresh GPT analysis');
      const understanding = await this.analyzeWithGPT(message, context);
      return await this.executeAction(understanding, conversationManager, context);

    } catch (error) {
      logger.error('Conversational handling failed', undefined, { error: error instanceof Error ? error.message : String(error) });
      
      // Ultimate fallback - return a helpful response
      return this.getFallbackResponse(message);
    } finally {
      const duration = Date.now() - startTime;
      logger.info('Conversational handling completed', { duration });
    }
  }

  private async analyzeWithStructured(
    message: string,
    conversationManager: ConversationManager
  ): Promise<ConversationalUnderstanding | null> {
    try {
      console.log('🔍 Starting structured analysis for:', message);
      const intent = await simplifiedIntentClassifier.classifyIntent(message, conversationManager.getState());
      
      console.log('🔍 Structured analysis result:', {
        action: intent.action,
        dataType: intent.entities.dataType,
        confidence: intent.confidence
      });
      
      return {
        action: intent.action,
        entities: intent.entities,
        confidence: intent.confidence,
        userIntent: message,
        needsClarification: intent.metadata?.needsClarification || false,
        clarificationQuestion: intent.metadata?.clarificationQuestion
      };
    } catch (error) {
      logger.warn('Structured analysis failed', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async getCachedUnderstanding(
    message: string,
    context: any
  ): Promise<ConversationalUnderstanding | null> {
    const key = this.cache.generateKey(message, context);
    return this.cache.get(key) || null;
  }

  private async analyzeWithGPT(
    message: string,
    context: any
  ): Promise<ConversationalUnderstanding> {
    try {
      const prompt = this.buildGPTPrompt(message, context);
      
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful CRM assistant. Understand what the user wants and extract structured information for actions. Be conversational but precise."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }, {
        userId: context.userId,
        operation: 'conversational_understanding',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT');
      }

      try {
        // Try to extract JSON from the response (in case GPT returns markdown)
        let jsonContent = content;
        if (content.includes('```json')) {
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
        }
        
        const result = JSON.parse(jsonContent);
        
        const understanding: ConversationalUnderstanding = {
          action: result.action || 'general_conversation',
          entities: result.entities || {},
          confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1),
          userIntent: message,
          needsClarification: result.needsClarification || false,
          clarificationQuestion: result.clarificationQuestion,
          suggestedActions: result.suggestedActions
        };

        // Cache the result
        const key = this.cache.generateKey(message, context);
        this.cache.set(key, understanding);

        return understanding;
      } catch (parseError) {
        logger.error('Failed to parse GPT response', undefined, { content, error: parseError instanceof Error ? parseError.message : String(parseError) });
        
        // Try to extract intent from the content even if JSON parsing failed
        const lowerContent = content.toLowerCase();
        let action = 'general_conversation';
        let needsClarification = true;
        let clarificationQuestion = "I'm not sure what you'd like me to do. Could you please clarify?";
        
        // Simple intent extraction from content
        if (lowerContent.includes('contact') || lowerContent.includes('name')) {
          action = 'view_data';
          needsClarification = false;
          clarificationQuestion = "I'm not sure what you'd like me to do. Could you please clarify?";
        } else if (lowerContent.includes('chart') || lowerContent.includes('visualize')) {
          action = 'create_chart';
        } else if (lowerContent.includes('analyze') || lowerContent.includes('analysis')) {
          action = 'analyze_data';
        }
        
        return {
          action,
          entities: {},
          confidence: 0.3,
          userIntent: message,
          needsClarification,
          clarificationQuestion
        };
      }
    } catch (gptError) {
      logger.error('GPT analysis failed', undefined, { error: gptError instanceof Error ? gptError.message : String(gptError) });
      
      // Return a safe fallback
      return {
        action: 'general_conversation',
        entities: {},
        confidence: 0.3,
        userIntent: message,
        needsClarification: true,
        clarificationQuestion: "I'm having trouble processing your request. Could you try rephrasing it?"
      };
    }
  }

  private buildGPTPrompt(message: string, context: any): string {
    return `
Analyze this user message and extract structured information for CRM actions.

**User Message:** "${message}"

**Available Actions:**
- view_data: Show contacts, deals, accounts, or activities
- create_chart: Create charts and visualizations
- modify_chart: Change existing charts
- send_email: Send emails to contacts
- create_contact: Create new contacts
- update_contact: Update existing contacts
- delete_contact: Delete contacts
- create_account: Create new accounts
- update_account: Update existing accounts
- delete_account: Delete accounts
- create_deal: Create new deals
- update_deal: Update existing deals
- delete_deal: Delete deals
- create_activity: Create new activities
- update_activity: Update existing activities
- delete_activity: Delete activities
- general_conversation: General chat, questions, help

**Context:**
- User: ${context.userProfile?.name || 'Unknown'}
- Company: ${context.companyData?.name || 'Unknown'}
- Recent actions: ${context.lastAction || 'None'}

**Instructions:**
1. Understand the user's intent naturally
2. Extract relevant entities (names, fields, values, etc.)
3. Map to the most appropriate action
4. Set confidence based on clarity (0.5-1.0)
5. Identify if clarification is needed

**Return JSON:**
{
  "action": "action_name",
  "entities": {
    "contactName": "extracted name",
    "field": "field to update",
    "value": "new value",
    "dataType": "contacts|deals|accounts|activities",
    "chartType": "line|bar|pie|area|scatter"
  },
  "confidence": 0.8,
  "needsClarification": false,
  "clarificationQuestion": "question if needed",
  "suggestedActions": ["action1", "action2"]
}

**Examples:**
- "Show me contacts" → {"action": "view_data", "entities": {"dataType": "contacts"}, "confidence": 0.95}
- "Update John's email" → {"action": "update_contact", "entities": {"contactName": "John", "field": "email"}, "confidence": 0.8, "needsClarification": true, "clarificationQuestion": "What's John's new email address?"}
- "Create a pie chart of deals" → {"action": "create_chart", "entities": {"chartType": "pie", "dataType": "deals"}, "confidence": 0.9}
- "Send email to Sarah" → {"action": "send_email", "entities": {"contactName": "Sarah"}, "confidence": 0.8, "needsClarification": true, "clarificationQuestion": "What would you like to say to Sarah?"}
`;
  }

  private async executeAction(
    understanding: ConversationalUnderstanding,
    conversationManager: ConversationManager,
    context: any
  ): Promise<ConversationalResponse> {
    const startTime = Date.now();
    
    try {
      // Convert conversational understanding to structured intent
      const structuredIntent = {
        action: understanding.action as any, // Type assertion for compatibility
        confidence: understanding.confidence,
        originalMessage: understanding.userIntent,
        entities: understanding.entities,
        context: { referringTo: 'new_request' as const },
        metadata: {
          isAmbiguous: false,
          needsClarification: understanding.needsClarification,
          clarificationQuestion: understanding.clarificationQuestion
        }
      };
      
      console.log('🚀 Structured intent:', structuredIntent);

      // Phase 2: Enhanced RAG - Integrate RAG results and document analysis
      const ragEnhancedResponse = await enhancedRAGHandler.enhanceWithRAG(
        understanding.userIntent,
        structuredIntent,
        conversationManager.getState(),
        context
      );
      
      // Phase 3: Adaptive Learning - Apply learning and personalization
      const adaptiveResponse = await adaptiveLearningSystem.generateAdaptiveResponse(
        ragEnhancedResponse.message,
        context.userId,
        structuredIntent.action,
        context
      );
      
      // Log interaction for learning (Phase 3)
      await adaptiveLearningSystem.logInteraction({
        userId: context.userId,
        message: understanding.userIntent,
        intent: structuredIntent.action,
        entities: structuredIntent.entities,
        response: adaptiveResponse.message,
        success: !structuredIntent.metadata.needsClarification,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        context: {
          sessionId: 'session-id',
          conversationPhase: conversationManager.getState().currentContext.conversationPhase.current,
          referringTo: structuredIntent.context.referringTo || 'new_request'
        }
      });

      logger.info('About to call intent router', {
        structuredIntent,
        contextKeys: Object.keys(context),
        userId: context.userId
      });

      // Use existing intent router with timeout
      const response = await this.withTimeout(
        intentRouter.routeIntent(structuredIntent, { ...context, conversationManager }),
        5000 // 5 second timeout
      );

      logger.info('Intent router call completed', {
        responseReceived: !!response,
        responseType: response?.type,
        userId: context.userId
      });

      logger.info('Intent router response received', {
        responseType: response.type,
        responseContent: response.content,
        responseMessage: response.message,
        hasContent: !!response.content,
        hasMessage: !!response.message,
        userId: context.userId
      });

      // Merge all phases and enhance response with conversational elements
      // Use response.content if available (from DataIntentHandler), otherwise use adaptiveResponse.message
      const responseMessage = response.content || adaptiveResponse.message;
      
      logger.info('Final response message determined', {
        responseMessage,
        source: response.content ? 'response.content' : 'adaptiveResponse.message',
        userId: context.userId
      });
      
      const finalResponse = {
        ...response,
        message: this.enhanceResponseMessage(responseMessage, understanding),
        suggestions: adaptiveResponse.suggestions || understanding.suggestedActions || response.suggestions,
        ragInsights: ragEnhancedResponse.ragInsights,
        personalizationApplied: adaptiveResponse.personalizationApplied,
        learningInsights: adaptiveResponse.learningInsights
      };
      
      logger.info('Final conversational response', {
        finalMessage: finalResponse.message,
        hasMessage: !!finalResponse.message,
        userId: context.userId
      });
      
      return finalResponse;
    } catch (error) {
      logger.error('Action execution failed', undefined, { 
        action: understanding.action, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Return a graceful error response
      return {
        message: "I encountered an issue while processing your request. Let me help you with something else:",
        suggestions: [
          "Show me my contacts",
          "Create a simple chart",
          "View my deals",
          "Help me with a specific task"
        ],
        conversationContext: {
          phase: 'exploration',
          action: 'general_conversation',
          referringTo: 'new_request'
        }
      };
    }
  }

  // Helper method to add timeout to any promise
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private enhanceResponseMessage(
    originalMessage: string,
    understanding: ConversationalUnderstanding
  ): string {
    // Add conversational elements to make responses more natural
    if (understanding.confidence < 0.7) {
      return `I think you want me to ${understanding.action.replace('_', ' ')}. ${originalMessage}`;
    }
    
    return originalMessage;
  }

  // Public method to clear cache (useful for testing)
  clearCache(): void {
    this.cache.clear();
  }

  // Clear cache for specific patterns (useful for data updates)
  clearCacheForPattern(pattern: string): void {
    const keysToDelete: string[] = [];
    const allKeys = this.cache.getKeys();
    
    for (const key of allKeys) {
      if (key.toLowerCase().includes(pattern.toLowerCase())) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    logger.info('Cleared cache for pattern', { pattern, clearedCount: keysToDelete.length });
  }

  // Ultimate fallback response when everything else fails
  private getFallbackResponse(message: string): ConversationalResponse {
    logger.warn('Using ultimate fallback response', { message: message.substring(0, 100) });
    
    return {
      message: "I'm having trouble understanding that right now. Let me help you with something I can do well. You can:",
      suggestions: [
        "Show me my contacts",
        "Create a chart of my deals",
        "View my accounts",
        "Help me with a specific task"
      ],
      conversationContext: {
        phase: 'exploration',
        action: 'general_conversation',
        referringTo: 'new_request'
      }
    };
  }
}

export const conversationalHandler = ConversationalHandler.getInstance();
