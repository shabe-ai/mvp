import { Message } from '@/types/chat';
import { personalityEngine, UserPersonality, SentimentAnalysis, ProactiveSuggestion } from './personalityEngine';

export interface ChartContext {
  chartId: string;
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  dataType: 'deals' | 'contacts' | 'accounts' | 'activities';
  dimension: 'stage' | 'status' | 'industry' | 'type';
  title: string;
  lastModified: Date;
  insights?: any[];
}

export interface UserPreferences {
  preferredChartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  preferredDataTypes?: string[];
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  responseStyle: 'concise' | 'detailed' | 'conversational';
}

export interface ConversationPhase {
  current: 'exploration' | 'analysis' | 'modification' | 'export' | 'insights';
  previous?: string;
  transitions: string[];
}

export interface ConversationState {
  currentContext: {
    activeChart?: ChartContext;
    lastAction?: string;
    userGoals?: string[];
    conversationPhase: ConversationPhase;
    currentTopic?: string;
    pendingEmailRecipient?: string;
    action?: string;
    lastCompanyFilter?: string;
    lastDataType?: string;
  };
  memory: {
    recentTopics: string[];
    userPreferences: UserPreferences;
    sessionHistory: Message[];
    interactionCount: number;
    sessionStartTime: Date;
  };
  suggestions: {
    nextSteps: string[];
    relevantFeatures: string[];
    contextualPrompts: string[];
  };
  metadata: {
    userId: string;
    sessionId: string;
    lastActivity: Date;
  };
}

export class ConversationManager {
  private state: ConversationState;

  constructor(userId: string, sessionId: string) {
    this.state = {
      currentContext: {
        conversationPhase: {
          current: 'exploration',
          transitions: []
        }
      },
      memory: {
        recentTopics: [],
        userPreferences: {
          analysisDepth: 'detailed',
          responseStyle: 'conversational'
        },
        sessionHistory: [],
        interactionCount: 0,
        sessionStartTime: new Date()
      },
      suggestions: {
        nextSteps: [],
        relevantFeatures: [],
        contextualPrompts: []
      },
      metadata: {
        userId,
        sessionId,
        lastActivity: new Date()
      }
    };
  }

  // Update context based on new message
  updateContext(message: string, action?: string): void {
    this.state.metadata.lastActivity = new Date();
    this.state.memory.interactionCount++;
    
    if (action) {
      this.state.currentContext.lastAction = action;
    }

    // Update recent topics
    const topics = this.extractTopics(message);
    this.state.memory.recentTopics = [
      ...topics,
      ...this.state.memory.recentTopics.filter(t => !topics.includes(t))
    ].slice(0, 5); // Keep last 5 topics

    // Update conversation phase based on action
    this.updateConversationPhase(action);
    
    // Generate contextual suggestions
    this.generateSuggestions();
  }

  // Update full conversation context (including pending recipients, etc.)
  updateFullContext(conversationContext: any): void {
    if (conversationContext) {
      // Store the full conversation context in the current context
      this.state.currentContext = {
        ...this.state.currentContext,
        ...conversationContext
      };
      
      // Debug logging
      console.log('🔍 Conversation context stored:', {
        storedContext: this.state.currentContext,
        contextKeys: Object.keys(this.state.currentContext),
        hasPendingRecipient: !!this.state.currentContext.pendingEmailRecipient,
        hasAction: !!this.state.currentContext.action,
        pendingEmailRecipient: this.state.currentContext.pendingEmailRecipient,
        action: this.state.currentContext.action
      });
    }
  }

  // Set active chart context
  setActiveChart(chartContext: ChartContext): void {
    this.state.currentContext.activeChart = chartContext;
    this.state.currentContext.currentTopic = `${chartContext.dataType} by ${chartContext.dimension}`;
    
    // Update conversation phase to analysis
    this.updateConversationPhase('chart_created');
  }

  // Get current state
  getState(): ConversationState {
    console.log('🔍 Getting conversation state:', {
      currentContext: this.state.currentContext,
      contextKeys: Object.keys(this.state.currentContext),
      hasPendingRecipient: !!this.state.currentContext.pendingEmailRecipient,
      hasAction: !!this.state.currentContext.action,
      pendingEmailRecipient: this.state.currentContext.pendingEmailRecipient,
      action: this.state.currentContext.action
    });
    return { ...this.state };
  }

  // Add message to session history
  addToHistory(message: Message): void {
    this.state.memory.sessionHistory.push(message);
    
    // Keep only last 20 messages for context
    if (this.state.memory.sessionHistory.length > 20) {
      this.state.memory.sessionHistory = this.state.memory.sessionHistory.slice(-20);
    }
  }

  // Check if user is referring to current chart
  isReferringToCurrentChart(message: string): boolean {
    if (!this.state.currentContext.activeChart) return false;
    
    const chart = this.state.currentContext.activeChart;
    const lowerMessage = message.toLowerCase();
    
    // Check for pronouns and references (including "make it", "turn it", etc.)
    const pronouns = ['it', 'this', 'that', 'the chart', 'current'];
    const actionPhrases = ['make it', 'turn it', 'convert it', 'change it', 'switch it'];
    const hasPronoun = pronouns.some(pronoun => lowerMessage.includes(pronoun));
    const hasActionPhrase = actionPhrases.some(phrase => lowerMessage.includes(phrase));
    
    // Check for chart type references
    const chartTypeRefs = [chart.chartType, 'chart', 'graph', 'visualization'];
    const hasChartTypeRef = chartTypeRefs.some(ref => lowerMessage.includes(ref));
    
    // Check for data type references
    const dataTypeRefs = [chart.dataType, chart.dimension];
    const hasDataTypeRef = dataTypeRefs.some(ref => lowerMessage.includes(ref));
    
    // Check for modification keywords
    const modificationKeywords = ['change', 'modify', 'update', 'convert', 'transform', 'switch', 'make'];
    const hasModificationKeyword = modificationKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // If we have an active chart and the message contains "it" or modification keywords, assume it refers to the chart
    const hasItReference = lowerMessage.includes('it') && !!this.state.currentContext.activeChart;
    
    return hasPronoun || hasActionPhrase || hasItReference || (hasChartTypeRef && hasDataTypeRef) || (hasModificationKeyword && hasItReference);
  }

  // Get contextual suggestions
  getSuggestions(): string[] {
    return this.state.suggestions.nextSteps;
  }

  // Get conversation context for LLM
  getConversationContext(): string {
    const chart = this.state.currentContext.activeChart;
    const recentTopics = this.state.memory.recentTopics.slice(0, 3);
    
    let context = `Current conversation context:\n`;
    context += `- Session: ${this.state.metadata.sessionId}\n`;
    context += `- Interaction count: ${this.state.memory.interactionCount}\n`;
    context += `- Current phase: ${this.state.currentContext.conversationPhase.current}\n`;
    
    if (chart) {
      context += `- Active chart: ${chart.title} (${chart.chartType} chart of ${chart.dataType} by ${chart.dimension})\n`;
    }
    
    if (recentTopics.length > 0) {
      context += `- Recent topics: ${recentTopics.join(', ')}\n`;
    }
    
    if (this.state.currentContext.lastAction) {
      context += `- Last action: ${this.state.currentContext.lastAction}\n`;
    }
    
    return context;
  }

  private extractTopics(message: string): string[] {
    const topics: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Extract data types
    const dataTypes = ['deals', 'contacts', 'accounts', 'activities', 'sales', 'pipeline'];
    dataTypes.forEach(type => {
      if (lowerMessage.includes(type)) topics.push(type);
    });
    
    // Extract chart types
    const chartTypes = ['line', 'bar', 'pie', 'area', 'scatter', 'chart', 'graph'];
    chartTypes.forEach(type => {
      if (lowerMessage.includes(type)) topics.push(type);
    });
    
    // Extract dimensions
    const dimensions = ['stage', 'status', 'industry', 'type', 'trend', 'analysis'];
    dimensions.forEach(dim => {
      if (lowerMessage.includes(dim)) topics.push(dim);
    });
    
    return topics;
  }

  private updateConversationPhase(action?: string): void {
    const currentPhase = this.state.currentContext.conversationPhase.current;
    let newPhase = currentPhase;
    
    switch (action) {
      case 'chart_created':
        newPhase = 'analysis';
        break;
      case 'chart_modified':
        newPhase = 'modification';
        break;
      case 'analysis_requested':
        newPhase = 'insights';
        break;
      case 'export_requested':
        newPhase = 'export';
        break;
      case 'new_request':
        newPhase = 'exploration';
        break;
    }
    
    if (newPhase !== currentPhase) {
      this.state.currentContext.conversationPhase.previous = currentPhase;
      this.state.currentContext.conversationPhase.transitions.push(`${currentPhase} -> ${newPhase}`);
      this.state.currentContext.conversationPhase.current = newPhase;
    }
  }

  private generateSuggestions(): void {
    const phase = this.state.currentContext.conversationPhase.current;
    const chart = this.state.currentContext.activeChart;
    
    let suggestions: string[] = [];
    
    switch (phase) {
      case 'exploration':
        suggestions = [
          "Try asking for 'deals by stage' or 'contacts by status'",
          "I can create line charts, bar charts, pie charts, and more",
          "What type of data would you like to explore?"
        ];
        break;
        
      case 'analysis':
        if (chart) {
          suggestions = [
            `Analyze trends in the ${chart.dataType} data`,
            `Find anomalies or patterns`,
            `Export the ${chart.chartType} chart`,
            `Modify the chart type or settings`
          ];
        }
        break;
        
      case 'modification':
        suggestions = [
          "Change the chart type",
          "Adjust colors or styling",
          "Add more data dimensions",
          "Export the modified chart"
        ];
        break;
        
      case 'insights':
        suggestions = [
          "Get deeper analysis",
          "Predict future trends",
          "Compare with other data",
          "Export insights as report"
        ];
        break;
        
      case 'export':
        suggestions = [
          "Export as PNG, CSV, or PDF",
          "Share the chart",
          "Create a report",
          "Explore other data"
        ];
        break;
    }
    
    this.state.suggestions.nextSteps = suggestions;
  }

  /**
   * Get user personality for personalized interactions
   */
  async getUserPersonality(): Promise<UserPersonality> {
    return await personalityEngine.getUserPersonality(this.state.metadata.userId);
  }

  /**
   * Analyze sentiment of user message
   */
  async analyzeSentiment(message: string, context: string): Promise<SentimentAnalysis> {
    return await personalityEngine.analyzeSentiment(message, context);
  }

  /**
   * Get proactive suggestions based on user behavior and context
   */
  async getProactiveSuggestions(): Promise<ProactiveSuggestion[]> {
    const personality = await this.getUserPersonality();
    const recentActions = this.state.memory.recentTopics;
    const context = this.state.currentContext.lastAction || 'general';
    
    return await personalityEngine.generateProactiveSuggestions(
      personality,
      context,
      recentActions
    );
  }

  /**
   * Apply personality to response
   */
  async applyPersonalityToResponse(
    baseResponse: string,
    sentiment: SentimentAnalysis
  ): Promise<string> {
    const personality = await this.getUserPersonality();
    const tone = await personalityEngine.determineConversationTone(
      personality,
      sentiment,
      this.state.currentContext.lastAction || 'general'
    );
    
    return await personalityEngine.applyPersonalityToResponse(
      baseResponse,
      personality,
      tone,
      sentiment
    );
  }

  /**
   * Learn from user interaction
   */
  async learnFromInteraction(
    message: string,
    response: string,
    action: string,
    sentiment: SentimentAnalysis
  ): Promise<void> {
    await personalityEngine.learnFromInteraction(
      this.state.metadata.userId,
      message,
      response,
      action,
      sentiment
    );
  }

  /**
   * Update user personality preferences
   */
  async updatePersonalityPreferences(preferences: Partial<UserPersonality>): Promise<void> {
    await personalityEngine.updatePersonalityPreferences(
      this.state.metadata.userId,
      preferences
    );
  }
}

// User-specific conversation manager instances
const conversationManagers = new Map<string, ConversationManager>();

export function getConversationManager(userId: string, sessionId: string): ConversationManager {
  const key = `${userId}-${sessionId}`;
  console.log('🔍 Getting conversation manager:', {
    key,
    hasExistingManager: conversationManagers.has(key),
    totalManagers: conversationManagers.size,
    managerKeys: Array.from(conversationManagers.keys())
  });
  
  if (!conversationManagers.has(key)) {
    console.log('🔍 Creating new conversation manager for key:', key);
    conversationManagers.set(key, new ConversationManager(userId, sessionId));
  } else {
    console.log('🔍 Using existing conversation manager for key:', key);
  }
  
  const manager = conversationManagers.get(key)!;
  console.log('🔍 Conversation manager state:', {
    key,
    currentContext: manager.getState().currentContext,
    contextKeys: Object.keys(manager.getState().currentContext),
    hasPendingRecipient: !!manager.getState().currentContext.pendingEmailRecipient,
    pendingEmailRecipient: manager.getState().currentContext.pendingEmailRecipient
  });
  
  return manager;
}

export function resetConversationManager(userId?: string, sessionId?: string): void {
  if (userId && sessionId) {
    const key = `${userId}-${sessionId}`;
    conversationManagers.delete(key);
  } else {
    conversationManagers.clear();
  }
} 