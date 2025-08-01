import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { ValidationError } from '@/lib/errorHandler';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Enhanced system prompt for V1 - handles both database CRUD and file analysis
const SYSTEM_PROMPT = `You are Shabe AI, a helpful AI assistant that can perform CRUD operations on database records and analyze uploaded files.

Your capabilities:
1. CRUD operations on database records (contacts, accounts, deals, activities)
2. Analyze uploaded files (PDFs, Excel files, CSV files, text files)
3. Generate charts and visualizations from data
4. Provide insights and summaries from both database and file content

When users ask about database records, you can query and manipulate the database directly.
When users upload files, you have direct access to the file content and can provide detailed analysis.

For chart generation:
- Use the handleChart function when users ask for charts or visualizations
- Parse data from uploaded files or database records to create meaningful charts
- Provide insights about the data being visualized

Always be helpful, accurate, and provide actionable insights from the data you analyze.`;

interface Message {
  role: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userId, sessionFiles = [] } = body;

    // Validate required fields
    validateRequiredFields(body, ['userId', 'messages']);
    
    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError('Messages must be a non-empty array', 'INVALID_MESSAGES');
    }

    // Validate each message has required fields
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (!message.role || !message.content) {
        throw new ValidationError(`Message at index ${i} is missing required fields`, 'INVALID_MESSAGE_FORMAT', { index: i });
      }
      validateStringField(message.role, `message[${i}].role`);
      validateStringField(message.content, `message[${i}].content`, 10000); // Max 10k chars per message
    }

    // Get the last user message
    const lastUserMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : "";

    // Create enhanced system prompt with context
    let enhancedSystemPrompt = SYSTEM_PROMPT;
    
    // Add session files context if available
    if (sessionFiles && sessionFiles.length > 0) {
      const sessionFilesContext = sessionFiles.map((file: { name: string; content: string }) => 
        `File: ${file.name}\nContent: ${file.content}`
      ).join('\n\n');
      
      enhancedSystemPrompt += `\n\nSESSION FILES CONTEXT:\n${sessionFilesContext}\n\nCRITICAL: You have DIRECT ACCESS to the following uploaded files for this session. You MUST analyze their content and provide specific insights from the actual data. When users ask about uploaded files, provide detailed analysis, summaries, and insights based on the file content. Do NOT say you cannot access files - you have direct access to the uploaded documents.`;
      
      console.log(`📄 Session files context being provided to AI: ${sessionFiles.length} files`);
    }

    // Check if user is asking for a chart
    const isChartRequest = lastUserMessage.toLowerCase().includes('chart') || 
                          lastUserMessage.toLowerCase().includes('graph') || 
                          lastUserMessage.toLowerCase().includes('visualize') ||
                          lastUserMessage.toLowerCase().includes('plot');

    if (isChartRequest) {
      // Handle chart generation
      const chartResult = await handleChart(lastUserMessage, sessionFiles, userId);
      return NextResponse.json(chartResult);
    }

    // Check if user is asking for database operations
    const isDatabaseQuery = lastUserMessage.toLowerCase().includes('contact') || 
                           lastUserMessage.toLowerCase().includes('account') || 
                           lastUserMessage.toLowerCase().includes('deal') || 
                           lastUserMessage.toLowerCase().includes('activity') ||
                           lastUserMessage.toLowerCase().includes('view') ||
                           lastUserMessage.toLowerCase().includes('show') ||
                           lastUserMessage.toLowerCase().includes('list') ||
                           lastUserMessage.toLowerCase().includes('create') ||
                           lastUserMessage.toLowerCase().includes('add') ||
                           lastUserMessage.toLowerCase().includes('update') ||
                           lastUserMessage.toLowerCase().includes('edit') ||
                           lastUserMessage.toLowerCase().includes('delete') ||
                           lastUserMessage.toLowerCase().includes('remove');

    if (isDatabaseQuery) {
      // Handle database operations
      const dbResult = await handleDatabaseOperation(lastUserMessage, userId);
      return NextResponse.json(dbResult);
    }

    // Call OpenAI for regular conversation
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: enhancedSystemPrompt },
        ...messages.map((msg: Message) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseMessage = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({
      message: responseMessage,
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to validate required fields
function validateRequiredFields(data: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new ValidationError(`Missing required field: ${field}`, 'MISSING_FIELD', { field });
    }
  }
}

// Helper function to validate string fields
function validateStringField(value: unknown, fieldName: string, maxLength?: number) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, 'INVALID_FIELD_TYPE', { field: fieldName });
  }
  if (maxLength && value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`, 'FIELD_TOO_LONG', { field: fieldName, maxLength });
  }
}

// Handle database operations
async function handleDatabaseOperation(userMessage: string, userId: string) {
  try {
    const messageLower = userMessage.toLowerCase();
    
    // Get user's teams first
    const userTeams = await convex.query(api.crm.getTeamsByUser, { userId });
    
    if (!userTeams || userTeams.length === 0) {
      return {
        message: "You don't have access to any teams. Please contact your administrator."
      };
    }
    
    // Use the first team (or we could let user choose)
    const teamId = userTeams[0]._id;
    
    // Determine what type of data to query
    let records: Record<string, unknown>[] = [];
    let dataType = '';
    
    if (messageLower.includes('contact')) {
      records = await convex.query(api.crm.getContactsByTeam, { teamId });
      dataType = 'contacts';
    } else if (messageLower.includes('account')) {
      records = await convex.query(api.crm.getAccountsByTeam, { teamId });
      dataType = 'accounts';
    } else if (messageLower.includes('deal')) {
      records = await convex.query(api.crm.getDealsByTeam, { teamId });
      dataType = 'deals';
    } else if (messageLower.includes('activity')) {
      records = await convex.query(api.crm.getActivitiesByTeam, { teamId });
      dataType = 'activities';
    } else {
      // Default to contacts if no specific type mentioned
      records = await convex.query(api.crm.getContactsByTeam, { teamId });
      dataType = 'contacts';
    }

    // Filter records based on time period if mentioned
    let filteredRecords = records;
    const now = new Date();
    
    if (messageLower.includes('this week')) {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredRecords = records.filter((record: Record<string, unknown>) => {
        const createdAt = new Date((record._creationTime as number));
        return createdAt >= weekAgo;
      });
    } else if (messageLower.includes('this month')) {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredRecords = records.filter((record: Record<string, unknown>) => {
        const createdAt = new Date((record._creationTime as number));
        return createdAt >= monthAgo;
      });
    }

    // Apply field-based filters
    const fieldFilters: Record<string, string> = {};
    
    // Simple and reliable filter patterns
    const filterPatterns = [
      // Exact field = value patterns
      { pattern: /title\s*=\s*(\w+)/i, field: 'title' },
      { pattern: /status\s*=\s*(\w+)/i, field: 'status' },
      { pattern: /type\s*=\s*(\w+)/i, field: 'type' },
      { pattern: /company\s*=\s*(\w+)/i, field: 'company' },
      { pattern: /email\s*=\s*(\w+)/i, field: 'email' },
      { pattern: /phone\s*=\s*(\w+)/i, field: 'phone' },
      { pattern: /source\s*=\s*(\w+)/i, field: 'source' },
      { pattern: /name\s*=\s*(\w+)/i, field: 'name' },
      { pattern: /industry\s*=\s*(\w+)/i, field: 'industry' },
      { pattern: /size\s*=\s*(\w+)/i, field: 'size' },
      { pattern: /stage\s*=\s*(\w+)/i, field: 'stage' },
      { pattern: /value\s*=\s*(\w+)/i, field: 'value' },
      { pattern: /subject\s*=\s*(\w+)/i, field: 'subject' },
      { pattern: /dueDate\s*=\s*(\w+)/i, field: 'dueDate' },
      
      // Natural language patterns
      { pattern: /with\s+title\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'title' },
      { pattern: /with\s+status\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'status' },
      { pattern: /with\s+type\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'type' },
      { pattern: /with\s+company\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'company' },
      { pattern: /with\s+email\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'email' },
      { pattern: /with\s+phone\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'phone' },
      { pattern: /with\s+source\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'source' },
      { pattern: /with\s+name\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'name' },
      { pattern: /with\s+industry\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'industry' },
      { pattern: /with\s+size\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'size' },
      { pattern: /with\s+stage\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'stage' },
      { pattern: /with\s+value\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'value' },
      { pattern: /with\s+subject\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'subject' },
      { pattern: /with\s+dueDate\s+(?:of|is|equals|=)\s+(\w+)/i, field: 'dueDate' },
      
      // "at company" patterns
      { pattern: /at\s+(\w+(?:\s+\w+)*)/i, field: 'company' },
      { pattern: /from\s+(\w+(?:\s+\w+)*)/i, field: 'company' },
      { pattern: /in\s+(\w+(?:\s+\w+)*)/i, field: 'company' },
      
      // Direct field mentions
      { pattern: /title\s+(\w+)/i, field: 'title' },
      { pattern: /status\s+(\w+)/i, field: 'status' },
      { pattern: /type\s+(\w+)/i, field: 'type' },
      { pattern: /company\s+(\w+)/i, field: 'company' },
      { pattern: /email\s+(\w+)/i, field: 'email' },
      { pattern: /phone\s+(\w+)/i, field: 'phone' },
      { pattern: /source\s+(\w+)/i, field: 'source' },
      { pattern: /name\s+(\w+)/i, field: 'name' },
      { pattern: /industry\s+(\w+)/i, field: 'industry' },
      { pattern: /size\s+(\w+)/i, field: 'size' },
      { pattern: /stage\s+(\w+)/i, field: 'stage' },
      { pattern: /value\s+(\w+)/i, field: 'value' },
      { pattern: /subject\s+(\w+)/i, field: 'subject' },
      { pattern: /dueDate\s+(\w+)/i, field: 'dueDate' }
    ];

    filterPatterns.forEach(({ pattern, field }) => {
      const match = messageLower.match(pattern);
      if (match) {
        const value = match[1].toLowerCase();
        fieldFilters[field] = value;
      }
    });

    // Special handling for "at company" patterns
    const atCompanyMatch = messageLower.match(/at\s+(\w+(?:\s+\w+)*)/i);
    if (atCompanyMatch && !fieldFilters.company) {
      fieldFilters.company = atCompanyMatch[1].toLowerCase();
    }

    // Apply field filters
    if (Object.keys(fieldFilters).length > 0) {
      filteredRecords = filteredRecords.filter((record: Record<string, unknown>) => {
        return Object.entries(fieldFilters).every(([field, expectedValue]) => {
          let actualValue = '';
          
          if (dataType === 'contacts') {
            switch (field) {
              case 'title':
                actualValue = (record.title as string || '').toLowerCase();
                break;
              case 'status':
                actualValue = (record.leadStatus as string || '').toLowerCase();
                break;
              case 'type':
                actualValue = (record.contactType as string || '').toLowerCase();
                break;
              case 'company':
                actualValue = (record.company as string || '').toLowerCase();
                break;
              case 'email':
                actualValue = (record.email as string || '').toLowerCase();
                break;
              case 'phone':
                actualValue = (record.phone as string || '').toLowerCase();
                break;
              case 'source':
                actualValue = (record.source as string || '').toLowerCase();
                break;
            }
          } else if (dataType === 'accounts') {
            switch (field) {
              case 'name':
                actualValue = (record.name as string || '').toLowerCase();
                break;
              case 'industry':
                actualValue = (record.industry as string || '').toLowerCase();
                break;
              case 'size':
                actualValue = (record.size as string || '').toLowerCase();
                break;
            }
          } else if (dataType === 'deals') {
            switch (field) {
              case 'name':
                actualValue = (record.name as string || '').toLowerCase();
                break;
              case 'stage':
                actualValue = (record.stage as string || '').toLowerCase();
                break;
              case 'value':
                actualValue = (record.value as string || '').toLowerCase();
                break;
            }
          } else if (dataType === 'activities') {
            switch (field) {
              case 'type':
                actualValue = (record.type as string || '').toLowerCase();
                break;
              case 'status':
                actualValue = (record.status as string || '').toLowerCase();
                break;
              case 'subject':
                actualValue = (record.subject as string || '').toLowerCase();
                break;
            }
          }
          
          return actualValue.includes(expectedValue);
        });
      });
    }

    if (filteredRecords.length === 0) {
      return {
        message: `No ${dataType} found for the specified criteria.`
      };
    }

    // Format records for table display
    const formattedRecords = filteredRecords.map((record: Record<string, unknown>) => {
      if (dataType === 'contacts') {
        return {
          id: record._id,
          name: `${(record.firstName as string) || ''} ${(record.lastName as string) || ''}`.trim(),
          email: record.email as string,
          phone: record.phone as string,
          company: record.company as string,
          title: record.title as string,
          status: record.leadStatus as string,
          type: record.contactType as string,
          source: record.source as string,
          created: new Date((record._creationTime as number)).toLocaleDateString()
        };
      } else if (dataType === 'accounts') {
        return {
          id: record._id,
          name: record.name as string,
          industry: record.industry as string,
          size: record.size as string,
          website: record.website as string,
          created: new Date((record._creationTime as number)).toLocaleDateString()
        };
      } else if (dataType === 'deals') {
        return {
          id: record._id,
          name: record.name as string,
          value: record.value as string,
          stage: record.stage as string,
          probability: record.probability as string,
          created: new Date((record._creationTime as number)).toLocaleDateString()
        };
      } else if (dataType === 'activities') {
        return {
          id: record._id,
          type: record.type as string,
          subject: record.subject as string,
          status: record.status as string,
          dueDate: record.dueDate ? new Date((record.dueDate as number)).toLocaleDateString() : '',
          created: new Date((record._creationTime as number)).toLocaleDateString()
        };
      }
      return record;
    });

    return {
      message: `Found ${filteredRecords.length} ${dataType}:`,
      data: {
        records: formattedRecords,
        type: dataType,
        count: filteredRecords.length,
        displayFormat: 'table'
      }
    };

  } catch (error) {
    console.error('Error querying database:', error);
    return {
      message: "I encountered an error while querying the database. Please try again.",
      error: true
    };
  }
}

// Handle chart generation
async function handleChart(userMessage: string, sessionFiles: Array<{ name: string; content: string }>, userId?: string) {
  try {
    // Parse CSV data from session files if available
    let chartData: Record<string, unknown>[] = [];
    let dataSource = '';

    if (sessionFiles.length > 0) {
      const csvFile = sessionFiles.find(file => file.name.toLowerCase().endsWith('.csv'));
      if (csvFile) {
        const lines = csvFile.content.split('\n');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h: string) => h.trim());
          chartData = lines.slice(1).map((line: string) => {
            const values = line.split(',').map((v: string) => v.trim());
            const row: Record<string, unknown> = {};
            headers.forEach((header: string, index: number) => {
              row[header] = values[index] || '';
            });
            return row;
          }).filter((row: Record<string, unknown>) => 
            Object.values(row).some(val => val !== '')
          );
          dataSource = `Data from uploaded file: ${csvFile.name}`;
        }
      }
    }

    // If no file data, try to get database data for chart
    if (chartData.length === 0 && userId) {
      try {
        // Get user's teams first
        const userTeams = await convex.query(api.crm.getTeamsByUser, { userId });
        
        if (userTeams && userTeams.length > 0) {
          const teamId = userTeams[0]._id;
          const records = await convex.query(api.crm.getContactsByTeam, { teamId });
          chartData = records.slice(0, 20).map((record: Record<string, unknown>) => ({
            id: record._id,
            name: (record.name as Record<string, unknown>)?.firstName + ' ' + (record.name as Record<string, unknown>)?.lastName,
            email: record.email,
            phone: record.phone,
            created: new Date((record._creationTime as number)).toLocaleDateString()
          }));
          dataSource = 'Data from database contacts';
        }
      } catch (error) {
        console.error('Error getting database data for chart:', error);
      }
    }

    if (chartData.length === 0) {
      return {
        message: "I need data to generate a chart. Please upload a CSV, Excel, or text file with your data, or ask me to show database records, then ask me to create a chart."
      };
    }

    // Generate chart specification using OpenAI
    const chartCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a chart generation expert. Create a chart specification based on the user's request and available data.

Available data: ${JSON.stringify(chartData.slice(0, 5))} (showing first 5 rows)

Generate a chart specification with this structure:
{
  "chartType": "bar|line|pie|scatter",
  "data": [array of data objects],
  "chartConfig": {
    "width": 600,
    "height": 400,
    "margin": { "top": 20, "right": 30, "bottom": 30, "left": 40 },
    "xAxis": { "dataKey": "column_name" },
    "yAxis": { "dataKey": "column_name" }
  }
}

Choose appropriate chart type and data keys based on the data structure.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const chartSpecText = chartCompletion.choices[0]?.message?.content || '';
    let chartSpec;
    
    try {
      chartSpec = JSON.parse(chartSpecText);
    } catch (error) {
      console.error('Failed to parse chart spec:', error);
      chartSpec = {
        chartType: "bar",
        data: chartData.slice(0, 10),
        chartConfig: {
          width: 600,
          height: 400,
          margin: { top: 20, right: 30, bottom: 30, left: 40 },
          xAxis: { dataKey: Object.keys(chartData[0] || {})[0] || "category" },
          yAxis: { dataKey: Object.keys(chartData[0] || {})[1] || "value" }
        }
      };
    }

    // Generate narrative about the chart
    const narrativeCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a data analyst. Provide insights about the chart data. Focus on trends, patterns, and actionable insights. Do NOT repeat the chart description - provide different analysis.`
        },
        {
          role: "user",
          content: `Analyze this data and provide insights: ${JSON.stringify(chartData.slice(0, 10))}`
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const narrative = narrativeCompletion.choices[0]?.message?.content || '';

    return {
      message: `I've generated a chart based on your request. ${dataSource}`,
      chartSpec,
      narrative
    };

  } catch (error) {
    console.error('Error generating chart:', error);
    return {
      message: "I encountered an error while generating the chart. Please try again.",
      error: true
    };
  }
}