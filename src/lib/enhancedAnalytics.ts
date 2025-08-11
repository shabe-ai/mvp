import { openaiClient } from "./openaiClient";

// Enhanced analytics types
export interface ChartInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  action?: string;
  data?: Record<string, unknown>;
}

export interface ChartConfig {
  width: number;
  height: number;
  margin?: Record<string, number>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animation?: boolean;
}

export interface EnhancedChartSpec {
  chartType: string;
  data: Record<string, unknown>[];
  chartConfig: ChartConfig;
  title?: string;
  insights?: ChartInsight[];
  dataSource: 'database' | 'file';
  lastUpdated?: string;
  metadata?: {
    totalRecords?: number;
    dateRange?: string;
    filters?: string[];
  };
}

export interface AnalyticsRequest {
  action: 'generate_insights' | 'modify_chart' | 'analyze_data' | 'predict_trends' | 'generate_recommendations';
  chartSpec?: EnhancedChartSpec;
  userRequest?: string;
  data?: Record<string, unknown>[];
  dataSource: 'database' | 'file';
  context?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  insights?: ChartInsight[];
  modifiedChart?: EnhancedChartSpec;
  analysis?: string;
  recommendations?: string[];
  error?: string;
}

// Chart modification patterns
const CHART_MODIFICATION_PATTERNS = {
  type: /(?:change|switch|convert|make|show)\s+(?:to\s+)?(line|bar|pie|area|scatter)\s+(?:chart|graph)/i,
  colors: /(?:change|update|set)\s+(?:the\s+)?(?:colors?|color\s+scheme|palette)/i,
  size: /(?:make|resize|change\s+size|adjust)\s+(?:chart|graph)\s+(?:to\s+)?(?:larger?|smaller?|bigger?)/i,
  grid: /(?:show|hide|toggle|add|remove)\s+(?:the\s+)?(?:grid|gridlines)/i,
  legend: /(?:show|hide|toggle|add|remove)\s+(?:the\s+)?(?:legend)/i,
  tooltip: /(?:show|hide|toggle|add|remove)\s+(?:the\s+)?(?:tooltip|tooltips)/i,
  animation: /(?:enable|disable|turn\s+(?:on|off))\s+(?:animation|animations)/i,
  highlight: /(?:highlight|emphasize|focus\s+on)\s+(.+)/i,
  filter: /(?:filter|show\s+only|display\s+only)\s+(.+)/i,
  sort: /(?:sort|order|arrange)\s+(?:by|in)\s+(.+)/i,
};

// Data analysis patterns
const DATA_ANALYSIS_PATTERNS = {
  trend: /(?:trend|pattern|movement|direction)\s+(?:in|of|for)/i,
  anomaly: /(?:anomaly|outlier|unusual|strange|odd)\s+(?:in|of|for)/i,
  correlation: /(?:correlation|relationship|connection)\s+(?:between|of)/i,
  prediction: /(?:predict|forecast|project|estimate)\s+(?:future|next|upcoming)/i,
  comparison: /(?:compare|versus|vs|against)\s+(.+)/i,
  summary: /(?:summarize|summary|overview|summary)\s+(?:of|for)/i,
};

export class EnhancedAnalytics {
  private static instance: EnhancedAnalytics;

  private constructor() {}

  public static getInstance(): EnhancedAnalytics {
    if (!EnhancedAnalytics.instance) {
      EnhancedAnalytics.instance = new EnhancedAnalytics();
    }
    return EnhancedAnalytics.instance;
  }

  /**
   * Generate AI-powered insights from chart data
   */
  async generateInsights(
    data: Record<string, unknown>[],
    chartType: string,
    dataSource: 'database' | 'file',
    context?: string
  ): Promise<ChartInsight[]> {
    try {
      console.log('🚀 Generating AI insights for:', { dataLength: data.length, chartType, dataSource });

      const systemPrompt = `You are an expert data analyst and business intelligence specialist. Analyze the provided chart data and generate actionable insights.

**Your Role:**
- Identify trends, patterns, anomalies, and opportunities
- Provide business-relevant recommendations
- Assess confidence levels and impact
- Suggest actionable next steps

**Data Context:**
- Chart Type: ${chartType}
- Data Source: ${dataSource === 'database' ? 'CRM Database' : 'Uploaded File'}
- Records: ${data.length}
- Context: ${context || 'General analysis'}

**Insight Types to Generate:**
1. **Trend Analysis** - Identify patterns over time or categories
2. **Anomaly Detection** - Find unusual data points or outliers
3. **Pattern Recognition** - Discover recurring patterns or correlations
4. **Recommendations** - Suggest actionable business improvements
5. **Predictions** - Forecast future trends based on current data

**Response Format:**
Return a JSON array of insights with this structure:
[
  {
    "type": "trend|anomaly|pattern|recommendation|prediction",
    "title": "Brief, descriptive title",
    "description": "Detailed explanation of the insight",
    "confidence": 85,
    "impact": "high|medium|low",
    "action": "Optional suggested action"
  }
]

**Guidelines:**
- Confidence: 0-100 (higher = more certain)
- Impact: high (immediate action needed), medium (important to monitor), low (informational)
- Be specific and actionable
- Consider business implications
- Provide context for recommendations`;

      const userPrompt = `Please analyze this chart data and generate insights:

**Data Sample:**
${JSON.stringify(data.slice(0, 5), null, 2)}

**Full Dataset:**
- Total records: ${data.length}
- Data keys: ${Object.keys(data[0] || {}).join(', ')}
- Chart type: ${chartType}

Generate 3-5 high-quality insights that would be valuable for business decision-making.`;

      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      }, {
        userId: 'enhanced-analytics',
        operation: 'generate_insights',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const insights: ChartInsight[] = JSON.parse(jsonMatch[0]);
      console.log('🚀 Generated insights:', insights);

      return insights;
    } catch (error) {
      console.error('❌ Error generating insights:', error);
      return [];
    }
  }

  /**
   * Modify chart based on natural language request
   */
  async modifyChart(
    chartSpec: EnhancedChartSpec,
    userRequest: string
  ): Promise<EnhancedChartSpec | null> {
    try {
      console.log('🚀 Modifying chart based on request:', userRequest);

      const systemPrompt = `You are an expert chart customization specialist. Modify the chart configuration based on the user's natural language request.

**Current Chart:**
- Type: ${chartSpec.chartType}
- Data Source: ${chartSpec.dataSource}
- Records: ${chartSpec.data.length}
- Current Config: ${JSON.stringify(chartSpec.chartConfig)}

**Available Modifications:**
1. **Chart Type**: line, bar, pie, area, scatter
2. **Visual Settings**: colors, grid, legend, tooltip, animation
3. **Data Display**: highlighting, filtering, sorting
4. **Layout**: size, margins, positioning

**Response Format:**
Return a JSON object with the modified chart specification:
{
  "chartType": "new_type_if_changed",
  "chartConfig": {
    "width": 600,
    "height": 400,
    "margin": { "top": 20, "right": 30, "left": 20, "bottom": 60 },
    "xAxis": { "dataKey": "category" },
    "yAxis": { "dataKey": "value" },
    "colors": ["#f59e0b", "#3b82f6"],
    "showGrid": true,
    "showLegend": true,
    "showTooltip": true,
    "animation": true
  },
  "title": "Updated title if needed"
}

**Guidelines:**
- Only modify what the user specifically requests
- Maintain data integrity
- Ensure the chart remains functional
- Use appropriate colors and settings
- Consider the data type and chart type compatibility`;

      const userPrompt = `User request: "${userRequest}"

Current chart data sample:
${JSON.stringify(chartSpec.data.slice(0, 3), null, 2)}

Please modify the chart according to the user's request. Only change what they specifically asked for.`;

      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1000
      }, {
        userId: 'enhanced-analytics',
        operation: 'modify_chart',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const modifications = JSON.parse(jsonMatch[0]);
      
      // Apply modifications to existing chart spec
      const modifiedSpec: EnhancedChartSpec = {
        ...chartSpec,
        chartType: modifications.chartType || chartSpec.chartType,
        chartConfig: {
          ...chartSpec.chartConfig,
          ...modifications.chartConfig
        },
        title: modifications.title || chartSpec.title,
        lastUpdated: new Date().toISOString()
      };

      console.log('🚀 Chart modifications applied:', modifications);
      return modifiedSpec;
    } catch (error) {
      console.error('❌ Error modifying chart:', error);
      return null;
    }
  }

  /**
   * Analyze data patterns and generate recommendations
   */
  async analyzeData(
    data: Record<string, unknown>[],
    dataSource: 'database' | 'file',
    analysisType?: string
  ): Promise<{ analysis: string; recommendations: string[] }> {
    try {
      console.log('🚀 Analyzing data patterns:', { dataLength: data.length, dataSource, analysisType });

      const systemPrompt = `You are an expert data analyst specializing in business intelligence and pattern recognition. Analyze the provided data and generate insights.

**Analysis Focus:**
- Identify key patterns and trends
- Detect anomalies or outliers
- Find correlations and relationships
- Generate actionable business recommendations
- Assess data quality and completeness

**Data Context:**
- Source: ${dataSource === 'database' ? 'CRM Database' : 'Uploaded File'}
- Records: ${data.length}
- Analysis Type: ${analysisType || 'Comprehensive'}

**Response Format:**
Provide a detailed analysis and recommendations in this structure:
{
  "analysis": "Comprehensive analysis of the data patterns, trends, and insights...",
  "recommendations": [
    "Specific, actionable recommendation 1",
    "Specific, actionable recommendation 2",
    "Specific, actionable recommendation 3"
  ]
}

**Guidelines:**
- Be specific and actionable
- Consider business implications
- Provide context for recommendations
- Focus on high-impact insights
- Use clear, professional language`;

      const userPrompt = `Please analyze this dataset:

**Data Sample:**
${JSON.stringify(data.slice(0, 10), null, 2)}

**Dataset Overview:**
- Total records: ${data.length}
- Data keys: ${Object.keys(data[0] || {}).join(', ')}
- Source: ${dataSource}

Provide a comprehensive analysis and actionable recommendations.`;

      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }, {
        userId: 'enhanced-analytics',
        operation: 'analyze_data',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);
      console.log('🚀 Data analysis completed');

      return {
        analysis: result.analysis,
        recommendations: result.recommendations || []
      };
    } catch (error) {
      console.error('❌ Error analyzing data:', error);
      return {
        analysis: 'Unable to analyze data at this time.',
        recommendations: []
      };
    }
  }

  /**
   * Predict trends based on historical data
   */
  async predictTrends(
    data: Record<string, unknown>[],
    dataSource: 'database' | 'file',
    predictionHorizon: string = 'next 30 days'
  ): Promise<{ predictions: string[]; confidence: number }> {
    try {
      console.log('🚀 Generating trend predictions:', { dataLength: data.length, predictionHorizon });

      const systemPrompt = `You are an expert in predictive analytics and trend forecasting. Analyze historical data to predict future trends and patterns.

**Prediction Context:**
- Data Source: ${dataSource === 'database' ? 'CRM Database' : 'Uploaded File'}
- Historical Records: ${data.length}
- Prediction Horizon: ${predictionHorizon}

**Your Task:**
- Identify patterns in the historical data
- Extrapolate trends into the future
- Assess prediction confidence levels
- Provide actionable insights based on predictions

**Response Format:**
{
  "predictions": [
    "Specific prediction 1 with reasoning",
    "Specific prediction 2 with reasoning",
    "Specific prediction 3 with reasoning"
  ],
  "confidence": 85
}

**Guidelines:**
- Be realistic about prediction accuracy
- Provide reasoning for each prediction
- Consider seasonal patterns and trends
- Assess confidence based on data quality
- Focus on business-relevant predictions`;

      const userPrompt = `Please predict trends based on this historical data:

**Data Sample:**
${JSON.stringify(data.slice(0, 10), null, 2)}

**Prediction Request:**
Forecast trends for the ${predictionHorizon} based on this historical data.

Generate 3-5 specific predictions with confidence assessment.`;

      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 1500
      }, {
        userId: 'enhanced-analytics',
        operation: 'predict_trends',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);
      console.log('🚀 Trend predictions generated');

      return {
        predictions: result.predictions || [],
        confidence: result.confidence || 50
      };
    } catch (error) {
      console.error('❌ Error predicting trends:', error);
      return {
        predictions: ['Unable to generate predictions at this time.'],
        confidence: 0
      };
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateReport(
    chartSpec: EnhancedChartSpec,
    userRequest?: string
  ): Promise<{
    insights: ChartInsight[];
    analysis: string;
    recommendations: string[];
    predictions: string[];
    confidence: number;
  }> {
    try {
      console.log('🚀 Generating comprehensive analytics report');

      const [insights, dataAnalysis, trendPredictions] = await Promise.all([
        this.generateInsights(chartSpec.data, chartSpec.chartType, chartSpec.dataSource, userRequest),
        this.analyzeData(chartSpec.data, chartSpec.dataSource),
        this.predictTrends(chartSpec.data, chartSpec.dataSource)
      ]);

      return {
        insights,
        analysis: dataAnalysis.analysis,
        recommendations: dataAnalysis.recommendations,
        predictions: trendPredictions.predictions,
        confidence: trendPredictions.confidence
      };
    } catch (error) {
      console.error('❌ Error generating report:', error);
      return {
        insights: [],
        analysis: 'Unable to generate report at this time.',
        recommendations: [],
        predictions: [],
        confidence: 0
      };
    }
  }

  /**
   * Detect chart modification intent from natural language
   */
  detectModificationIntent(userRequest: string): {
    type: string;
    confidence: number;
    parameters: Record<string, unknown>;
  } {
    const lowerRequest = userRequest.toLowerCase();
    let highestConfidence = 0;
    let detectedType = 'unknown';
    let parameters: Record<string, unknown> = {};

    // Check for chart type changes
    const typeMatch = lowerRequest.match(CHART_MODIFICATION_PATTERNS.type);
    if (typeMatch) {
      detectedType = 'chart_type';
      highestConfidence = 0.9;
      parameters = { newType: typeMatch[1] };
    }

    // Check for visual modifications
    if (CHART_MODIFICATION_PATTERNS.colors.test(lowerRequest)) {
      detectedType = 'colors';
      highestConfidence = Math.max(highestConfidence, 0.8);
    }

    if (CHART_MODIFICATION_PATTERNS.grid.test(lowerRequest)) {
      detectedType = 'grid';
      highestConfidence = Math.max(highestConfidence, 0.8);
    }

    if (CHART_MODIFICATION_PATTERNS.legend.test(lowerRequest)) {
      detectedType = 'legend';
      highestConfidence = Math.max(highestConfidence, 0.8);
    }

    if (CHART_MODIFICATION_PATTERNS.tooltip.test(lowerRequest)) {
      detectedType = 'tooltip';
      highestConfidence = Math.max(highestConfidence, 0.8);
    }

    if (CHART_MODIFICATION_PATTERNS.animation.test(lowerRequest)) {
      detectedType = 'animation';
      highestConfidence = Math.max(highestConfidence, 0.8);
    }

    // Check for data modifications
    const highlightMatch = lowerRequest.match(CHART_MODIFICATION_PATTERNS.highlight);
    if (highlightMatch) {
      detectedType = 'highlight';
      highestConfidence = Math.max(highestConfidence, 0.7);
      parameters = { target: highlightMatch[1] };
    }

    const filterMatch = lowerRequest.match(CHART_MODIFICATION_PATTERNS.filter);
    if (filterMatch) {
      detectedType = 'filter';
      highestConfidence = Math.max(highestConfidence, 0.7);
      parameters = { filter: filterMatch[1] };
    }

    const sortMatch = lowerRequest.match(CHART_MODIFICATION_PATTERNS.sort);
    if (sortMatch) {
      detectedType = 'sort';
      highestConfidence = Math.max(highestConfidence, 0.7);
      parameters = { sortBy: sortMatch[1] };
    }

    return {
      type: detectedType,
      confidence: highestConfidence,
      parameters
    };
  }

  /**
   * Detect analysis intent from natural language
   */
  detectAnalysisIntent(userRequest: string): {
    type: string;
    confidence: number;
    parameters: Record<string, unknown>;
  } {
    const lowerRequest = userRequest.toLowerCase();
    let highestConfidence = 0;
    let detectedType = 'general';
    let parameters: Record<string, unknown> = {};

    // Check for specific analysis types
    if (DATA_ANALYSIS_PATTERNS.trend.test(lowerRequest)) {
      detectedType = 'trend';
      highestConfidence = 0.9;
    }

    if (DATA_ANALYSIS_PATTERNS.anomaly.test(lowerRequest)) {
      detectedType = 'anomaly';
      highestConfidence = 0.9;
    }

    if (DATA_ANALYSIS_PATTERNS.correlation.test(lowerRequest)) {
      detectedType = 'correlation';
      highestConfidence = 0.9;
    }

    if (DATA_ANALYSIS_PATTERNS.prediction.test(lowerRequest)) {
      detectedType = 'prediction';
      highestConfidence = 0.9;
    }

    if (DATA_ANALYSIS_PATTERNS.comparison.test(lowerRequest)) {
      detectedType = 'comparison';
      highestConfidence = 0.8;
    }

    if (DATA_ANALYSIS_PATTERNS.summary.test(lowerRequest)) {
      detectedType = 'summary';
      highestConfidence = 0.8;
    }

    return {
      type: detectedType,
      confidence: highestConfidence,
      parameters
    };
  }
}

// Export singleton instance
export const enhancedAnalytics = EnhancedAnalytics.getInstance(); 