import { Intent } from './intentClassifier';

export interface InteractionExample {
  query: string;
  intent: string;
  entities: Record<string, any>;
  success: boolean;
  timestamp: Date;
  context?: string;
}

export class UserDataEnhancer {
  private examples: InteractionExample[] = [];
  private static instance: UserDataEnhancer;

  private constructor() {
    // Initialize with some basic examples
    this.examples = [
      {
        query: "update kavean gobal's company to Leanscale",
        intent: "update_contact",
        entities: { contactName: "kavean gobal", field: "company", value: "Leanscale" },
        success: true,
        timestamp: new Date(),
        context: "contact_update"
      },
      {
        query: "view all contacts",
        intent: "view_data", 
        entities: { dataType: "contacts" },
        success: true,
        timestamp: new Date(),
        context: "data_view"
      },
      {
        query: "create a chart of deals by stage",
        intent: "create_chart",
        entities: { dataType: "deals", dimension: "stage" },
        success: true,
        timestamp: new Date(),
        context: "chart_creation"
      },
      {
        query: "change it into a pie chart",
        intent: "modify_chart",
        entities: { chartType: "pie" },
        success: true,
        timestamp: new Date(),
        context: "chart_modification"
      }
    ];
  }

  static getInstance(): UserDataEnhancer {
    if (!UserDataEnhancer.instance) {
      UserDataEnhancer.instance = new UserDataEnhancer();
    }
    return UserDataEnhancer.instance;
  }

  /**
   * Enhance a prompt with relevant examples from user data
   */
  enhancePrompt(originalPrompt: string, userQuery: string): string {
    const relevantExamples = this.findRelevantExamples(userQuery);
    
    if (relevantExamples.length === 0) {
      return originalPrompt;
    }

    const examplesText = relevantExamples
      .map(ex => `User: "${ex.query}" → Intent: ${ex.intent}, Entities: ${JSON.stringify(ex.entities)}`)
      .join('\n');

    return `
${originalPrompt}

Based on these successful user interactions:
${examplesText}

Current user query: "${userQuery}"

Please use these examples as context to better understand the user's intent and extract the correct entities.
`;
  }

  /**
   * Find relevant examples based on keyword matching
   */
  private findRelevantExamples(query: string): InteractionExample[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    
    return this.examples
      .filter(example => {
        const exampleLower = example.query.toLowerCase();
        // Check if any significant words match
        return queryWords.some(word => exampleLower.includes(word));
      })
      .sort((a, b) => {
        // Sort by relevance (more matching words = higher relevance)
        const aMatches = queryWords.filter(word => a.query.toLowerCase().includes(word)).length;
        const bMatches = queryWords.filter(word => b.query.toLowerCase().includes(word)).length;
        return bMatches - aMatches;
      })
      .slice(0, 3); // Return top 3 most relevant examples
  }

  /**
   * Log a successful interaction for future learning
   */
  async logSuccessfulInteraction(
    query: string, 
    intent: string, 
    entities: Record<string, any>, 
    context?: string
  ): Promise<void> {
    const example: InteractionExample = {
      query,
      intent,
      entities,
      success: true,
      timestamp: new Date(),
      context
    };

    this.examples.push(example);
    
    // Keep only the last 100 examples to prevent memory bloat
    if (this.examples.length > 100) {
      this.examples = this.examples.slice(-100);
    }

    console.log('📚 Logged successful interaction:', { query, intent, entities });
  }

  /**
   * Log a failed interaction for analysis
   */
  async logFailedInteraction(
    query: string, 
    expectedIntent?: string, 
    expectedEntities?: Record<string, any>
  ): Promise<void> {
    const example: InteractionExample = {
      query,
      intent: expectedIntent || 'unknown',
      entities: expectedEntities || {},
      success: false,
      timestamp: new Date()
    };

    // Store failed interactions separately for analysis
    console.log('❌ Logged failed interaction:', { query, expectedIntent, expectedEntities });
  }

  /**
   * Get statistics about the knowledge base
   */
  getStats(): { totalExamples: number; successfulExamples: number; failedExamples: number } {
    const total = this.examples.length;
    const successful = this.examples.filter(ex => ex.success).length;
    const failed = total - successful;

    return { totalExamples: total, successfulExamples: successful, failedExamples: failed };
  }

  /**
   * Export examples for analysis or backup
   */
  exportExamples(): InteractionExample[] {
    return [...this.examples];
  }

  /**
   * Import examples from external source
   */
  importExamples(examples: InteractionExample[]): void {
    this.examples = [...this.examples, ...examples];
    console.log(`📚 Imported ${examples.length} examples. Total: ${this.examples.length}`);
  }
}

// Export singleton instance
export const userDataEnhancer = UserDataEnhancer.getInstance(); 