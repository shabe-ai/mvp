import { openaiClient } from '@/lib/openaiClient';
import { ConversationState } from './conversationManager';
import { nlpProcessor, Entity, ContextualReference } from './nlpProcessor';
import { userDataEnhancer } from './userDataEnhancer';

export interface Intent {
  action: 'create_chart' | 'modify_chart' | 'analyze_data' | 'export_data' | 'explore_data' | 'view_data' | 'send_email' | 'create_contact' | 'update_contact' | 'delete_contact' | 'general_conversation';
  confidence: number;
  originalMessage: string; // The original user message
  entities: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    dataType?: 'deals' | 'contacts' | 'accounts' | 'activities';
    dimension?: 'stage' | 'status' | 'industry' | 'type' | 'source' | 'probability';
    context?: 'existing' | 'new' | 'modification' | 'reference';
    action?: 'show' | 'hide' | 'change' | 'analyze' | 'export' | 'predict';
    target?: string; // What the user is referring to (e.g., "the chart", "deals data")
    contactName?: string;
    field?: string;
    value?: string;
    date?: string;
    amount?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  context: {
    referringTo?: 'current_chart' | 'previous_chart' | 'new_request' | 'existing_data';
    userGoal?: string;
    clarification?: string;
  };
  metadata: {
    isAmbiguous: boolean;
    needsClarification: boolean;
    clarificationQuestion?: string;
  };
  nlpData?: {
    entities: Entity[];
    references: ContextualReference[];
    needsClarification: boolean;
    clarificationMessage?: string;
  };
}

export class IntentClassifier {
  private static instance: IntentClassifier;

  private constructor() {}

  static getInstance(): IntentClassifier {
    if (!IntentClassifier.instance) {
      IntentClassifier.instance = new IntentClassifier();
    }
    return IntentClassifier.instance;
  }

  async classifyIntent(message: string, conversationState: ConversationState): Promise<Intent> {
    try {
      console.log('🧠 Starting intent classification for:', message);
      
      // First, process the message with NLP to extract entities and resolve references
      const nlpResult = await nlpProcessor.processMessage(message, conversationState.metadata.userId);
      
      console.log('🧠 NLP processing result:', {
        entities: nlpResult.entities.length,
        references: nlpResult.references.length,
        needsClarification: nlpResult.needsClarification
      });
      
      // If NLP needs clarification, return early with clarification intent
      if (nlpResult.needsClarification) {
        return {
          action: 'general_conversation',
          confidence: 0.3,
          originalMessage: message,
          entities: {},
          context: { referringTo: 'new_request' },
          metadata: {
            isAmbiguous: true,
            needsClarification: true,
            clarificationQuestion: nlpResult.clarificationMessage
          },
          nlpData: {
            entities: nlpResult.entities,
            references: nlpResult.references,
            needsClarification: true,
            clarificationMessage: nlpResult.clarificationMessage
          }
        };
      }
      
      const conversationContext = this.buildConversationContext(conversationState);
      const basePrompt = this.buildClassificationPrompt(message, conversationContext, nlpResult);
      
      // Enhance prompt with RAG (user data examples)
      const enhancedPrompt = userDataEnhancer.enhancePrompt(basePrompt, message);
      
      console.log('🧠 Using RAG-enhanced prompt for intent classification');
      
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert intent classifier for a CRM analytics system. Your job is to understand what the user wants to do and extract relevant entities. ALWAYS return valid JSON only."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }, {
        userId: conversationState.metadata.userId,
        operation: 'intent_classification',
        model: 'gpt-4'
      });

      let result;
      try {
        const content = response.choices[0]?.message?.content || '{}';
        console.log('🧠 Raw LLM response:', content);
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('❌ Raw response was:', response.choices[0]?.message?.content);
        
        // Try to extract JSON from the response if it contains other text
        const content = response.choices[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully extracted JSON from response');
          } catch (secondError) {
            console.error('❌ Failed to extract JSON:', secondError);
            return this.getFallbackIntent(message);
          }
        } else {
          return this.getFallbackIntent(message);
        }
      }
      
      console.log('🧠 Intent classification result:', result);
      
      return this.validateAndEnhanceIntent(result, message, conversationState, nlpResult);
      
    } catch (error) {
      console.error('❌ Intent classification error:', error);
      return this.getFallbackIntent(message);
    }
  }

  private buildConversationContext(state: ConversationState): string {
    let context = `Current conversation context:\n`;
    context += `- Session: ${state.metadata.sessionId}\n`;
    context += `- Interaction count: ${state.memory.interactionCount}\n`;
    context += `- Current phase: ${state.currentContext.conversationPhase.current}\n`;
    
    if (state.currentContext.activeChart) {
      const chart = state.currentContext.activeChart;
      context += `- Active chart: ${chart.title} (${chart.chartType} chart of ${chart.dataType} by ${chart.dimension})\n`;
    }
    
    if (state.memory.recentTopics.length > 0) {
      context += `- Recent topics: ${state.memory.recentTopics.slice(0, 3).join(', ')}\n`;
    }
    
    if (state.currentContext.lastAction) {
      context += `- Last action: ${state.currentContext.lastAction}\n`;
    }
    
    // Add information about pending confirmations
    const lastMessage = state.memory.sessionHistory[state.memory.sessionHistory.length - 1];
    if (lastMessage?.conversationContext?.action === 'update_contact' && 
        lastMessage?.conversationContext?.phase === 'confirmation') {
      context += `- PENDING CONFIRMATION: Contact update for ${lastMessage.conversationContext.contactName} (${lastMessage.conversationContext.field} = ${lastMessage.conversationContext.value})\n`;
    }
    
    return context;
  }

  private buildClassificationPrompt(message: string, conversationContext: string, nlpResult: any): string {
    const entityInfo = nlpResult.entities.length > 0 
      ? `\n**Extracted Entities:**\n${nlpResult.entities.map((e: any) => `- ${e.type}: "${e.value}" (confidence: ${e.confidence})`).join('\n')}`
      : '\n**No specific entities extracted**';
    
    const referenceInfo = nlpResult.references.length > 0
      ? `\n**Contextual References:**\n${nlpResult.references.map((r: any) => `- ${r.type}: "${r.value}" (${r.possibleMatches.length} possible matches)`).join('\n')}`
      : '\n**No contextual references found**';

    // Check if this looks like a confirmation response
    const isLikelyConfirmation = this.isConfirmationResponse(message);
    const confirmationContext = isLikelyConfirmation ? `
**CONFIRMATION DETECTED:**
- User said: "${message}"
- If there's a pending confirmation in the conversation context, classify this as the action being confirmed
- Set needsClarification to false for confirmation responses
` : '';

    return `
You are an intent classifier for a CRM system. Analyze the user message and return ONLY a valid JSON object.

${conversationContext}${confirmationContext}

User message: "${message}"${entityInfo}${referenceInfo}

Return ONLY a JSON object with this exact structure (no other text):
{
  "action": "create_chart|modify_chart|analyze_data|export_data|explore_data|view_data|send_email|create_contact|update_contact|delete_contact|general_conversation",
  "confidence": 0.95,
  "entities": {
    "chartType": "line|bar|pie|area|scatter",
    "dataType": "deals|contacts|accounts|activities",
    "dimension": "stage|status|industry|type|source|probability",
    "context": "existing|new|modification|reference",
    "action": "show|hide|change|analyze|export|predict",
    "target": "string describing what user is referring to",
    "contactName": "extracted contact name",
    "field": "field to update",
    "value": "new value",
    "date": "extracted date",
    "amount": "extracted amount",
    "email": "extracted email",
    "phone": "extracted phone",
    "company": "extracted company"
  },
  "context": {
    "referringTo": "current_chart|previous_chart|new_request|existing_data",
    "userGoal": "string describing what user wants to accomplish",
    "clarification": "any clarification needed"
  },
  "metadata": {
    "isAmbiguous": false,
    "needsClarification": false,
    "clarificationQuestion": "question to ask if clarification needed"
  }
}

**IMPORTANT RULES:**
1. Return ONLY valid JSON - no explanations or additional text
2. For confirmation responses (yes, confirm, correct, ok, sure), set action to the action being confirmed
3. For confirmation responses, set needsClarification to false
4. Extract entities from the conversation context if available
5. Use high confidence (0.9+) for clear requests
6. Use lower confidence (0.5-0.7) for ambiguous requests

**Examples:**
- "yes" after contact update confirmation → action: "update_contact", needsClarification: false
- "update john's email to john@example.com" → action: "update_contact", contactName: "john", field: "email", value: "john@example.com"
- "show me contacts" → action: "view_data", dataType: "contacts"
- "make it a pie chart" → action: "modify_chart", chartType: "pie"
`;
  }

  private validateAndEnhanceIntent(result: any, message: string, conversationState: ConversationState, nlpResult: any): Intent {
    // Validate required fields
    const intent: Intent = {
      action: result.action || 'general_conversation',
      confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
      originalMessage: message,
      entities: {
        chartType: result.entities?.chartType,
        dataType: result.entities?.dataType,
        dimension: result.entities?.dimension,
        context: result.entities?.context,
        action: result.entities?.action,
        target: result.entities?.target,
        contactName: result.entities?.contactName,
        field: result.entities?.field,
        value: result.entities?.value,
        date: result.entities?.date,
        amount: result.entities?.amount,
        email: result.entities?.email,
        phone: result.entities?.phone,
        company: result.entities?.company
      },
      context: {
        referringTo: result.context?.referringTo,
        userGoal: result.context?.userGoal,
        clarification: result.context?.clarification
      },
      metadata: {
        isAmbiguous: result.metadata?.isAmbiguous || false,
        needsClarification: result.metadata?.needsClarification || false,
        clarificationQuestion: result.metadata?.clarificationQuestion
      },
      nlpData: {
        entities: nlpResult.entities,
        references: nlpResult.references,
        needsClarification: nlpResult.needsClarification,
        clarificationMessage: nlpResult.clarificationMessage
      }
    };

    // Enhance intent with NLP data
    this.enhanceIntentWithNLPData(intent, nlpResult);
    
    // Enhance intent with conversation context
    this.enhanceIntentWithContext(intent, message, conversationState);
    
    // Enhance intent with NLP data
    this.enhanceIntentWithNLPData(intent, nlpResult);
    
    // Validate confidence and set clarification if needed
    if (intent.confidence < 0.7) {
      intent.metadata.needsClarification = true;
      intent.metadata.clarificationQuestion = this.generateClarificationQuestion(intent, message);
    }

    console.log('🧠 Enhanced intent:', intent);
    return intent;
  }

  private enhanceIntentWithContext(intent: Intent, message: string, conversationState: ConversationState): void {
    const lowerMessage = message.toLowerCase();
    
    // Check if user is referring to current chart
    if (conversationState.currentContext.activeChart) {
      const chart = conversationState.currentContext.activeChart;
      
      // Check for pronouns and references
      const pronouns = ['it', 'this', 'that', 'the chart', 'current'];
      const hasPronoun = pronouns.some(pronoun => lowerMessage.includes(pronoun));
      
      // Check for chart type references
      const chartTypeRefs = [chart.chartType, 'chart', 'graph', 'visualization'];
      const hasChartTypeRef = chartTypeRefs.some(ref => lowerMessage.includes(ref));
      
      // Check for data type references
      const dataTypeRefs = [chart.dataType, chart.dimension];
      const hasDataTypeRef = dataTypeRefs.some(ref => lowerMessage.includes(ref));
      
      if (hasPronoun || (hasChartTypeRef && hasDataTypeRef)) {
        intent.context.referringTo = 'current_chart';
        
        // If no specific entities mentioned, inherit from current chart
        if (!intent.entities.chartType) intent.entities.chartType = chart.chartType;
        if (!intent.entities.dataType) intent.entities.dataType = chart.dataType;
        if (!intent.entities.dimension) intent.entities.dimension = chart.dimension;
      }
    }
    
    // Enhance action based on keywords
    if (lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('generate')) {
      intent.entities.context = 'new';
    } else if (lowerMessage.includes('change') || lowerMessage.includes('modify') || lowerMessage.includes('update')) {
      intent.entities.context = 'modification';
    } else if (lowerMessage.includes('analyze') || lowerMessage.includes('find') || lowerMessage.includes('detect')) {
      intent.entities.action = 'analyze';
    } else if (lowerMessage.includes('export') || lowerMessage.includes('save') || lowerMessage.includes('download')) {
      intent.entities.action = 'export';
    }
  }

  private enhanceIntentWithNLPData(intent: Intent, nlpResult: any): void {
    // Use extracted entities to enhance intent
    for (const entity of nlpResult.entities) {
      switch (entity.type) {
        case 'contact':
          if (!intent.entities.contactName) {
            intent.entities.contactName = entity.value;
          }
          break;
        case 'date':
          if (!intent.entities.date) {
            intent.entities.date = entity.value;
          }
          break;
        case 'amount':
          if (!intent.entities.amount) {
            intent.entities.amount = entity.value;
          }
          break;
        case 'email':
          if (!intent.entities.email) {
            intent.entities.email = entity.value;
          }
          break;
        case 'phone':
          if (!intent.entities.phone) {
            intent.entities.phone = entity.value;
          }
          break;
        case 'company':
          if (!intent.entities.company) {
            intent.entities.company = entity.value;
          }
          break;
      }
    }

    // Use resolved references to enhance intent
    for (const reference of nlpResult.references) {
      if (reference.resolvedEntity) {
        switch (reference.resolvedEntity.type) {
          case 'contact':
            if (!intent.entities.contactName) {
              intent.entities.contactName = reference.resolvedEntity.name;
            }
            break;
          case 'account':
            if (!intent.entities.company) {
              intent.entities.company = reference.resolvedEntity.name;
            }
            break;
          case 'deal':
            if (!intent.entities.target) {
              intent.entities.target = reference.resolvedEntity.name;
            }
            break;
        }
      }
    }

    // Update confidence based on NLP results
    if (nlpResult.entities.length > 0) {
      const avgConfidence = nlpResult.entities.reduce((sum: number, e: any) => sum + e.confidence, 0) / nlpResult.entities.length;
      intent.confidence = Math.min(intent.confidence + (avgConfidence * 0.2), 1.0);
    }
  }

  private generateClarificationQuestion(intent: Intent, message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (intent.action === 'create_chart' && !intent.entities.chartType) {
      return "What type of chart would you like? I can create line charts, bar charts, pie charts, area charts, or scatter plots.";
    }
    
    if (intent.action === 'create_chart' && !intent.entities.dataType) {
      return "What data would you like to visualize? I can create charts for deals, contacts, accounts, or activities.";
    }
    
    if (intent.action === 'modify_chart' && !intent.entities.action) {
      return "How would you like to modify the chart? I can change the type, adjust settings, or add new data.";
    }
    
    if (intent.action === 'analyze_data' && !intent.entities.action) {
      return "What type of analysis would you like? I can analyze trends, find anomalies, or provide insights.";
    }
    
    return "Could you please clarify what you'd like me to help you with?";
  }

  private getFallbackIntent(message: string): Intent {
    const lowerMessage = message.toLowerCase();
    
    // Simple fallback logic
    if (lowerMessage.includes('chart') || lowerMessage.includes('graph')) {
      return {
        action: 'create_chart',
        confidence: 0.6,
        originalMessage: message,
        entities: {},
        context: { referringTo: 'new_request' },
        metadata: { isAmbiguous: true, needsClarification: true, clarificationQuestion: "What type of chart would you like to create?" }
      };
    }
    
    if (lowerMessage.includes('contact') || lowerMessage.includes('deal') || lowerMessage.includes('account')) {
      return {
        action: 'view_data',
        confidence: 0.6,
        originalMessage: message,
        entities: {},
        context: { referringTo: 'new_request' },
        metadata: { isAmbiguous: true, needsClarification: true, clarificationQuestion: "What would you like to do with this data?" }
      };
    }
    
    return {
      action: 'general_conversation',
      confidence: 0.5,
      originalMessage: message,
      entities: {},
      context: { referringTo: 'new_request' },
      metadata: { isAmbiguous: true, needsClarification: true, clarificationQuestion: "How can I help you today?" }
    };
  }

  // Helper method to check if intent is for chart operations
  isChartIntent(intent: Intent): boolean {
    return ['create_chart', 'modify_chart', 'analyze_data', 'export_data'].includes(intent.action);
  }

  // Helper method to check if intent is for data operations
  isDataIntent(intent: Intent): boolean {
    return ['view_data', 'explore_data'].includes(intent.action);
  }

  // Helper method to check if intent is for CRUD operations
  isCrudIntent(intent: Intent): boolean {
    return ['create_contact', 'update_contact', 'delete_contact', 'send_email'].includes(intent.action);
  }

  private isConfirmationResponse(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    const confirmationWords = ['yes', 'confirm', 'correct', 'ok', 'sure', 'y', 'yeah', 'yep'];
    return confirmationWords.some(word => lowerMessage.includes(word)) && lowerMessage.length <= 20;
  }
}

// Export singleton instance
export const intentClassifier = IntentClassifier.getInstance(); 