import { performanceOptimizer } from './performanceOptimizer';
import { errorHandler } from './errorHandler';

export interface EdgeCase {
  type: 'input' | 'data' | 'system' | 'user';
  pattern: RegExp | string | ((input: any) => boolean);
  handler: (input: any, context: any) => Promise<any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EdgeCaseContext {
  userId: string;
  operation: string;
  input: any;
  timestamp: Date;
  retryCount: number;
}

export class EdgeCaseHandler {
  private static instance: EdgeCaseHandler;
  private edgeCases: EdgeCase[] = [];
  private handledCases: Array<{ case: EdgeCase; context: EdgeCaseContext; timestamp: Date }> = [];

  private constructor() {
    this.initializeEdgeCases();
  }

  static getInstance(): EdgeCaseHandler {
    if (!EdgeCaseHandler.instance) {
      EdgeCaseHandler.instance = new EdgeCaseHandler();
    }
    return EdgeCaseHandler.instance;
  }

  /**
   * Initialize default edge cases
   */
  private initializeEdgeCases(): void {
    // Empty or null input
    this.edgeCases.push({
      type: 'input',
      pattern: (input: any) => !input || (typeof input === 'string' && input.trim() === ''),
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "I didn't receive any input. Could you please provide more details?",
        suggestions: [
          "Try asking a specific question",
          "Tell me what you'd like to do",
          "Use one of the suggested actions"
        ],
        handled: true
      }),
      priority: 'medium'
    });

    // Very long input
    this.edgeCases.push({
      type: 'input',
      pattern: (input: any) => typeof input === 'string' && input.length > 1000,
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "That's quite a detailed request! Let me break this down and focus on the most important parts.",
        suggestions: [
          "I'll process the key points",
          "Consider breaking this into smaller requests",
          "Focus on the main action you want"
        ],
        handled: true,
        processedInput: input.substring(0, 500) + "..."
      }),
      priority: 'low'
    });

    // Special characters or encoding issues
    this.edgeCases.push({
      type: 'input',
      pattern: /[^\x00-\x7F]/,
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "I notice some special characters in your input. Let me process this carefully.",
        suggestions: [
          "I'll handle the special characters",
          "Consider using standard characters if possible"
        ],
        handled: true,
        processedInput: input.normalize('NFD').replace(/[\u0300-\u036f]/g, "")
      }),
      priority: 'low'
    });

    // Multiple questions in one input
    this.edgeCases.push({
      type: 'input',
      pattern: /\?.*\?/,
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "I see you have multiple questions. Let me address the main one first, then we can tackle the others.",
        suggestions: [
          "I'll focus on the primary question",
          "Ask follow-up questions one at a time",
          "Let me know which is most important"
        ],
        handled: true,
        primaryQuestion: input.split('?')[0] + '?'
      }),
      priority: 'medium'
    });

    // Greetings and casual conversation
    this.edgeCases.push({
      type: 'input',
      pattern: (input: any) => {
        if (typeof input !== 'string') return false;
        const greetingPatterns = [
          /^hello\s*how\s*are\s*you/i,
          /^hi\s*how\s*are\s*you/i,
          /^hey\s*how\s*are\s*you/i,
          /^how\s*are\s*you/i,
          /^how\s*are\s*you\s*doing/i,
          /^what's?\s*up/i,
          /^sup\b/i,
          /^hello\b/i,
          /^hi\b/i,
          /^hey\b/i,
          /^good\s*(morning|afternoon|evening)/i,
          /^thanks?\s*you?/i,
          /^bye\b/i,
          /^goodbye\b/i,
          /^see\s*you/i
        ];
        return greetingPatterns.some(pattern => pattern.test(input.trim()));
      },
      handler: async (input: any, context: EdgeCaseContext) => {
        const lowerInput = input.toLowerCase().trim();
        
        // Generate appropriate greeting response
        let response = "Hello! I'm doing great, thank you for asking! ";
        
        if (lowerInput.includes('how are you')) {
          response += "I'm here to help you with your CRM tasks. What would you like to work on today?";
        } else if (lowerInput.includes('good morning')) {
          response += "Good morning! Ready to help you manage your contacts, deals, and accounts.";
        } else if (lowerInput.includes('good afternoon')) {
          response += "Good afternoon! How can I assist you with your business data today?";
        } else if (lowerInput.includes('good evening')) {
          response += "Good evening! I'm here to help you with any CRM tasks you need.";
        } else if (lowerInput.includes('what') && lowerInput.includes('up')) {
          response += "Not much, just ready to help you with your CRM! What's on your agenda?";
        } else if (lowerInput.includes('thanks') || lowerInput.includes('thank you')) {
          response = "You're very welcome! I'm happy to help. Is there anything else you'd like me to assist you with?";
        } else if (lowerInput.includes('bye') || lowerInput.includes('goodbye') || lowerInput.includes('see you')) {
          response = "Goodbye! Have a great day. Feel free to come back anytime you need help with your CRM.";
        } else {
          response += "I'm here to help you with your contacts, deals, accounts, and analytics. What would you like to do?";
        }
        
        return {
          message: response,
          suggestions: [
            "Show me my contacts",
            "Create a chart",
            "View my deals",
            "Help me with accounts"
          ],
          handled: true
        };
      },
      priority: 'high'
    });

    // Ambiguous contact names
    this.edgeCases.push({
      type: 'data',
      pattern: (input: any) => {
        if (typeof input !== 'string') return false;
        const contactPattern = /\b(john|jane|mike|sarah|david|emma|james|lisa|michael|jennifer)\b/i;
        return contactPattern.test(input) && input.toLowerCase().includes('contact');
      },
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "I found a common name that might match multiple contacts. Let me show you all the possibilities.",
        suggestions: [
          "I'll list all matching contacts",
          "Provide more specific details",
          "Use the full name if possible"
        ],
        handled: true,
        needsClarification: true
      }),
      priority: 'high'
    });

    // Large data sets
    this.edgeCases.push({
      type: 'data',
      pattern: (input: any) => {
        if (Array.isArray(input)) return input.length > 1000;
        if (typeof input === 'object') return Object.keys(input).length > 100;
        return false;
      },
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "This is a large dataset. I'll process it efficiently and show you the most relevant results.",
        suggestions: [
          "I'll use pagination for better performance",
          "Consider filtering the data",
          "I'll show summary statistics first"
        ],
        handled: true,
        usePagination: true,
        limit: 100
      }),
      priority: 'medium'
    });

    // System resource constraints
    this.edgeCases.push({
      type: 'system',
      pattern: (input: any) => {
        const perfSummary = performanceOptimizer.getPerformanceSummary();
        return perfSummary.memoryUsage > 50 * 1024 * 1024; // 50MB
      },
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "I'm optimizing performance for this request. This might take a moment.",
        suggestions: [
          "I'll clear some cache to free up memory",
          "Processing with optimized settings",
          "Consider breaking this into smaller requests"
        ],
        handled: true,
        clearCache: true
      }),
      priority: 'high'
    });

    // User behavior patterns
    this.edgeCases.push({
      type: 'user',
      pattern: (input: any) => {
        const recentErrors = errorHandler.getErrorStats();
        return recentErrors.recentErrors > 5;
      },
      handler: async (input: any, context: EdgeCaseContext) => ({
        message: "I notice you've had some issues recently. Let me help you get back on track with a simpler approach.",
        suggestions: [
          "I'll use basic processing methods",
          "Try a simpler request",
          "Let me guide you through this step by step"
        ],
        handled: true,
        useBasicProcessing: true
      }),
      priority: 'high'
    });
  }

  /**
   * Check if input matches any edge cases
   */
  async checkEdgeCases(input: any, context: EdgeCaseContext): Promise<{
    handled: boolean;
    result?: any;
    processedInput?: any;
  }> {
    // Sort edge cases by priority
    const sortedCases = [...this.edgeCases].sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const edgeCase of sortedCases) {
      try {
        let matches = false;

        if (typeof edgeCase.pattern === 'string') {
          matches = typeof input === 'string' && input.toLowerCase().includes(edgeCase.pattern.toLowerCase());
        } else if (edgeCase.pattern instanceof RegExp) {
          matches = typeof input === 'string' && edgeCase.pattern.test(input);
        } else if (typeof edgeCase.pattern === 'function') {
          matches = edgeCase.pattern(input);
        }

        if (matches) {
          // Record the handled case
          this.handledCases.push({
            case: edgeCase,
            context,
            timestamp: new Date()
          });

          // Keep only last 100 handled cases
          if (this.handledCases.length > 100) {
            this.handledCases = this.handledCases.slice(-100);
          }

          // Execute the handler
          const result = await edgeCase.handler(input, context);
          
          // Apply any system actions
          if (result.clearCache) {
            performanceOptimizer.clearCache();
          }

          return {
            handled: true,
            result,
            processedInput: result.processedInput || input
          };
        }
      } catch (error) {
        console.error('Error handling edge case:', error);
        // Continue to next edge case
      }
    }

    return { handled: false };
  }

  /**
   * Add custom edge case
   */
  addEdgeCase(edgeCase: EdgeCase): void {
    this.edgeCases.push(edgeCase);
  }

  /**
   * Get edge case statistics
   */
  getEdgeCaseStats(): {
    totalHandled: number;
    casesByType: Record<string, number>;
    casesByPriority: Record<string, number>;
    recentCases: number;
  } {
    const totalHandled = this.handledCases.length;
    const casesByType: Record<string, number> = {};
    const casesByPriority: Record<string, number> = {};
    const recentCases = this.handledCases.filter(c => 
      Date.now() - c.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    ).length;

    for (const handledCase of this.handledCases) {
      const type = handledCase.case.type;
      const priority = handledCase.case.priority;
      
      casesByType[type] = (casesByType[type] || 0) + 1;
      casesByPriority[priority] = (casesByPriority[priority] || 0) + 1;
    }

    return {
      totalHandled,
      casesByType,
      casesByPriority,
      recentCases
    };
  }

  /**
   * Get recent handled cases for analysis
   */
  getRecentHandledCases(limit: number = 10): Array<{ case: EdgeCase; context: EdgeCaseContext; timestamp: Date }> {
    return this.handledCases.slice(-limit);
  }

  /**
   * Clear handled cases history
   */
  clearHandledCases(): void {
    this.handledCases = [];
  }

  /**
   * Validate input for common issues
   */
  validateInput(input: any): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!input) {
      issues.push('No input provided');
      suggestions.push('Please provide some input');
      return { isValid: false, issues, suggestions };
    }

    if (typeof input === 'string') {
      if (input.trim().length === 0) {
        issues.push('Empty input');
        suggestions.push('Please provide meaningful input');
      }

      if (input.length > 2000) {
        issues.push('Input too long');
        suggestions.push('Consider breaking this into smaller requests');
      }

      if (/[^\x00-\x7F]/.test(input)) {
        issues.push('Contains special characters');
        suggestions.push('Consider using standard characters');
      }
    }

    if (Array.isArray(input) && input.length > 1000) {
      issues.push('Too many items');
      suggestions.push('Consider processing in batches');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
}

// Export singleton instance
export const edgeCaseHandler = EdgeCaseHandler.getInstance(); 