import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { ValidationError } from '@/lib/errorHandler';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simplified system prompt for V1 - focused on file analysis and chart generation
const SYSTEM_PROMPT = `You are Shabe AI, a helpful AI assistant that specializes in analyzing uploaded files and generating insights.

Your capabilities:
1. Analyze uploaded files (PDFs, Excel files, CSV files, text files)
2. Generate charts and visualizations from data
3. Provide insights and summaries from file content
4. Answer questions about uploaded data

When users upload files, you have direct access to the file content and can provide detailed analysis.

For chart generation:
- Use the handleChart function when users ask for charts or visualizations
- Parse data from uploaded files to create meaningful charts
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

    // Create enhanced system prompt with session files context
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

    if (isChartRequest && sessionFiles.length > 0) {
      // Handle chart generation
      const chartResult = await handleChart(lastUserMessage, sessionFiles);
      return NextResponse.json(chartResult);
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

// Handle chart generation
async function handleChart(userMessage: string, sessionFiles: Array<{ name: string; content: string }>) {
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