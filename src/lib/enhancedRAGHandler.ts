import { openaiClient } from './openaiClient';
import { userDataEnhancer } from './userDataEnhancer';
import { specializedRAG } from './specializedRAG';
import { logger } from './logger';

export interface RAGEnhancedResponse {
  message: string;
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
}

export class EnhancedRAGHandler {
  private static instance: EnhancedRAGHandler;

  static getInstance(): EnhancedRAGHandler {
    if (!EnhancedRAGHandler.instance) {
      EnhancedRAGHandler.instance = new EnhancedRAGHandler();
    }
    return EnhancedRAGHandler.instance;
  }

  async enhanceWithRAG(
    userMessage: string,
    intent: any,
    conversationState: any,
    context: any
  ): Promise<RAGEnhancedResponse> {
    try {
      console.log('🔍 Starting RAG enhancement for:', userMessage);
      
      // Step 1: Get relevant documents and examples
      const ragResults = await this.getRAGResults(userMessage, intent, context);
      
      // Step 2: Analyze documents if present
      const documentAnalysis = await this.analyzeDocuments(context.sessionFiles || []);
      
      // Step 3: Enhance context with RAG insights
      const enhancedContext = this.buildEnhancedContext(ragResults, documentAnalysis, conversationState);
      
      // Step 4: Generate enhanced response
      const enhancedResponse = await this.generateEnhancedResponse(
        userMessage,
        intent,
        enhancedContext,
        ragResults
      );
      
      console.log('🔍 RAG enhancement completed');
      
      return {
        ...enhancedResponse,
        ragInsights: {
          relevantDocuments: ragResults.relevantDocuments,
          documentAnalysis,
          contextEnhancement: enhancedContext.summary
        }
      };

    } catch (error) {
      logger.error('RAG enhancement failed', error instanceof Error ? error : undefined, {
        userMessage,
        intent: intent.action
      });
      
      // Return fallback response without RAG enhancement
      return {
        message: "I'm here to help! What would you like to do?",
        suggestions: [
          "Show me my contacts",
          "Create a chart",
          "View my deals",
          "Help me with accounts"
        ],
        conversationContext: {
          phase: 'exploration',
          action: 'general_conversation',
          referringTo: 'new_request'
        }
      };
    }
  }

  private async getRAGResults(userMessage: string, intent: any, context: any): Promise<any> {
    const results: any = {
      relevantDocuments: [],
      userExamples: [],
      chartExamples: [],
      analysisExamples: []
    };

    try {
      // Get user-specific examples from RAG system
      const userExamples = userDataEnhancer.findRelevantExamples(userMessage);
      results.userExamples = userExamples;

      // Get specialized examples based on intent
      if (intent.action.includes('chart')) {
        const chartExamples = specializedRAG.findRelevantChartExamples(userMessage);
        results.chartExamples = chartExamples;
      }

      if (intent.action.includes('analyze')) {
        const analysisExamples = specializedRAG.findRelevantAnalysisExamples(userMessage);
        results.analysisExamples = analysisExamples;
      }

      // Get relevant documents from session files
      if (context.sessionFiles && context.sessionFiles.length > 0) {
        results.relevantDocuments = context.sessionFiles.slice(0, 3); // Limit to 3 most relevant
      }

    } catch (error) {
      console.warn('Error getting RAG results:', error);
    }

    return results;
  }

  private async analyzeDocuments(sessionFiles: any[]): Promise<any> {
    if (!sessionFiles || sessionFiles.length === 0) {
      return null;
    }

    try {
      console.log('📄 Analyzing documents:', sessionFiles.length);
      
      const analysisResults = [];
      
      for (const file of sessionFiles.slice(0, 2)) { // Analyze up to 2 files
        const analysis = await this.analyzeSingleDocument(file);
        if (analysis) {
          analysisResults.push(analysis);
        }
      }

      return {
        totalFiles: sessionFiles.length,
        analyzedFiles: analysisResults.length,
        insights: analysisResults,
        summary: this.generateDocumentSummary(analysisResults)
      };

    } catch (error) {
      console.warn('Error analyzing documents:', error);
      return null;
    }
  }

  private async analyzeSingleDocument(file: any): Promise<any> {
    try {
      const prompt = `Analyze this document and extract key insights:

Document Name: ${file.name}
Content: ${file.content?.substring(0, 1000)}...

Please provide:
1. Document type and purpose
2. Key entities mentioned (people, companies, dates, amounts)
3. Main topics or themes
4. Actionable insights
5. Relevance to business operations

Return as JSON:
{
  "documentType": "string",
  "keyEntities": ["entity1", "entity2"],
  "mainTopics": ["topic1", "topic2"],
  "insights": ["insight1", "insight2"],
  "relevance": "high|medium|low"
}`;

      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }, {
        userId: conversationState.metadata?.userId,
        operation: 'document_analysis',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }

    } catch (error) {
      console.warn('Error analyzing single document:', error);
    }

    return null;
  }

  private generateDocumentSummary(analysisResults: any[]): string {
    if (!analysisResults || analysisResults.length === 0) {
      return '';
    }

    const insights = analysisResults.flatMap(result => result.insights || []);
    const entities = analysisResults.flatMap(result => result.keyEntities || []);
    const topics = analysisResults.flatMap(result => result.mainTopics || []);

    return `I've analyzed ${analysisResults.length} documents and found ${insights.length} key insights, ${entities.length} important entities, and ${topics.length} main topics. This information can help provide more context for your requests.`;
  }

  private buildEnhancedContext(ragResults: any, documentAnalysis: any, conversationState: any): any {
    const context = {
      userExamples: ragResults.userExamples || [],
      chartExamples: ragResults.chartExamples || [],
      analysisExamples: ragResults.analysisExamples || [],
      documents: ragResults.relevantDocuments || [],
      documentAnalysis,
      conversationHistory: conversationState.memory?.sessionHistory?.slice(-3) || [],
      summary: ''
    };

    // Build context summary
    const summaryParts = [];
    
    if (context.userExamples.length > 0) {
      summaryParts.push(`${context.userExamples.length} relevant user examples found`);
    }
    
    if (context.chartExamples.length > 0) {
      summaryParts.push(`${context.chartExamples.length} chart examples available`);
    }
    
    if (context.analysisExamples.length > 0) {
      summaryParts.push(`${context.analysisExamples.length} analysis examples available`);
    }
    
    if (context.documents.length > 0) {
      summaryParts.push(`${context.documents.length} documents uploaded`);
    }

    context.summary = summaryParts.join(', ');

    return context;
  }

  private async generateEnhancedResponse(
    userMessage: string,
    intent: any,
    enhancedContext: any,
    ragResults: any
  ): Promise<any> {
    try {
      // Build enhanced prompt with RAG context
      const enhancedPrompt = this.buildEnhancedPrompt(userMessage, intent, enhancedContext);
      
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: enhancedPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }, {
        userId: enhancedContext.conversationState?.metadata?.userId,
        operation: 'enhanced_response_generation',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from GPT for enhanced response generation');
      }

      // Parse the response and return structured format
      return this.parseEnhancedResponse(content, intent, enhancedContext);

    } catch (error) {
      console.error('Error generating enhanced response:', error);
      throw error;
    }
  }

  private buildEnhancedPrompt(userMessage: string, intent: any, enhancedContext: any): string {
    let prompt = `You are an AI assistant with enhanced context awareness. Use the following information to provide better responses:

User Intent: ${intent.action}
Confidence: ${intent.confidence}
Entities: ${JSON.stringify(intent.entities)}

Context Summary: ${enhancedContext.summary}

`;

    // Add user examples if available
    if (enhancedContext.userExamples.length > 0) {
      prompt += `\nRelevant User Examples:\n`;
      enhancedContext.userExamples.slice(0, 2).forEach((example: any, index: number) => {
        prompt += `${index + 1}. Query: "${example.query}" → Action: ${example.intent}\n`;
      });
    }

    // Add chart examples if available
    if (enhancedContext.chartExamples.length > 0) {
      prompt += `\nChart Examples:\n`;
      enhancedContext.chartExamples.slice(0, 2).forEach((example: any, index: number) => {
        prompt += `${index + 1}. Query: "${example.query}" → Chart: ${example.successfulChart.chartType} of ${example.successfulChart.dataType}\n`;
      });
    }

    // Add document insights if available
    if (enhancedContext.documentAnalysis) {
      prompt += `\nDocument Analysis:\n${enhancedContext.documentAnalysis.summary}\n`;
    }

    prompt += `\nProvide a helpful, context-aware response that leverages this information. Be specific and actionable.`;

    return prompt;
  }

  private parseEnhancedResponse(content: string, intent: any, enhancedContext: any): any {
    // For now, return a simple structured response
    // In a full implementation, you might parse JSON or structured content
    
    return {
      message: content,
      suggestions: this.generateContextualSuggestions(intent, enhancedContext),
      conversationContext: {
        phase: 'exploration',
        action: intent.action,
        referringTo: intent.context?.referringTo || 'new_request',
        ragEnhanced: true
      }
    };
  }

  private generateContextualSuggestions(intent: any, enhancedContext: any): string[] {
    const baseSuggestions = [
      "Show me my contacts",
      "Create a chart",
      "View my deals",
      "Help me with accounts"
    ];

    // Add context-specific suggestions based on RAG results
    const contextualSuggestions = [];

    if (enhancedContext.userExamples.length > 0) {
      contextualSuggestions.push("Show me similar data");
    }

    if (enhancedContext.documents.length > 0) {
      contextualSuggestions.push("Analyze uploaded documents");
    }

    if (intent.action.includes('chart')) {
      contextualSuggestions.push("Modify this chart");
      contextualSuggestions.push("Export chart data");
    }

    return [...contextualSuggestions, ...baseSuggestions].slice(0, 6);
  }
}

export const enhancedRAGHandler = EnhancedRAGHandler.getInstance();
