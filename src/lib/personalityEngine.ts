import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { openaiClient } from '@/lib/openaiClient';

export interface UserPersonality {
  userId: string;
  communicationStyle: 'formal' | 'casual' | 'friendly' | 'professional';
  preferredDetailLevel: 'brief' | 'detailed' | 'comprehensive';
  responseLength: 'short' | 'medium' | 'long';
  humorPreference: 'none' | 'light' | 'moderate';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
  proactiveSuggestions: boolean;
  learningEnabled: boolean;
  lastInteraction: Date;
  interactionCount: number;
  favoriteFeatures: string[];
  commonTasks: Array<{
    task: string;
    frequency: number;
    lastUsed: Date;
  }>;
  sentimentHistory: Array<{
    sentiment: 'positive' | 'neutral' | 'negative';
    timestamp: Date;
    context: string;
  }>;
}

export interface ConversationTone {
  formality: 'formal' | 'casual' | 'friendly' | 'professional';
  enthusiasm: 'low' | 'medium' | 'high';
  empathy: 'low' | 'medium' | 'high';
  humor: 'none' | 'light' | 'moderate';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
}

export interface ProactiveSuggestion {
  type: 'task' | 'insight' | 'reminder' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  action?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  confidence: number;
  emotions: string[];
  intensity: 'low' | 'medium' | 'high';
  context: string;
}

export class PersonalityEngine {
  private static instance: PersonalityEngine;
  private userPersonalities: Map<string, UserPersonality> = new Map();

  private constructor() {}

  static getInstance(): PersonalityEngine {
    if (!PersonalityEngine.instance) {
      PersonalityEngine.instance = new PersonalityEngine();
    }
    return PersonalityEngine.instance;
  }

  /**
   * Analyze user sentiment from message
   */
  async analyzeSentiment(message: string, context: string): Promise<SentimentAnalysis> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert sentiment analysis system. Analyze the user's message for emotional content and sentiment.

**Context:** ${context}

**Instructions:**
1. Determine overall sentiment (positive, neutral, negative)
2. Identify specific emotions present
3. Assess emotional intensity
4. Provide confidence score (0.0-1.0)
5. Explain the context of the sentiment

**Output Format:**
{
  "overall": "positive|neutral|negative",
  "confidence": 0.85,
  "emotions": ["frustration", "excitement", "confusion"],
  "intensity": "low|medium|high",
  "context": "User is frustrated with chart generation but excited about new features"
}

**Message to analyze:** "${message}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }, {
        userId: 'sentiment-analysis',
        operation: 'sentiment_analysis',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          overall: 'neutral',
          confidence: 0.5,
          emotions: [],
          intensity: 'low',
          context: 'Unable to analyze sentiment'
        };
      }

      try {
        return JSON.parse(content);
      } catch (error) {
        console.error('Failed to parse sentiment analysis:', error);
        return {
          overall: 'neutral',
          confidence: 0.5,
          emotions: [],
          intensity: 'low',
          context: 'Sentiment analysis failed'
        };
      }
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return {
        overall: 'neutral',
        confidence: 0.5,
        emotions: [],
        intensity: 'low',
        context: 'Sentiment analysis error'
      };
    }
  }

  /**
   * Determine appropriate conversation tone based on user personality and context
   */
  async determineConversationTone(
    userPersonality: UserPersonality,
    sentiment: SentimentAnalysis,
    context: string
  ): Promise<ConversationTone> {
    // Base tone on user preferences
    let tone: ConversationTone = {
      formality: userPersonality.communicationStyle,
      enthusiasm: 'medium',
      empathy: 'medium',
      humor: userPersonality.humorPreference,
      emojiUsage: userPersonality.emojiUsage
    };

    // Adjust based on sentiment
    if (sentiment.overall === 'negative') {
      tone.empathy = 'high';
      tone.enthusiasm = 'low';
      tone.humor = 'none';
    } else if (sentiment.overall === 'positive') {
      tone.enthusiasm = 'high';
      tone.empathy = 'medium';
    }

    // Adjust based on context
    if (context.includes('error') || context.includes('problem')) {
      tone.empathy = 'high';
      tone.formality = 'professional';
    } else if (context.includes('success') || context.includes('great')) {
      tone.enthusiasm = 'high';
    }

    return tone;
  }

  /**
   * Generate proactive suggestions based on user behavior and context
   */
  async generateProactiveSuggestions(
    userPersonality: UserPersonality,
    currentContext: string,
    recentActions: string[]
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    try {
      // Get user's CRM data for context-aware suggestions
      const teams = await convex.query(api.crm.getTeamsByUser, { userId: userPersonality.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });

      // Task-based suggestions
      if (contacts.length === 0) {
        suggestions.push({
          type: 'task',
          title: 'Create Your First Contact',
          description: 'Start building your CRM by adding your first contact. I can help you create a contact with all the essential information.',
          confidence: 0.9,
          action: 'create_contact',
          priority: 'high'
        });
      }

      if (deals.length === 0 && contacts.length > 0) {
        suggestions.push({
          type: 'task',
          title: 'Track Your First Deal',
          description: 'Begin tracking sales opportunities by creating your first deal. This will help you monitor your sales pipeline.',
          confidence: 0.8,
          action: 'create_deal',
          priority: 'medium'
        });
      }

      // Insight-based suggestions
      if (deals.length > 0) {
        const totalValue = deals.reduce((sum, deal) => sum + (parseFloat(String(deal.amount || '0')) || 0), 0);
        const avgDealSize = totalValue / deals.length;
        
        suggestions.push({
          type: 'insight',
          title: 'Deal Pipeline Overview',
          description: `You have ${deals.length} deals worth $${totalValue.toLocaleString()}. Average deal size: $${avgDealSize.toLocaleString()}.`,
          confidence: 0.7,
          priority: 'medium'
        });
      }

      // Optimization suggestions
      if (recentActions.includes('chart_generation')) {
        suggestions.push({
          type: 'optimization',
          title: 'Enhanced Chart Features',
          description: 'Try our enhanced chart features! You can update charts with natural language, export them, and get AI-powered insights.',
          confidence: 0.6,
          action: 'enhanced_charts',
          priority: 'low'
        });
      }

      // Reminder suggestions
      if (activities.length > 0) {
        const pendingActivities = activities.filter(a => a.status === 'scheduled');
        if (pendingActivities.length > 0) {
          suggestions.push({
            type: 'reminder',
            title: 'Pending Activities',
            description: `You have ${pendingActivities.length} pending activities. Would you like to review and update their status?`,
            confidence: 0.8,
            action: 'view_activities',
            priority: 'medium'
          });
        }
      }

      // Learning-based suggestions
      if (userPersonality.commonTasks.length > 0) {
        const mostCommonTask = userPersonality.commonTasks[0];
        if (mostCommonTask.frequency > 3) {
          suggestions.push({
            type: 'optimization',
            title: 'Quick Access',
            description: `I notice you frequently ${mostCommonTask.task}. I can help you do this faster with shortcuts and templates.`,
            confidence: 0.7,
            action: 'optimize_workflow',
            priority: 'low'
          });
        }
      }

    } catch (error) {
      console.error('Error generating proactive suggestions:', error);
    }

    // Filter suggestions based on user preferences
    return suggestions.filter(s => 
      userPersonality.proactiveSuggestions || s.priority === 'high'
    ).slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Apply personality to response generation
   */
  async applyPersonalityToResponse(
    baseResponse: string,
    userPersonality: UserPersonality,
    tone: ConversationTone,
    sentiment: SentimentAnalysis
  ): Promise<string> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are Shabe AI, a CRM assistant. Rewrite the response to match the user's personality and conversation tone.

**User Personality:**
- Communication Style: ${userPersonality.communicationStyle}
- Detail Level: ${userPersonality.preferredDetailLevel}
- Response Length: ${userPersonality.responseLength}
- Humor: ${userPersonality.humorPreference}
- Emoji Usage: ${userPersonality.emojiUsage}

**Conversation Tone:**
- Formality: ${tone.formality}
- Enthusiasm: ${tone.enthusiasm}
- Empathy: ${tone.empathy}
- Humor: ${tone.humor}
- Emoji Usage: ${tone.emojiUsage}

**Sentiment Context:**
- Overall: ${sentiment.overall}
- Emotions: ${sentiment.emotions.join(', ')}
- Intensity: ${sentiment.intensity}

**Instructions:**
1. Maintain the core information and accuracy
2. Adjust tone to match user preferences
3. Use appropriate emojis if enabled
4. Add light humor if appropriate
5. Show empathy for negative sentiment
6. Match the desired response length
7. Keep it natural and conversational

**Base Response:** "${baseResponse}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }, {
        userId: 'personality-response',
        operation: 'personality_response',
        model: 'gpt-4'
      });

      return response.choices[0]?.message?.content || baseResponse;
    } catch (error) {
      console.error('Error applying personality to response:', error);
      return baseResponse;
    }
  }

  /**
   * Learn from user interaction
   */
  async learnFromInteraction(
    userId: string,
    message: string,
    response: string,
    action: string,
    sentiment: SentimentAnalysis
  ): Promise<void> {
    try {
      let personality = this.userPersonalities.get(userId);
      
      if (!personality) {
        personality = {
          userId,
          communicationStyle: 'friendly',
          preferredDetailLevel: 'detailed',
          responseLength: 'medium',
          humorPreference: 'light',
          emojiUsage: 'minimal',
          proactiveSuggestions: true,
          learningEnabled: true,
          lastInteraction: new Date(),
          interactionCount: 0,
          favoriteFeatures: [],
          commonTasks: [],
          sentimentHistory: []
        };
      }

      // Update interaction count and timestamp
      personality.interactionCount++;
      personality.lastInteraction = new Date();

      // Update sentiment history
      personality.sentimentHistory.push({
        sentiment: sentiment.overall,
        timestamp: new Date(),
        context: action
      });

      // Keep only last 50 sentiment entries
      if (personality.sentimentHistory.length > 50) {
        personality.sentimentHistory = personality.sentimentHistory.slice(-50);
      }

      // Update common tasks
      const existingTask = personality.commonTasks.find(t => t.task === action);
      if (existingTask) {
        existingTask.frequency++;
        existingTask.lastUsed = new Date();
      } else {
        personality.commonTasks.push({
          task: action,
          frequency: 1,
          lastUsed: new Date()
        });
      }

      // Sort common tasks by frequency
      personality.commonTasks.sort((a, b) => b.frequency - a.frequency);

      // Keep only top 10 common tasks
      personality.commonTasks = personality.commonTasks.slice(0, 10);

      // Learn communication preferences
      this.learnCommunicationPreferences(personality, message, response, sentiment);

      // Store updated personality
      this.userPersonalities.set(userId, personality);

    } catch (error) {
      console.error('Error learning from interaction:', error);
    }
  }

  /**
   * Learn user's communication preferences
   */
  private learnCommunicationPreferences(
    personality: UserPersonality,
    message: string,
    response: string,
    sentiment: SentimentAnalysis
  ): void {
    // Learn response length preference
    const responseLength = response.length;
    if (responseLength < 100) {
      personality.responseLength = 'short';
    } else if (responseLength < 300) {
      personality.responseLength = 'medium';
    } else {
      personality.responseLength = 'long';
    }

    // Learn emoji usage preference
    const emojiCount = (response.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    if (emojiCount === 0) {
      personality.emojiUsage = 'none';
    } else if (emojiCount <= 2) {
      personality.emojiUsage = 'minimal';
    } else if (emojiCount <= 5) {
      personality.emojiUsage = 'moderate';
    } else {
      personality.emojiUsage = 'frequent';
    }

    // Learn formality preference based on user's message
    const formalWords = ['please', 'thank you', 'would you', 'could you', 'kindly'];
    const casualWords = ['hey', 'cool', 'awesome', 'thanks', 'yeah'];
    
    const formalCount = formalWords.filter(word => message.toLowerCase().includes(word)).length;
    const casualCount = casualWords.filter(word => message.toLowerCase().includes(word)).length;
    
    if (formalCount > casualCount) {
      personality.communicationStyle = 'formal';
    } else if (casualCount > formalCount) {
      personality.communicationStyle = 'casual';
    }
  }

  /**
   * Get or create user personality
   */
  async getUserPersonality(userId: string): Promise<UserPersonality> {
    let personality = this.userPersonalities.get(userId);
    
    if (!personality) {
      personality = {
        userId,
        communicationStyle: 'friendly',
        preferredDetailLevel: 'detailed',
        responseLength: 'medium',
        humorPreference: 'light',
        emojiUsage: 'minimal',
        proactiveSuggestions: true,
        learningEnabled: true,
        lastInteraction: new Date(),
        interactionCount: 0,
        favoriteFeatures: [],
        commonTasks: [],
        sentimentHistory: []
      };
      
      this.userPersonalities.set(userId, personality);
    }
    
    return personality;
  }

  /**
   * Update user personality preferences
   */
  async updatePersonalityPreferences(
    userId: string,
    preferences: Partial<UserPersonality>
  ): Promise<void> {
    const personality = await this.getUserPersonality(userId);
    Object.assign(personality, preferences);
    this.userPersonalities.set(userId, personality);
  }
}

// Export singleton instance
export const personalityEngine = PersonalityEngine.getInstance(); 