import { userDataEnhancer, InteractionExample } from './userDataEnhancer';

export interface ChartExample {
  query: string;
  successfulChart: {
    chartType: string;
    dataType: string;
    dimension: string;
    dataStructure: string;
    title: string;
  };
  context?: string;
}

export interface AnalysisExample {
  query: string;
  successfulAnalysis: {
    method: string;
    visualization: string;
    insights: string[];
    dataQuery: string;
  };
  context?: string;
}

export interface CRMExample {
  query: string;
  successfulOperation: {
    entityExtraction: string;
    fieldMapping: string;
    confirmationFlow: string;
    dataValidation: string[];
  };
  context?: string;
}

export interface ConversationExample {
  flow: string[];
  successfulPattern: string;
  context: string;
  outcome: 'success' | 'failure';
}

export class SpecializedRAGSystem {
  private chartExamples: ChartExample[] = [];
  private analysisExamples: AnalysisExample[] = [];
  private crmExamples: CRMExample[] = [];
  private conversationExamples: ConversationExample[] = [];

  // Initialize with domain-specific examples
  constructor() {
    this.initializeChartExamples();
    this.initializeAnalysisExamples();
    this.initializeCRMExamples();
    this.initializeConversationExamples();
  }

  private initializeChartExamples() {
    this.chartExamples = [
      {
        query: "create a chart of deals by stage",
        successfulChart: {
          chartType: "bar",
          dataType: "deals",
          dimension: "stage",
          dataStructure: "aggregated_by_stage",
          title: "Deals by Stage"
        },
        context: "chart_creation"
      },
      {
        query: "change it to a pie chart",
        successfulChart: {
          chartType: "pie",
          dataType: "deals",
          dimension: "stage",
          dataStructure: "percentage_distribution",
          title: "Deals by Stage (Pie)"
        },
        context: "chart_modification"
      },
      {
        query: "show contacts by lead status",
        successfulChart: {
          chartType: "bar",
          dataType: "contacts",
          dimension: "leadStatus",
          dataStructure: "aggregated_by_status",
          title: "Contacts by Lead Status"
        },
        context: "chart_creation"
      }
    ];
  }

  private initializeAnalysisExamples() {
    this.analysisExamples = [
      {
        query: "which account has the most contacts",
        successfulAnalysis: {
          method: "group_by_account_count_contacts",
          visualization: "bar_chart",
          insights: ["top_accounts", "contact_distribution"],
          dataQuery: "SELECT account, COUNT(contacts) FROM contacts GROUP BY account ORDER BY COUNT DESC"
        },
        context: "account_analysis"
      },
      {
        query: "analyze sales pipeline",
        successfulAnalysis: {
          method: "pipeline_analysis",
          visualization: "funnel_chart",
          insights: ["conversion_rates", "bottlenecks", "velocity"],
          dataQuery: "SELECT stage, COUNT(*), SUM(amount) FROM deals GROUP BY stage"
        },
        context: "pipeline_analysis"
      }
    ];
  }

  private initializeCRMExamples() {
    this.crmExamples = [
      {
        query: "update john smith's email to john@acme.com",
        successfulOperation: {
          entityExtraction: "contact_name_from_context",
          fieldMapping: "email_field",
          confirmationFlow: "explicit_confirmation",
          dataValidation: ["email_format", "contact_exists"]
        },
        context: "contact_update"
      },
      {
        query: "create contact name john doe email john@example.com",
        successfulOperation: {
          entityExtraction: "structured_creation",
          fieldMapping: "name_email_mapping",
          confirmationFlow: "implicit_confirmation",
          dataValidation: ["email_format", "name_format"]
        },
        context: "contact_creation"
      }
    ];
  }

  private initializeConversationExamples() {
    this.conversationExamples = [
      {
        flow: [
          "User: create a chart",
          "AI: What type of data would you like to visualize?",
          "User: deals by stage",
          "AI: Perfect! Here's your chart of deals by stage..."
        ],
        successfulPattern: "progressive_disclosure",
        context: "chart_creation",
        outcome: "success"
      },
      {
        flow: [
          "User: update contact",
          "AI: Which contact would you like to update?",
          "User: john smith",
          "AI: What field would you like to update?",
          "User: email",
          "AI: What's the new email address?",
          "User: john@acme.com",
          "AI: Please confirm the update..."
        ],
        successfulPattern: "step_by_step_guidance",
        context: "contact_update",
        outcome: "success"
      }
    ];
  }

  // Chart-specific methods
  async enhanceChartPrompt(originalPrompt: string, userQuery: string): Promise<string> {
    const relevantExamples = this.findRelevantChartExamples(userQuery);
    
    if (relevantExamples.length === 0) {
      return originalPrompt;
    }

    const examplesText = relevantExamples
      .map(ex => `User: "${ex.query}" → Chart: ${ex.successfulChart.chartType} of ${ex.successfulChart.dataType} by ${ex.successfulChart.dimension}`)
      .join('\n');

    return `
${originalPrompt}

Based on these successful chart creation patterns:
${examplesText}

Current user query: "${userQuery}"

Use these examples to determine the appropriate chart type, data structure, and visualization approach.
`;
  }

  public findRelevantChartExamples(query: string): ChartExample[] {
    const queryLower = query.toLowerCase();
    const keywords = ['chart', 'graph', 'pie', 'bar', 'line', 'deals', 'contacts', 'stage', 'status'];
    
    return this.chartExamples
      .filter(example => {
        const exampleLower = example.query.toLowerCase();
        return keywords.some(keyword => exampleLower.includes(keyword) && queryLower.includes(keyword));
      })
      .slice(0, 2);
  }

  // Analysis-specific methods
  async enhanceAnalysisPrompt(originalPrompt: string, userQuery: string): Promise<string> {
    const relevantExamples = this.findRelevantAnalysisExamples(userQuery);
    
    if (relevantExamples.length === 0) {
      return originalPrompt;
    }

    const examplesText = relevantExamples
      .map(ex => `User: "${ex.query}" → Method: ${ex.successfulAnalysis.method}, Insights: ${ex.successfulAnalysis.insights.join(', ')}`)
      .join('\n');

    return `
${originalPrompt}

Based on these successful analysis patterns:
${examplesText}

Current user query: "${userQuery}"

Use these examples to determine the appropriate analysis method and insights to generate.
`;
  }

  public findRelevantAnalysisExamples(query: string): AnalysisExample[] {
    const queryLower = query.toLowerCase();
    const analysisKeywords = ['analyze', 'which', 'most', 'pipeline', 'sales', 'account'];
    
    return this.analysisExamples
      .filter(example => {
        const exampleLower = example.query.toLowerCase();
        return analysisKeywords.some(keyword => exampleLower.includes(keyword) && queryLower.includes(keyword));
      })
      .slice(0, 2);
  }

  // CRM-specific methods
  async enhanceCRMPrompt(originalPrompt: string, userQuery: string): Promise<string> {
    const relevantExamples = this.findRelevantCRMExamples(userQuery);
    
    if (relevantExamples.length === 0) {
      return originalPrompt;
    }

    const examplesText = relevantExamples
      .map(ex => `User: "${ex.query}" → Operation: ${ex.successfulOperation.entityExtraction}, Field: ${ex.successfulOperation.fieldMapping}`)
      .join('\n');

    return `
${originalPrompt}

Based on these successful CRM operation patterns:
${examplesText}

Current user query: "${userQuery}"

Use these examples to determine the appropriate entity extraction and field mapping approach.
`;
  }

  private findRelevantCRMExamples(query: string): CRMExample[] {
    const queryLower = query.toLowerCase();
    const crmKeywords = ['update', 'create', 'contact', 'email', 'company', 'phone'];
    
    return this.crmExamples
      .filter(example => {
        const exampleLower = example.query.toLowerCase();
        return crmKeywords.some(keyword => exampleLower.includes(keyword) && queryLower.includes(keyword));
      })
      .slice(0, 2);
  }

  // Learning methods
  async logSuccessfulChart(query: string, chartSpec: any): Promise<void> {
    const example: ChartExample = {
      query,
      successfulChart: {
        chartType: chartSpec.chartType,
        dataType: chartSpec.dataType,
        dimension: chartSpec.dimension,
        dataStructure: 'aggregated',
        title: chartSpec.title
      },
      context: 'chart_creation'
    };
    
    this.chartExamples.push(example);
    console.log('📊 Logged successful chart pattern:', { query, chartType: chartSpec.chartType });
  }

  async logSuccessfulAnalysis(query: string, analysis: any): Promise<void> {
    const example: AnalysisExample = {
      query,
      successfulAnalysis: {
        method: analysis.method,
        visualization: analysis.visualization,
        insights: analysis.insights,
        dataQuery: analysis.dataQuery
      },
      context: 'analysis'
    };
    
    this.analysisExamples.push(example);
    console.log('📈 Logged successful analysis pattern:', { query, method: analysis.method });
  }

  async logSuccessfulCRMOperation(query: string, operation: any): Promise<void> {
    const example: CRMExample = {
      query,
      successfulOperation: {
        entityExtraction: operation.entityExtraction,
        fieldMapping: operation.fieldMapping,
        confirmationFlow: operation.confirmationFlow,
        dataValidation: operation.dataValidation
      },
      context: 'crm_operation'
    };
    
    this.crmExamples.push(example);
    console.log('👤 Logged successful CRM operation:', { query, operation: operation.entityExtraction });
  }

  // Statistics
  getStats() {
    return {
      chartExamples: this.chartExamples.length,
      analysisExamples: this.analysisExamples.length,
      crmExamples: this.crmExamples.length,
      conversationExamples: this.conversationExamples.length
    };
  }
}

// Export singleton instance
export const specializedRAG = new SpecializedRAGSystem(); 