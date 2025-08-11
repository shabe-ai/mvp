import { Message } from '@/types/chat';
import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { logError } from '@/lib/errorLogger';

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
    const filteredRecords = applyFilters(records, userMessage, dataType);
    
    console.log('🔍 Filtering result:', {
      originalCount: records.length,
      filteredCount: filteredRecords.length,
      userMessage
    });
    
    // Check if user explicitly asked for "all" records
    const lowerUserMessage = userMessage.toLowerCase();
    const requestedAll = lowerUserMessage.includes('all') || lowerUserMessage.includes('view') && !extractFilterTerms(userMessage).length;
    
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

// Helper function to apply filters based on user message
function applyFilters(records: DatabaseRecord[], userMessage: string, dataType: string): DatabaseRecord[] {
  const message = userMessage.toLowerCase();
  
  // Extract filter terms from the message
  const filterTerms = extractFilterTerms(message);
  
  console.log('🔍 Filtering debug:', {
    originalMessage: userMessage,
    extractedTerms: filterTerms,
    dataType: dataType,
    totalRecords: records.length
  });
  
  if (filterTerms.length === 0) {
    return records; // No filters, return all records
  }
  
  const filteredRecords = records.filter((record: DatabaseRecord) => {
    if (dataType === 'contacts') {
      const fullName = `${record.firstName || ''} ${record.lastName || ''}`.toLowerCase().trim();
      const firstName = (record.firstName || '').toLowerCase();
      const lastName = (record.lastName || '').toLowerCase();
      const email = (record.email || '').toLowerCase();
      const company = (record.company || '').toLowerCase();
      const title = (record.title || '').toLowerCase();
      
      // Check for company/title specific queries
      if (message.includes(' at ') || message.includes(' with ')) {
        // If query contains "at company" or "with title", prioritize those matches
        if (message.includes(' at ') && filterTerms.some(term => company.includes(term))) {
          return true;
        }
        if (message.includes(' with ') && filterTerms.some(term => title.includes(term))) {
          return true;
        }
      }
      
      return filterTerms.some(term => {
        return fullName.includes(term) || 
               firstName.includes(term) || 
               lastName.includes(term) || 
               email.includes(term) || 
               company.includes(term) || 
               title.includes(term);
      });
    } else if (dataType === 'accounts') {
      return filterTerms.some(term => {
        const name = (record.name || '').toLowerCase();
        const industry = (record.industry || '').toLowerCase();
        const website = (record.website || '').toLowerCase();
        
        return name.includes(term) || 
               industry.includes(term) || 
               website.includes(term);
      });
    } else if (dataType === 'deals') {
      return filterTerms.some(term => {
        const name = (record.name || '').toLowerCase();
        const stage = (record.stage || '').toLowerCase();
        const value = (record.value || '').toLowerCase();
        
        return name.includes(term) || 
               stage.includes(term) || 
               value.includes(term);
      });
    } else if (dataType === 'activities') {
      return filterTerms.some(term => {
        const type = (record.type || '').toLowerCase();
        const subject = (record.subject || '').toLowerCase();
        const status = (record.status || '').toLowerCase();
        
        return type.includes(term) || 
               subject.includes(term) || 
               status.includes(term);
      });
    }
    
    return true; // Default to include if unknown data type
  });
  
  console.log('🔍 Filtering result:', {
    filteredCount: filteredRecords.length,
    sampleRecords: filteredRecords.slice(0, 3).map(r => ({
      name: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      email: r.email,
      company: r.company
    }))
  });
  
  return filteredRecords;
}

function extractFilterTerms(message: string): string[] {
  // Remove common words that aren't useful for filtering
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'show', 'view', 'list', 'see', 'get', 'find', 'search', 'all', 'my', 'our', 'their',
    'contact', 'contacts', 'account', 'accounts', 'deal', 'deals', 'activity', 'activities'
  ]);
  
  // Extract words that could be filter terms
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  return [...new Set(words)]; // Remove duplicates
}

function getFilterInfo(userMessage: string): string | null {
  const filterTerms = extractFilterTerms(userMessage);
  return filterTerms.length > 0 ? filterTerms.join(' ') : null;
}

function formatRecord(record: DatabaseRecord, dataType: string): FormattedRecord {
  const baseRecord = {
    id: record._id,
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

export async function handleContactUpdateWithConfirmation(message: string, userId: string) {
  // This is a placeholder - we'll need to copy the actual implementation
  // For now, return a basic response
  return {
    message: "Contact update functionality is being implemented.",
    error: false
  };
}

export async function handleContactDeleteWithConfirmation(message: string, userId: string) {
  // This is a placeholder - we'll need to copy the actual implementation
  // For now, return a basic response
  return {
    message: "Contact deletion functionality is being implemented.",
    error: false
  };
}

export async function handleGeneralConversation(message: string, messages: Message[], context: UserContext, userId?: string) {
  // This is a placeholder - we'll need to copy the actual implementation
  // For now, return a basic response
  return {
    message: "General conversation functionality is being implemented.",
    suggestions: [],
    conversationContext: {
      phase: 'general',
      action: 'general_conversation',
      referringTo: 'new_request'
    }
  };
} 