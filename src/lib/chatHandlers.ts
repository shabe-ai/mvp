import { Message } from '@/types/chat';
import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { logError } from '@/lib/errorLogger';
import { getConversationManager } from './conversationManager';
import { performanceOptimizer } from './performanceOptimizer';
import { errorHandler } from './errorHandler';
import { edgeCaseHandler } from './edgeCaseHandler';
import { specializedRAG } from './specializedRAG';

interface UserContext {
  userProfile: {
    name: string;
    email: string;
    company: string;
  };
  companyData: {
    name: string;
    website: string;
    description: string;
  };
  conversationHistory: Message[];
  sessionFiles: Array<{ name: string; content: string }>;
}

interface DatabaseRecord {
  _id: string;
  _creationTime: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  leadStatus?: string;
  contactType?: string;
  source?: string;
  name?: string;
  industry?: string;
  size?: string;
  website?: string;
  value?: string;
  stage?: string;
  probability?: string | number;
  type?: string;
  subject?: string;
  status?: string;
  dueDate?: string;
}

interface FormattedRecord {
  id: string;
  _id: string; // Add _id for LiveTables compatibility
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  status: string;
  type: string;
  source: string;
  created: string;
  industry?: string;
  size?: string;
  website?: string;
  value?: string;
  stage?: string;
  probability?: string;
  dueDate?: string;
  subject?: string;
}

interface DatabaseOperationResult {
  message: string;
  data?: {
    records: FormattedRecord[];
    type: string;
    count: number;
    displayFormat: string;
  };
  needsClarification?: boolean;
  error?: boolean;
}

// Import the functions from the route file
// Note: We'll need to copy the function implementations here since we can't export them from the route file

export async function handleChartGeneration(message: string, entities: Record<string, unknown>, sessionFiles: Array<{ name: string; content: string }>, userId: string) {
  // Use existing chart generation logic
  const result = await handleChart(message, sessionFiles, userId);
  return result;
}

// Chart generation handler with actual CRM data
async function handleChart(userMessage: string, sessionFiles: Array<{ name: string; content: string }>, userId?: string) {
  try {
    console.log('🚀 Starting enhanced chart generation for user:', userId);
    console.log('📜 Session files available:', sessionFiles.length);
    
    // Enhance chart generation with specialized RAG
    const enhancedMessage = await specializedRAG.enhanceChartPrompt(userMessage, userMessage);
    console.log('🧠 Using RAG-enhanced chart generation');
    
    if (!userId) {
      throw new Error('User ID is required for chart generation');
    }
    
    // Determine what data to fetch based on user request
    const lowerMessage = userMessage.toLowerCase();
    
    // Check if user specifically wants CRM data (deals, contacts, accounts)
    const wantsCrmData = lowerMessage.includes('deal') || lowerMessage.includes('contact') || 
                        lowerMessage.includes('account') || lowerMessage.includes('crm') ||
                        lowerMessage.includes('sales') || lowerMessage.includes('pipeline');
    
    // Check if we have uploaded files and user wants file data
    if (sessionFiles && sessionFiles.length > 0 && !wantsCrmData) {
      console.log('🚀 Analyzing uploaded file data for enhanced chart generation');
      return await generateChartFromFileData(userMessage, sessionFiles);
    }
    
    // Analyze CRM data (either no files or user wants CRM data specifically)
    console.log('🚀 Analyzing CRM data for enhanced chart generation');
    
    // Get user's team and data
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    let chartData: Array<{ stage?: string; status?: string; industry?: string; count: number; name: string }> = [];
    let chartType = 'bar';
    let title = 'Chart';
    let dataType = 'deals';
    let dimension = 'stage';
    
    // Detect user's preferred chart type from the message
    console.log('🚀 Detecting chart type from message:', userMessage);
    if (lowerMessage.includes('line') || lowerMessage.includes('trend')) {
      chartType = 'line';
    } else if (lowerMessage.includes('pie') || lowerMessage.includes('distribution')) {
      chartType = 'pie';
    } else if (lowerMessage.includes('area')) {
      chartType = 'area';
    } else if (lowerMessage.includes('bar') || lowerMessage.includes('column')) {
      chartType = 'bar';
    }
    
    // Determine what data to chart based on user request
    if (lowerMessage.includes('deal')) {
      // Deals chart
      console.log('🚀 Generating deals chart');
      dataType = 'deals';
      dimension = 'stage';
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      
      // Group deals by stage
      const stageGroups: Record<string, number> = {};
      deals.forEach(deal => {
        const stage = deal.stage || 'new';
        stageGroups[stage] = (stageGroups[stage] || 0) + 1;
      });
      
      chartData = Object.entries(stageGroups).map(([stage, count]) => ({
        stage,
        count,
        name: stage
      }));
      
      title = 'Deals by Stage';
      
    } else if (lowerMessage.includes('contact')) {
      // Contacts chart
      console.log('🚀 Generating contacts chart');
      dataType = 'contacts';
      dimension = 'leadStatus';
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      
      // Group contacts by lead status
      const statusGroups: Record<string, number> = {};
      contacts.forEach(contact => {
        const status = contact.leadStatus || 'new';
        statusGroups[status] = (statusGroups[status] || 0) + 1;
      });
      
      chartData = Object.entries(statusGroups).map(([status, count]) => ({
        status,
        count,
        name: status
      }));
      
      title = 'Contacts by Lead Status';
      
    } else if (lowerMessage.includes('account')) {
      // Accounts chart
      console.log('🚀 Generating accounts chart');
      dataType = 'accounts';
      dimension = 'industry';
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      
      // Group accounts by industry
      const industryGroups: Record<string, number> = {};
      accounts.forEach(account => {
        const industry = account.industry || 'Unknown';
        industryGroups[industry] = (industryGroups[industry] || 0) + 1;
      });
      
      chartData = Object.entries(industryGroups).map(([industry, count]) => ({
        industry,
        count,
        name: industry
      }));
      
      title = 'Accounts by Industry';
      
    } else {
      // Ask for clarification when chart type is unclear
      console.log('🚀 Chart request unclear, asking for clarification');
      
      return {
        message: "I'd be happy to create an enhanced chart for you! To provide the most relevant visualization with AI-powered insights, could you please specify what type of data you'd like to see? For example:\n\n• **Deals by stage** - Shows your sales pipeline with trend analysis\n• **Contacts by status** - Shows lead progression with conversion insights\n• **Accounts by industry** - Shows customer distribution with market analysis\n\nOr feel free to describe any other data you'd like visualized from your CRM. I'll provide AI-powered insights and interactive features!",
        needsClarification: true,
        action: 'chart_clarification'
      };
    }
    
    console.log('🚀 Enhanced chart data generated:', { chartData, chartType, title });
    
    if (chartData.length === 0) {
      return {
        message: "No data available to create a chart. Please add some records to your CRM first.",
        error: true
      };
    }
    
    // Determine the appropriate data key for X-axis
    const xAxisDataKey = chartType === 'bar' ? 
      (chartData[0].stage ? 'stage' : chartData[0].status ? 'status' : chartData[0].industry ? 'industry' : 'name') : 
      'name';
    
    // Create enhanced chart specification with AI insights
    const enhancedChartSpec: any = {
      chartType,
      data: chartData,
      title,
      dataSource: 'database' as const,
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalRecords: chartData.reduce((sum, item) => sum + item.count, 0),
        dateRange: 'All time',
        filters: []
      },
      chartConfig: {
        width: 600,
        height: 400,
        margin: { top: 20, right: 30, left: 20, bottom: 60 },
        xAxis: { dataKey: xAxisDataKey },
        yAxis: { dataKey: 'count' },
        colors: ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6"],
        showGrid: true,
        showLegend: true,
        showTooltip: true,
        animation: true
      }
    };
    
    // Generate AI insights for the chart
    try {
      const { enhancedAnalytics } = await import('@/lib/enhancedAnalytics');
      const insights = await enhancedAnalytics.generateInsights(
        chartData,
        chartType,
        'database',
        userMessage
      );
      
      enhancedChartSpec.insights = insights;
      
      console.log('🚀 Generated AI insights:', insights.length);
    } catch (error) {
      console.error('❌ Error generating insights:', error);
      // Continue without insights if there's an error
    }
    
    // Log successful chart generation for RAG learning
    try {
      await specializedRAG.logSuccessfulChart(userMessage, {
        chartType,
        dataType,
        dimension,
        title
      });
    } catch (error) {
      console.error('❌ Error logging chart for RAG:', error);
    }
    
    return {
      message: `I've generated an enhanced ${title.toLowerCase()} chart for you with AI-powered insights and interactive features! You can now:\n\n• **Modify the chart** - "Change to pie chart" or "Hide grid"\n• **Get deeper insights** - "Analyze trends" or "Find anomalies"\n• **Export data** - "Export as CSV" or "Save as PNG"\n• **Predict trends** - "Forecast next month"\n\nTry asking me to modify or analyze the chart!`,
      chartSpec: enhancedChartSpec,
      enhancedChart: true
    };
    
  } catch (error) {
    console.error('❌ Chart generation error:', error);
    return {
      message: "I encountered an error while generating the chart. Please try again.",
      error: true
    };
  }
}

// Function to generate charts from uploaded file data
async function generateChartFromFileData(userMessage: string, sessionFiles: Array<{ name: string; content: string }>) {
  try {
    console.log('📊 Generating chart from file data');
    console.log('📂 Available sessionFiles:', sessionFiles.map(f => ({ name: f.name, contentLength: f.content?.length })));
    
    // Get the first file content for analysis
    const fileContent = sessionFiles[0].content;
    const fileName = sessionFiles[0].name;
    
    console.log('📁 Analyzing file:', fileName, 'Content length:', fileContent.length);
    console.log('📄 First 500 characters of file content:', fileContent.substring(0, 500));
    
    // Use OpenAI to analyze the file content and generate chart data
    const analysisPrompt = `
Analyze the following data from a file named "${fileName}" and determine what type of chart would be most appropriate. Then extract the data in a format suitable for charting.

File Content:
${fileContent}

User Request: "${userMessage}"

Your task:
1. Identify what type of data this is (sales data, financial data, survey results, etc.)
2. Determine the best chart type (bar, line, pie, etc.)
3. Extract the key data points for visualization
4. Structure the data for a chart

Respond with a JSON object in this exact format:
    {
      "chartType": "bar|line|pie|area",
  "title": "Chart Title",
  "data": [
    {"name": "Category1", "value": 100, "label": "Category1"},
    {"name": "Category2", "value": 200, "label": "Category2"}
  ],
  "xAxisKey": "name",
  "yAxisKey": "value",
  "description": "Brief description of what the chart shows"
}

Important:
- For bar/line charts: use "name" for categories and "value" for numbers
- For pie charts: use "name" for labels and "value" for amounts
- Extract actual numbers from the data, don't make them up
- Choose the most relevant data points (max 10-15 data points)
- If the data contains multiple possible charts, pick the most relevant one based on the user's request
`;

    const { openaiClient } = await import('@/lib/openaiClient');
    const completion = await openaiClient.chatCompletionsCreate({
      model: 'gpt-4',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.1,
      max_tokens: 1000
    }, {
      userId: 'file-chart-analysis',
      operation: 'file_chart_generation',
      model: 'gpt-4'
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('🤖 OpenAI chart analysis response:', response);

    // Parse the JSON response
    let chartAnalysis;
    try {
      chartAnalysis = JSON.parse(response);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', parseError);
      throw new Error('Failed to analyze file data for charting');
    }

    // Validate the response structure
    if (!chartAnalysis.chartType || !chartAnalysis.data || !Array.isArray(chartAnalysis.data)) {
      throw new Error('Invalid chart analysis response structure');
    }

    // Create chart specification compatible with ChartDisplay component
    const chartSpec = {
      chartType: chartAnalysis.chartType,
      data: chartAnalysis.data,
      title: chartAnalysis.title,
      chartConfig: {
        width: 600,
        height: 400,
        margin: { top: 20, right: 30, left: 20, bottom: 60 },
        xAxis: { dataKey: chartAnalysis.xAxisKey || 'name' },
        yAxis: { dataKey: chartAnalysis.yAxisKey || 'value' }
      }
    };

    console.log('📊 Generated chart spec from file:', chartSpec);

    return {
      message: `I've analyzed your uploaded file "${fileName}" and created a ${chartAnalysis.chartType} chart. ${chartAnalysis.description || ''}`,
      chartSpec,
      enhancedChart: false
    };

  } catch (error) {
    console.error('❌ Error generating chart from file data:', error);
    return {
      message: "I encountered an error while analyzing your file data. Please try again.",
      error: true
    };
  }
}

export async function handleDatabaseQuery(message: string, entities: Record<string, unknown>, userId: string) {
  // Use existing database operation logic
  const result = await handleDatabaseOperation(message, userId);
  return result;
}

// Database operation handler (existing logic)
async function handleDatabaseOperation(userMessage: string, userId: string): Promise<DatabaseOperationResult> {
  // Implementation from existing code
  const message = userMessage.toLowerCase();
  const isContactQuery = message.includes('contact');
  const isAccountQuery = message.includes('account');
  const isDealQuery = message.includes('deal');
  const isActivityQuery = message.includes('activity');
  
  try {
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    
    let dataType = '';
    let records: DatabaseRecord[] = [];
    
    // Default to contacts if no specific type is mentioned
    if (isContactQuery || (!isAccountQuery && !isDealQuery && !isActivityQuery)) {
      dataType = 'contacts';
      records = await convex.query(api.crm.getContactsByTeam, { teamId });
    } else if (isAccountQuery) {
      dataType = 'accounts';
      records = await convex.query(api.crm.getAccountsByTeam, { teamId });
    } else if (isDealQuery) {
      dataType = 'deals';
      records = await convex.query(api.crm.getDealsByTeam, { teamId });
    } else if (isActivityQuery) {
      dataType = 'activities';
      records = await convex.query(api.crm.getActivitiesByTeam, { teamId });
    }
    
    console.log('🔍 Database operation debug:', {
      userMessage,
      dataType,
      recordsCount: records.length,
      isContactQuery,
      isAccountQuery,
      isDealQuery,
      isActivityQuery
    });
    
    if (records.length === 0) {
      return {
        message: `No ${dataType} found for the specified criteria.`
      };
    }
    
    // Apply filtering based on user message
    const filteredRecords = await applyFilters(records, userMessage, dataType);
    
    console.log('🔍 Filtering result:', {
      originalCount: records.length,
      filteredCount: filteredRecords.length,
      userMessage
    });
    
    // Check if user explicitly asked for "all" records
    const lowerUserMessage = userMessage.toLowerCase();
    const requestedAll = lowerUserMessage.includes('all') || 
                        (lowerUserMessage.includes('view') && !lowerUserMessage.includes('account') && !lowerUserMessage.includes('contact') && !lowerUserMessage.includes('deal') && !lowerUserMessage.includes('activity'));
    
    // If filtering returns too many results or ambiguous results, ask for clarification
    // BUT NOT if user explicitly asked for "all" records
    if (filteredRecords.length > 3 && !requestedAll) {
      const clarificationMessage = getClarificationMessage(dataType, filteredRecords);
      return {
        message: clarificationMessage,
        needsClarification: true,
        data: {
          records: filteredRecords.slice(0, 5).map((record: DatabaseRecord) => formatRecord(record, dataType)),
          type: dataType,
          count: filteredRecords.length,
          displayFormat: 'table'
        }
      };
    }
    
    if (filteredRecords.length === 0) {
      return {
        message: `No ${dataType} found matching your filter criteria.`
      };
    }
    
    // Format records for table display
    const formattedRecords = filteredRecords.map((record: DatabaseRecord) => formatRecord(record, dataType));
    
    const filterInfo = getFilterInfo(userMessage);
    const message = filterInfo ? 
      `Found ${formattedRecords.length} ${dataType} matching "${filterInfo}":` :
      `Found ${formattedRecords.length} ${dataType}:`;

    return {
      message: message,
      data: {
        records: formattedRecords,
        type: dataType,
        count: formattedRecords.length,
        displayFormat: 'table'
      }
    };
  } catch (error) {
    console.error('Database operation error:', error);
    return {
      message: "I encountered an error while querying the database. Please try again.",
      error: true
    };
  }
}

// LLM-powered filtering system
async function applyFilters(records: DatabaseRecord[], userMessage: string, dataType: string): Promise<DatabaseRecord[]> {
  console.log('🧠 Using LLM-powered filtering for:', userMessage);
  console.log('🧠 Data type:', dataType, 'Records count:', records.length);
  
  try {
    // Import OpenAI client
    const { openaiClient } = await import('@/lib/openaiClient');
    
    // Prepare the records data for the LLM
    const recordsData = records.map(record => {
      if (dataType === 'contacts') {
        return {
          id: record._id,
          name: `${record.firstName || ''} ${record.lastName || ''}`.trim(),
          email: record.email || '',
          company: record.company || '',
          title: record.title || '',
          status: record.leadStatus || '',
          type: record.contactType || ''
        };
      } else if (dataType === 'accounts') {
        return {
          id: record._id,
          name: record.name || '',
          industry: record.industry || '',
          website: record.website || '',
          size: record.size || ''
        };
      } else if (dataType === 'deals') {
        return {
          id: record._id,
          name: record.name || '',
          stage: record.stage || '',
          value: record.value || '',
          probability: record.probability || ''
        };
      } else if (dataType === 'activities') {
        return {
          id: record._id,
          subject: record.subject || '',
          type: record.type || '',
          status: record.status || '',
          dueDate: record.dueDate || ''
        };
      }
      return record;
    });
    
    console.log('🧠 Records data prepared for LLM:', recordsData.slice(0, 3)); // Log first 3 records
    
    const systemPrompt = `You are an expert database filtering system. Your job is to filter records based on the user's query.

**Available Records (${dataType}):**
${JSON.stringify(recordsData, null, 2)}

**User Query:** "${userMessage}"

**Instructions:**
1. Analyze the user's query to understand what they're looking for
2. Return ONLY the IDs of records that match their criteria
3. Be intelligent about partial matches, synonyms, and context
4. If the user asks for "all" or doesn't specify filters, return all IDs
5. If no records match, return an empty array

**Examples:**
- "view account acme" → Return IDs of accounts with "acme" in the name
- "show contacts at tech company" → Return IDs of contacts at tech companies
- "find deals in closing stage" → Return IDs of deals with "closing" stage
- "all contacts" → Return all contact IDs
- "view kavean gobal" → Return ID of contact named "kavean gobal"
- "what is kavean gobal's email" → Return ID of contact named "kavean gobal"

**Return Format:**
Return ONLY a JSON array of matching record IDs:
["id1", "id2", "id3"]

**Important:** Return ONLY the JSON array, no other text.`;

    console.log('🧠 Sending request to LLM with prompt length:', systemPrompt.length);
    
    const response = await openaiClient.chatCompletionsCreate({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Filter the ${dataType} records based on this query: "${userMessage}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    }, {
      userId: 'database-filtering',
      operation: 'database_filtering',
      model: 'gpt-4'
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('❌ No response from LLM filtering');
      return records; // Fallback to all records
    }

    console.log('🧠 LLM filtering response:', content);

    // Parse the response
    let matchingIds: string[] = [];
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        matchingIds = parsed;
      } else if (parsed.ids && Array.isArray(parsed.ids)) {
        matchingIds = parsed.ids;
      }
    } catch (error) {
      console.log('❌ Failed to parse LLM response as JSON, trying to extract IDs');
      console.log('❌ Parse error:', error);
      console.log('❌ Raw content:', content);
      // Fallback: try to extract IDs from text
      const idMatches = content.match(/"([^"]+)"/g);
      if (idMatches) {
        matchingIds = idMatches.map(match => match.replace(/"/g, ''));
      }
    }

    console.log('🧠 LLM identified matching IDs:', matchingIds);

    // Filter records based on LLM response
    const filteredRecords = records.filter(record => matchingIds.includes(record._id));
    
    console.log('🧠 LLM filtering result:', {
      originalCount: records.length,
      filteredCount: filteredRecords.length,
      matchingIds: matchingIds.length,
      filteredRecordNames: filteredRecords.map(r => `${r.firstName || ''} ${r.lastName || ''}`.trim())
    });

    return filteredRecords;
    
  } catch (error) {
    console.error('❌ LLM filtering failed:', error);
    console.log('🔄 Falling back to all records');
    return records; // Fallback to all records if LLM fails
  }
}

function getFilterInfo(userMessage: string): string | null {
  // Since we're now using LLM-powered filtering, we'll return a simple indicator
  // that filtering was applied based on the user's query
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes('all') || lowerMessage.includes('view') || lowerMessage.includes('show')) {
    return null; // No specific filter info needed
  }
  return 'your query'; // Generic filter info
}

function formatRecord(record: DatabaseRecord, dataType: string): FormattedRecord {
  const baseRecord = {
    id: record._id,
    _id: record._id, // Add _id for LiveTables compatibility
    created: new Date(record._creationTime).toLocaleDateString(),
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    status: '',
    type: '',
    source: ''
  };

  if (dataType === 'contacts') {
    return {
      ...baseRecord,
      name: `${record.firstName || ''} ${record.lastName || ''}`.trim(),
      email: record.email || '',
      phone: record.phone || '',
      company: record.company || '',
      title: record.title || '',
      status: record.leadStatus || '',
      type: record.contactType || '',
      source: record.source || ''
    };
  } else if (dataType === 'accounts') {
    return {
      ...baseRecord,
      name: record.name || '',
      email: '',
      phone: '',
      company: record.name || '',
      title: '',
      status: '',
      type: '',
      source: '',
      industry: record.industry || '',
      size: record.size || '',
      website: record.website || ''
    };
  } else if (dataType === 'deals') {
    return {
      ...baseRecord,
      name: record.name || '',
      email: '',
      phone: '',
      company: '',
      title: '',
      status: record.stage || '',
      type: '',
      source: '',
      value: record.value || '',
      stage: record.stage || '',
      probability: record.probability?.toString() || ''
    };
  } else if (dataType === 'activities') {
    return {
      ...baseRecord,
      name: record.subject || '',
      email: '',
      phone: '',
      company: '',
      title: '',
      status: record.status || '',
      type: record.type || '',
      source: '',
      dueDate: record.dueDate || '',
      subject: record.subject || ''
    };
  }

  return baseRecord;
}

function getClarificationMessage(dataType: string, records: DatabaseRecord[]): string {
  const sampleRecords = records.slice(0, 3);
  const sampleNames = sampleRecords.map(record => {
    if (dataType === 'contacts') {
      return `${record.firstName || ''} ${record.lastName || ''}`.trim();
    } else if (dataType === 'accounts') {
      return record.name || '';
    } else if (dataType === 'deals') {
      return record.name || '';
    } else if (dataType === 'activities') {
      return record.subject || '';
    }
    return '';
  }).filter(name => name.length > 0);

  return `I found ${records.length} ${dataType}. Could you be more specific? For example, you could search by name, company, or other details. Here are some examples: ${sampleNames.join(', ')}`;
}



export async function handleContactDeleteWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting contact deletion for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract contact name from the message
    const lowerMessage = message.toLowerCase();
    
    // Extract name (look for patterns like "john smith", "john", "smith")
    const nameMatch = message.match(/\b([A-Za-z]+)\s+([A-Za-z]+)\b/) || 
                     message.match(/\b([A-Za-z]+)\b/);
    const contactName = nameMatch ? nameMatch[0] : null;
    
    console.log('📝 Extracted contact name:', contactName);
    
    if (!contactName) {
      console.log('❌ Missing contact name for deletion');
      return {
        message: "I couldn't understand the deletion request. Please specify the contact name. For example: 'delete john smith'",
        error: true
      };
    }
    
    // Find the contact in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up contacts for team...');
    const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
    console.log('👥 Contacts found:', contacts.length);
    
    const matchingContact = contacts.find(contact => {
      const contactFullName = contact.firstName && contact.lastName 
        ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
        : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
      const searchName = contactName.toLowerCase();
      
      return contactFullName.includes(searchName) || 
             searchName.includes(contactFullName) ||
             contactFullName.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => contactFullName.includes(part));
    });
    
    if (!matchingContact) {
      console.log('❌ No matching contact found');
      return {
        message: `I couldn't find a contact named "${contactName}" in your database. Please check the spelling.`,
        error: true
      };
    }
    
    console.log('✅ Found matching contact:', matchingContact);
    
    // Ask for confirmation before deleting
    const confirmationMessage = `Please confirm the contact deletion:\n\n**Contact:** ${matchingContact.firstName} ${matchingContact.lastName}\n**Email:** ${matchingContact.email || 'N/A'}\n**Company:** ${matchingContact.company || 'N/A'}\n\nThis action cannot be undone. Are you sure you want to delete this contact? Please respond with "yes" to confirm or "no" to cancel.`;
    
    return {
      message: confirmationMessage,
      action: "confirm_delete",
      contactId: matchingContact._id,
      contactName: `${matchingContact.firstName} ${matchingContact.lastName}`
    };
    
  } catch (error) {
    console.error('Contact deletion failed:', error);
    return {
      message: "I encountered an error while processing the contact deletion. Please try again.",
      error: true
    };
  }
}

export async function handleGeneralConversation(message: string, messages: Message[], context: UserContext, userId?: string) {
  const startTime = Date.now();
  let retryCount = 0;
  
  try {
    console.log('💬 Handling general conversation with Phase 5 optimizations');
    
    // Get user's data for context
    const actualUserId = userId || context.userProfile?.email || 'unknown';
    console.log('🔍 Getting data for user:', actualUserId);
    
    // Check if this is a count query - if so, don't use general conversation
    const isCountQuery = message.toLowerCase().includes('how many') || message.toLowerCase().includes('count');
    if (isCountQuery) {
      console.log('🔍 Count query detected in general conversation, redirecting to structured analysis');
      throw new Error('Count query should use structured analysis');
    }
    
    // Phase 5: Edge case handling
    const edgeCaseContext = {
      userId: actualUserId,
      operation: 'general_conversation',
      input: message,
      timestamp: new Date(),
      retryCount
    };
    
    const edgeCaseResult = await edgeCaseHandler.checkEdgeCases(message, edgeCaseContext);
    if (edgeCaseResult.handled) {
      console.log('🔧 Edge case handled:', edgeCaseResult.result);
      return {
        message: edgeCaseResult.result.message,
        suggestions: edgeCaseResult.result.suggestions || [],
        conversationContext: {
          phase: 'edge_case',
          action: 'edge_case_handled',
          referringTo: 'new_request'
        },
        performance: {
          responseTime: Date.now() - startTime,
          optimization: 'edge_case_handling'
        }
      };
    }
    
    // Phase 5: Input validation
    const validation = edgeCaseHandler.validateInput(message);
    if (!validation.isValid) {
      console.log('⚠️ Input validation failed:', validation.issues);
      return {
        message: `I found some issues with your input: ${validation.issues.join(', ')}. ${validation.suggestions.join(' ')}`,
        suggestions: validation.suggestions,
        conversationContext: {
          phase: 'validation',
          action: 'input_validation_failed',
          referringTo: 'new_request'
        },
        performance: {
          responseTime: Date.now() - startTime,
          optimization: 'input_validation'
        }
      };
    }
    
    // Get conversation manager for personality features
    const convManager = getConversationManager(actualUserId, 'session-' + Date.now());
    
    // Analyze sentiment
    const sentiment = await convManager.analyzeSentiment(message, 'general conversation');
    console.log('😊 Sentiment analysis:', sentiment);
    
    // Get user personality
    const personality = await convManager.getUserPersonality();
    console.log('👤 User personality:', personality.communicationStyle);
    
    // Get proactive suggestions
    const suggestions = await convManager.getProactiveSuggestions();
    console.log('💡 Proactive suggestions:', suggestions.length);
    
    // Phase 5: Performance optimization - batch CRM queries
    const crmData = await performanceOptimizer.batchCrmQueries(actualUserId, [
      { type: 'contacts' },
      { type: 'accounts' },
      { type: 'deals' },
      { type: 'activities' }
    ]);
    
    const contacts = crmData.contacts || [];
    const accounts = crmData.accounts || [];
    const deals = crmData.deals || [];
    const activities = crmData.activities || [];
    
    console.log('📋 CRM data loaded:', {
      contacts: contacts.length,
      accounts: accounts.length,
      deals: deals.length,
      activities: activities.length
    });

    const systemPrompt = `You are Shabe AI, a helpful and conversational CRM assistant. You have access to the user's CRM data and can help with:

**Available Data:**
- Contacts: ${contacts.length} contacts (${contacts.slice(0, 3).map(c => `${c.firstName} ${c.lastName}`).join(', ')}${contacts.length > 3 ? ' and more...' : ''}
- Accounts: ${accounts.length} accounts
- Deals: ${deals.length} deals  
- Activities: ${activities.length} activities

**Your Capabilities:**
- View and search contacts, accounts, deals, and activities
- Send emails to contacts
- Create new records
- Update existing records
- Analyze data and provide insights

**Current Context:**
- User: ${context.userProfile?.name || 'Unknown'}
- Company: ${context.companyData?.name || 'Unknown Company'}

**Instructions:**
1. Be conversational and natural, like ChatGPT
2. If the user wants to perform an action (send email, view data, etc.), tell them what you're doing
3. Use the available data to provide helpful responses
4. If you need to perform a specific action, let the user know and ask for confirmation
5. Be helpful and engaging in your responses
6. If the user mentions a contact by name or pronoun, use the available contact data to help them

**Available Actions:**
- To send an email: Mention you'll draft an email for the contact
- To view data: Tell them what you found and show relevant details
- To create records: Ask for the necessary information
- To update records: Confirm the changes you'll make

Respond naturally and conversationally. If the user asks to send an email to someone, tell them you'll draft an email and ask if they'd like you to proceed.`;

    const { openaiClient } = await import('@/lib/openaiClient');
    const response = await openaiClient.chatCompletionsCreate({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        ...messages.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })),
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }, {
      userId: actualUserId,
      operation: 'general_conversation',
      model: 'gpt-4'
    });

    let assistantMessage = response.choices[0]?.message?.content || "I'm here to help! What would you like to do?";

    // Apply personality to response
    assistantMessage = await convManager.applyPersonalityToResponse(assistantMessage, sentiment);
    
    // Learn from this interaction
    await convManager.learnFromInteraction(message, assistantMessage, 'general_conversation', sentiment);

    // Prepare suggestions including proactive ones
    const baseSuggestions = [
      "View all contacts",
      "Create a new contact", 
      "Generate a chart of deals by stage",
      "Send an email to a contact"
    ];

    const proactiveSuggestionTexts = suggestions.map(s => s.title);
    const allSuggestions = [...baseSuggestions, ...proactiveSuggestionTexts].slice(0, 6);

    // Phase 5: Performance metrics
    const responseTime = Date.now() - startTime;
    const performanceSummary = performanceOptimizer.getPerformanceSummary();

    return {
      message: assistantMessage,
      suggestions: allSuggestions,
      conversationContext: {
        phase: 'general',
        action: 'general_conversation',
        referringTo: 'new_request'
      },
      personality: {
        sentiment: sentiment,
        proactiveSuggestions: suggestions
      },
      performance: {
        responseTime,
        cacheHitRate: performanceSummary.cacheHitRate,
        memoryUsage: performanceSummary.memoryUsage,
        optimization: 'phase_5_optimized'
      }
    };
    
  } catch (error) {
    console.error('General conversation error:', error);
    
    // Phase 5: Enhanced error handling
    const errorContext = {
      userId: userId || 'unknown',
      operation: 'general_conversation',
      timestamp: new Date(),
      userMessage: message,
      systemState: { messages: messages.length, context },
      retryCount
    };
    
    const errorResponse = await errorHandler.handleError(error as Error, errorContext);
    
    return {
      message: errorResponse.userFriendlyMessage,
      suggestions: errorResponse.suggestions,
      error: true,
      errorCode: errorResponse.errorCode,
      retryable: errorResponse.retryable,
      performance: {
        responseTime: Date.now() - startTime,
        optimization: 'error_handling'
      }
    };
  }
} 