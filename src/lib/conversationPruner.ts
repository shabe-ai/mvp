import { Message } from '@/types/chat';

export interface PruningConfig {
  maxMessages: number;
  maxTokens: number;
  maxAgeHours: number;
  preserveImportant: boolean;
  preserveLastN: number;
}

export interface PruningResult {
  originalCount: number;
  prunedCount: number;
  remainingCount: number;
  prunedMessages: Message[];
  reason: string;
}

export class ConversationPruner {
  private static readonly DEFAULT_CONFIG: PruningConfig = {
    maxMessages: 50,
    maxTokens: 10000,
    maxAgeHours: 24,
    preserveImportant: true,
    preserveLastN: 10
  };

  /**
   * Estimate token count for a message
   */
  private static estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if a message is important (should be preserved)
   */
  private static isImportantMessage(message: Message): boolean {
    if (!this.DEFAULT_CONFIG.preserveImportant) {
      return false;
    }

    // Preserve messages with specific actions
    const importantActions = [
      'contact_created',
      'contact_updated', 
      'contact_deleted',
      'account_created',
      'account_updated',
      'account_deleted',
      'deal_created',
      'deal_updated',
      'deal_deleted',
      'activity_created',
      'activity_updated',
      'activity_deleted'
    ];

    // Check if message has important action
    if (message.action && importantActions.includes(message.action)) {
      return true;
    }

    // Check if message contains important keywords
    const importantKeywords = [
      'created', 'updated', 'deleted', 'confirmed', 'successful',
      'error', 'failed', 'important', 'urgent', 'critical'
    ];

    const content = message.content.toLowerCase();
    return importantKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Prune conversation history based on configuration
   */
  static pruneConversation(
    messages: Message[],
    config: Partial<PruningConfig> = {}
  ): PruningResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const originalCount = messages.length;
    let prunedMessages: Message[] = [];
    let reason = '';

    // Always preserve the last N messages
    const messagesToPreserve = messages.slice(-finalConfig.preserveLastN);
    const messagesToEvaluate = messages.slice(0, -finalConfig.preserveLastN);

    // Strategy 1: Prune by age
    const cutoffTime = Date.now() - (finalConfig.maxAgeHours * 60 * 60 * 1000);
    const ageFiltered = messagesToEvaluate.filter(msg => {
      const messageTime = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
      return messageTime > cutoffTime;
    });

    if (ageFiltered.length < messagesToEvaluate.length) {
      reason = `Pruned ${messagesToEvaluate.length - ageFiltered.length} messages older than ${finalConfig.maxAgeHours} hours`;
    }

    // Strategy 2: Prune by message count
    let countFiltered = ageFiltered;
    if (ageFiltered.length + finalConfig.preserveLastN > finalConfig.maxMessages) {
      const excess = ageFiltered.length + finalConfig.preserveLastN - finalConfig.maxMessages;
      countFiltered = ageFiltered.slice(excess);
      reason = `Pruned ${excess} messages to stay within limit of ${finalConfig.maxMessages}`;
    }

    // Strategy 3: Prune by token count
    let tokenFiltered = countFiltered;
    let totalTokens = 0;
    const tokenCounts: number[] = [];

    // Calculate token counts
    for (const msg of [...countFiltered, ...messagesToPreserve]) {
      const tokens = this.estimateTokens(msg.content);
      tokenCounts.push(tokens);
      totalTokens += tokens;
    }

    // If over token limit, remove oldest messages while preserving important ones
    if (totalTokens > finalConfig.maxTokens) {
      const importantMessages: Message[] = [];
      const regularMessages: Message[] = [];

      // Separate important and regular messages
      countFiltered.forEach((msg, index) => {
        if (this.isImportantMessage(msg)) {
          importantMessages.push(msg);
        } else {
          regularMessages.push(msg);
        }
      });

      // Remove regular messages from oldest to newest until under token limit
      let currentTokens = totalTokens;
      const tokensToRemove = currentTokens - finalConfig.maxTokens;
      let removedTokens = 0;
      let removedCount = 0;

      for (let i = 0; i < regularMessages.length && removedTokens < tokensToRemove; i++) {
        const tokens = this.estimateTokens(regularMessages[i].content);
        removedTokens += tokens;
        removedCount++;
      }

      tokenFiltered = [
        ...regularMessages.slice(removedCount),
        ...importantMessages
      ];

      reason = `Pruned ${removedCount} messages to stay within ${finalConfig.maxTokens} token limit`;
    }

    // Combine filtered messages with preserved messages
    const finalMessages = [...tokenFiltered, ...messagesToPreserve];
    const prunedCount = originalCount - finalMessages.length;

    return {
      originalCount,
      prunedCount,
      remainingCount: finalMessages.length,
      prunedMessages: messages.slice(0, originalCount - finalMessages.length),
      reason: reason || 'No pruning needed'
    };
  }

  /**
   * Smart pruning that adapts based on conversation characteristics
   */
  static smartPrune(messages: Message[]): PruningResult {
    const messageCount = messages.length;
    const avgMessageLength = messages.reduce((sum, msg) => sum + msg.content.length, 0) / messageCount;
    
    // Adaptive configuration based on conversation characteristics
    let config: Partial<PruningConfig> = {};

    if (messageCount > 100) {
      // Very long conversation - aggressive pruning
      config = {
        maxMessages: 30,
        maxTokens: 8000,
        maxAgeHours: 12,
        preserveLastN: 15
      };
    } else if (messageCount > 50) {
      // Long conversation - moderate pruning
      config = {
        maxMessages: 40,
        maxTokens: 9000,
        maxAgeHours: 18,
        preserveLastN: 12
      };
    } else if (avgMessageLength > 500) {
      // Long messages - preserve fewer messages
      config = {
        maxMessages: 35,
        maxTokens: 8000,
        maxAgeHours: 24,
        preserveLastN: 8
      };
    } else {
      // Normal conversation - light pruning
      config = {
        maxMessages: 50,
        maxTokens: 10000,
        maxAgeHours: 24,
        preserveLastN: 10
      };
    }

    return this.pruneConversation(messages, config);
  }

  /**
   * Get conversation statistics
   */
  static getConversationStats(messages: Message[]) {
    const totalMessages = messages.length;
    const totalCharacters = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const avgMessageLength = totalMessages > 0 ? totalCharacters / totalMessages : 0;
    const estimatedTokens = Math.ceil(totalCharacters / 4);
    
    const oldestMessage = messages[0]?.timestamp ? new Date(messages[0].timestamp as Date | number) : null;
    const newestMessage = messages[messages.length - 1]?.timestamp ? new Date(messages[messages.length - 1].timestamp as Date | number) : null;
    
    const conversationAge = oldestMessage && newestMessage 
      ? (newestMessage.getTime() - oldestMessage.getTime()) / (1000 * 60 * 60) // hours
      : 0;

    return {
      totalMessages,
      totalCharacters,
      avgMessageLength: Math.round(avgMessageLength),
      estimatedTokens,
      conversationAgeHours: Math.round(conversationAge),
      needsPruning: this.shouldPrune(messages)
    };
  }

  /**
   * Check if conversation needs pruning
   */
  static shouldPrune(messages: Message[]): boolean {
    const stats = this.getConversationStats(messages);
    
    return (
      stats.totalMessages > this.DEFAULT_CONFIG.maxMessages ||
      stats.estimatedTokens > this.DEFAULT_CONFIG.maxTokens ||
      stats.conversationAgeHours > this.DEFAULT_CONFIG.maxAgeHours
    );
  }

  /**
   * Get recommended pruning configuration
   */
  static getRecommendedConfig(messages: Message[]): PruningConfig {
    const stats = this.getConversationStats(messages);
    
    if (stats.totalMessages > 100) {
      return {
        maxMessages: 30,
        maxTokens: 8000,
        maxAgeHours: 12,
        preserveImportant: true,
        preserveLastN: 15
      };
    } else if (stats.totalMessages > 50) {
      return {
        maxMessages: 40,
        maxTokens: 9000,
        maxAgeHours: 18,
        preserveImportant: true,
        preserveLastN: 12
      };
    } else {
      return this.DEFAULT_CONFIG;
    }
  }
} 