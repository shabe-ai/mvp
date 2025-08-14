import { logger } from './logger';
import { userDataEnhancer } from './userDataEnhancer';
import { personalizationEngine } from './personalizationEngine';

export interface UserInteraction {
  userId: string;
  message: string;
  intent: string;
  entities: Record<string, any>;
  response: string;
  success: boolean;
  responseTime: number;
  timestamp: Date;
  context: {
    sessionId: string;
    conversationPhase: string;
    referringTo: string;
  };
  feedback?: {
    rating?: number;
    comment?: string;
    helpful?: boolean;
  };
}

export interface UserPreference {
  userId: string;
  category: 'communication_style' | 'data_preference' | 'chart_preference' | 'response_length' | 'detail_level';
  preference: string;
  confidence: number;
  lastUpdated: Date;
  usageCount: number;
}

export interface AdaptiveResponse {
  message: string;
  suggestions: string[];
  personalizationApplied: {
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

export class AdaptiveLearningSystem {
  private static instance: AdaptiveLearningSystem;
  private userInteractions: Map<string, UserInteraction[]> = new Map();
  private userPreferences: Map<string, UserPreference[]> = new Map();
  private learningPatterns: Map<string, any> = new Map();

  static getInstance(): AdaptiveLearningSystem {
    if (!AdaptiveLearningSystem.instance) {
      AdaptiveLearningSystem.instance = new AdaptiveLearningSystem();
    }
    return AdaptiveLearningSystem.instance;
  }

  /**
   * Log a user interaction for learning
   */
  async logInteraction(interaction: UserInteraction): Promise<void> {
    try {
      console.log('📚 Logging user interaction for learning:', {
        userId: interaction.userId,
        intent: interaction.intent,
        success: interaction.success,
        responseTime: interaction.responseTime
      });

      // Store interaction
      const userInteractions = this.userInteractions.get(interaction.userId) || [];
      userInteractions.push(interaction);
      
      // Keep only last 100 interactions per user
      if (userInteractions.length > 100) {
        userInteractions.splice(0, userInteractions.length - 100);
      }
      
      this.userInteractions.set(interaction.userId, userInteractions);

      // Analyze for patterns and preferences
      await this.analyzeUserPatterns(interaction.userId);
      
      // Update user preferences
      await this.updateUserPreferences(interaction);

      // Log successful interactions to RAG system
      if (interaction.success) {
        await userDataEnhancer.logSuccessfulInteraction(
          interaction.message,
          interaction.intent,
          interaction.entities,
          interaction.context.referringTo
        );
      }

    } catch (error) {
      logger.error('Failed to log user interaction', error instanceof Error ? error : undefined, {
        userId: interaction.userId,
        intent: interaction.intent
      });
    }
  }

  /**
   * Analyze user patterns and behaviors
   */
  private async analyzeUserPatterns(userId: string): Promise<void> {
    try {
      const interactions = this.userInteractions.get(userId) || [];
      if (interactions.length < 5) return; // Need minimum interactions for pattern analysis

      const patterns = {
        commonIntents: this.analyzeCommonIntents(interactions),
        timePatterns: this.analyzeTimePatterns(interactions),
        responsePatterns: this.analyzeResponsePatterns(interactions),
        successPatterns: this.analyzeSuccessPatterns(interactions)
      };

      this.learningPatterns.set(userId, patterns);

      console.log('🧠 User patterns analyzed:', {
        userId,
        commonIntents: patterns.commonIntents.length,
        timePatterns: Object.keys(patterns.timePatterns).length
      });

    } catch (error) {
      console.warn('Error analyzing user patterns:', error);
    }
  }

  private analyzeCommonIntents(interactions: UserInteraction[]): any[] {
    const intentCounts = new Map<string, number>();
    
    interactions.forEach(interaction => {
      const count = intentCounts.get(interaction.intent) || 0;
      intentCounts.set(interaction.intent, count + 1);
    });

    return Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count, frequency: count / interactions.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private analyzeTimePatterns(interactions: UserInteraction[]): any {
    const timePatterns = {
      hourOfDay: new Map<number, number>(),
      dayOfWeek: new Map<number, number>(),
      sessionLength: 0
    };

    interactions.forEach(interaction => {
      const hour = interaction.timestamp.getHours();
      const day = interaction.timestamp.getDay();
      
      timePatterns.hourOfDay.set(hour, (timePatterns.hourOfDay.get(hour) || 0) + 1);
      timePatterns.dayOfWeek.set(day, (timePatterns.dayOfWeek.get(day) || 0) + 1);
    });

    return timePatterns;
  }

  private analyzeResponsePatterns(interactions: UserInteraction[]): any {
    const responseLengths = interactions.map(i => i.response.length);
    const avgResponseLength = responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length;
    
    return {
      averageResponseLength: avgResponseLength,
      preferredResponseLength: avgResponseLength < 100 ? 'short' : avgResponseLength < 300 ? 'medium' : 'long'
    };
  }

  private analyzeSuccessPatterns(interactions: UserInteraction[]): any {
    const successful = interactions.filter(i => i.success);
    const successRate = successful.length / interactions.length;
    
    const successfulIntents = this.analyzeCommonIntents(successful);
    
    return {
      successRate,
      successfulIntents,
      commonFailurePatterns: this.findFailurePatterns(interactions)
    };
  }

  private findFailurePatterns(interactions: UserInteraction[]): any[] {
    const failures = interactions.filter(i => !i.success);
    const failureIntents = this.analyzeCommonIntents(failures);
    
    return failureIntents.slice(0, 3);
  }

  /**
   * Update user preferences based on interaction
   */
  private async updateUserPreferences(interaction: UserInteraction): Promise<void> {
    try {
      const preferences = this.userPreferences.get(interaction.userId) || [];
      
      // Analyze communication style preference
      await this.updateCommunicationStylePreference(interaction, preferences);
      
      // Analyze data preference
      await this.updateDataPreference(interaction, preferences);
      
      // Analyze chart preference
      await this.updateChartPreference(interaction, preferences);
      
      // Analyze response length preference
      await this.updateResponseLengthPreference(interaction, preferences);
      
      // Analyze detail level preference
      await this.updateDetailLevelPreference(interaction, preferences);

      this.userPreferences.set(interaction.userId, preferences);

    } catch (error) {
      console.warn('Error updating user preferences:', error);
    }
  }

  private async updateCommunicationStylePreference(interaction: UserInteraction, preferences: UserPreference[]): Promise<void> {
    const message = interaction.message.toLowerCase();
    const response = interaction.response.toLowerCase();
    
    let style = 'neutral';
    if (message.includes('please') || message.includes('could you') || message.includes('would you')) {
      style = 'polite';
    } else if (message.includes('!') || message.includes('urgent') || message.includes('quick')) {
      style = 'direct';
    } else if (response.includes('😊') || response.includes('great') || response.includes('awesome')) {
      style = 'friendly';
    }

    this.updatePreference(preferences, 'communication_style', style, 0.8);
  }

  private async updateDataPreference(interaction: UserInteraction, preferences: UserPreference[]): Promise<void> {
    const entities = interaction.entities;
    let preference = 'general';
    
    if (entities.dataType) {
      preference = entities.dataType;
    } else if (interaction.intent.includes('contact')) {
      preference = 'contacts';
    } else if (interaction.intent.includes('deal')) {
      preference = 'deals';
    } else if (interaction.intent.includes('account')) {
      preference = 'accounts';
    }

    this.updatePreference(preferences, 'data_preference', preference, 0.7);
  }

  private async updateChartPreference(interaction: UserInteraction, preferences: UserPreference[]): Promise<void> {
    const entities = interaction.entities;
    if (entities.chartType) {
      this.updatePreference(preferences, 'chart_preference', entities.chartType, 0.9);
    }
  }

  private async updateResponseLengthPreference(interaction: UserInteraction, preferences: UserPreference[]): Promise<void> {
    const responseLength = interaction.response.length;
    let preference = 'medium';
    
    if (responseLength < 100) {
      preference = 'short';
    } else if (responseLength > 500) {
      preference = 'long';
    }

    this.updatePreference(preferences, 'response_length', preference, 0.6);
  }

  private async updateDetailLevelPreference(interaction: UserInteraction, preferences: UserPreference[]): Promise<void> {
    const message = interaction.message.toLowerCase();
    const response = interaction.response.toLowerCase();
    
    let preference = 'standard';
    if (message.includes('detailed') || message.includes('more info') || message.includes('explain')) {
      preference = 'detailed';
    } else if (message.includes('summary') || message.includes('brief') || message.includes('quick')) {
      preference = 'brief';
    } else if (response.length > 300) {
      preference = 'detailed';
    } else if (response.length < 100) {
      preference = 'brief';
    }

    this.updatePreference(preferences, 'detail_level', preference, 0.7);
  }

  private updatePreference(preferences: UserPreference[], category: UserPreference['category'], value: string, confidence: number): void {
    const existing = preferences.find(p => p.category === category);
    
    if (existing) {
      if (existing.preference === value) {
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
        existing.usageCount++;
      } else {
        existing.confidence = Math.max(0.1, existing.confidence - 0.1);
        if (existing.confidence < 0.3) {
          existing.preference = value;
          existing.confidence = confidence;
        }
      }
      existing.lastUpdated = new Date();
    } else {
      preferences.push({
        userId: '', // Will be set by caller
        category,
        preference: value,
        confidence,
        lastUpdated: new Date(),
        usageCount: 1
      });
    }
  }

  /**
   * Generate adaptive response based on user preferences and patterns
   */
  async generateAdaptiveResponse(
    baseResponse: string,
    userId: string,
    intent: string,
    context: any
  ): Promise<AdaptiveResponse> {
    try {
      const preferences = this.userPreferences.get(userId) || [];
      const patterns = this.learningPatterns.get(userId);
      
      // Apply personalization
      const personalizedResponse = await this.applyPersonalization(baseResponse, preferences, patterns);
      
      // Generate contextual suggestions
      const suggestions = await this.generateContextualSuggestions(userId, intent, preferences, patterns);
      
      // Generate learning insights
      const insights = await this.generateLearningInsights(userId, intent, preferences, patterns);

      return {
        message: personalizedResponse,
        suggestions,
        personalizationApplied: this.getPersonalizationSummary(preferences),
        learningInsights: insights
      };

    } catch (error) {
      logger.error('Failed to generate adaptive response', error instanceof Error ? error : undefined, {
        userId,
        intent
      });
      
      return {
        message: baseResponse,
        suggestions: ["Show me my contacts", "Create a chart", "View my deals"],
        personalizationApplied: {},
        learningInsights: {}
      };
    }
  }

  private async applyPersonalization(baseResponse: string, preferences: UserPreference[], patterns: any): Promise<string> {
    let response = baseResponse;

    // Apply communication style
    const communicationStyle = preferences.find(p => p.category === 'communication_style');
    if (communicationStyle && communicationStyle.confidence > 0.6) {
      response = this.applyCommunicationStyle(response, communicationStyle.preference);
    }

    // Apply detail level
    const detailLevel = preferences.find(p => p.category === 'detail_level');
    if (detailLevel && detailLevel.confidence > 0.6) {
      response = this.applyDetailLevel(response, detailLevel.preference);
    }

    // Apply response length
    const responseLength = preferences.find(p => p.category === 'response_length');
    if (responseLength && responseLength.confidence > 0.6) {
      response = this.applyResponseLength(response, responseLength.preference);
    }

    return response;
  }

  private applyCommunicationStyle(response: string, style: string): string {
    switch (style) {
      case 'friendly':
        return response.replace(/\./g, ' 😊').replace(/!/g, '! 🎉');
      case 'polite':
        return response.replace(/\./g, '. Please let me know if you need anything else.');
      case 'direct':
        return response.replace(/\./g, '.');
      default:
        return response;
    }
  }

  private applyDetailLevel(response: string, level: string): string {
    switch (level) {
      case 'brief':
        return response.split('.')[0] + '.';
      case 'detailed':
        if (response.length < 200) {
          return response + ' Would you like me to provide more details about this?';
        }
        return response;
      default:
        return response;
    }
  }

  private applyResponseLength(response: string, length: string): string {
    switch (length) {
      case 'short':
        return response.split('.')[0] + '.';
      case 'long':
        if (response.length < 300) {
          return response + ' I can provide more information if you need it.';
        }
        return response;
      default:
        return response;
    }
  }

  private async generateContextualSuggestions(userId: string, intent: string, preferences: UserPreference[], patterns: any): Promise<string[]> {
    const suggestions = ["Show me my contacts", "Create a chart", "View my deals"];
    
    // Add preference-based suggestions
    const dataPreference = preferences.find(p => p.category === 'data_preference');
    if (dataPreference && dataPreference.confidence > 0.7) {
      suggestions.unshift(`Show me my ${dataPreference.preference}`);
    }

    // Add pattern-based suggestions
    if (patterns?.commonIntents?.length > 0) {
      const commonIntent = patterns.commonIntents[0];
      if (commonIntent.frequency > 0.3) {
        suggestions.unshift(`Show me ${commonIntent.intent.replace('_', ' ')}`);
      }
    }

    return suggestions.slice(0, 6);
  }

  private async generateLearningInsights(userId: string, intent: string, preferences: UserPreference[], patterns: any): Promise<any> {
    const insights: any = {};

    // Detect patterns
    if (patterns?.commonIntents?.length > 0) {
      const topIntent = patterns.commonIntents[0];
      if (topIntent.frequency > 0.4) {
        insights.patternDetected = `You frequently work with ${topIntent.intent.replace('_', ' ')}`;
      }
    }

    // Apply preferences
    const highConfidencePreferences = preferences.filter(p => p.confidence > 0.8);
    if (highConfidencePreferences.length > 0) {
      const preference = highConfidencePreferences[0];
      insights.preferenceApplied = `Using your preferred ${preference.category.replace('_', ' ')}: ${preference.preference}`;
    }

    // Suggest improvements
    if (patterns?.successPatterns?.successRate < 0.7) {
      insights.improvementSuggestion = "I notice some requests need clarification. Try being more specific for better results.";
    }

    return insights;
  }

  private getPersonalizationSummary(preferences: UserPreference[]): any {
    const summary: any = {};
    
    preferences.forEach(pref => {
      if (pref.confidence > 0.6) {
        summary[pref.category] = pref.preference;
      }
    });

    return summary;
  }

  /**
   * Get user learning insights
   */
  async getUserInsights(userId: string): Promise<any> {
    const interactions = this.userInteractions.get(userId) || [];
    const preferences = this.userPreferences.get(userId) || [];
    const patterns = this.learningPatterns.get(userId);

    return {
      totalInteractions: interactions.length,
      successRate: interactions.filter(i => i.success).length / interactions.length,
      preferences: preferences.filter(p => p.confidence > 0.6),
      patterns,
      lastInteraction: interactions[interactions.length - 1]?.timestamp
    };
  }
}

export const adaptiveLearningSystem = AdaptiveLearningSystem.getInstance();
