import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  role: string;
  content: string;
}

// Fast pattern matching for common intents (0-5ms latency)
const fastIntentPatterns = {
  sendEmail: {
    patterns: [
      /send.*?(?:an?\s+)?email/i,
      /email.*?to/i,
      /send.*?to/i,
      /write.*?email/i,
      /draft.*?email/i
    ],
    confidence: 0.9
  },
  createContact: {
    patterns: [
      /create.*?contact/i,
      /add.*?contact/i,
      /new.*?contact/i,
      /contact.*?creation/i
    ],
    confidence: 0.9
  },
  viewData: {
    patterns: [
      /view.*?contacts/i,
      /show.*?contacts/i,
      /list.*?contacts/i,
      /all.*?contacts/i,
      /view.*?data/i,
      /show.*?data/i
    ],
    confidence: 0.9
  },
  generateChart: {
    patterns: [
      /chart/i,
      /graph/i,
      /plot/i,
      /visualize/i,
      /create.*?chart/i,
      /generate.*?chart/i
    ],
    confidence: 0.8
  },
  analyzeFile: {
    patterns: [
      /analyze.*?file/i,
      /file.*?analysis/i,
      /upload.*?file/i,
      /process.*?file/i
    ],
    confidence: 0.8
  }
};

// Fast pattern matching function
function fastPatternMatch(message: string) {
  for (const [intent, config] of Object.entries(fastIntentPatterns)) {
    if (config.patterns.some(p => p.test(message))) {
      return { action: intent, confidence: config.confidence };
    }
  }
  return { action: null, confidence: 0 };
}

// LLM intent classification for complex/ambiguous cases
async function classifyIntentWithLLM(message: string, context: any) {
  const prompt = `
You are an AI assistant that classifies user intents and extracts relevant entities.

Available actions:
- send_email: User wants to send an email to someone
- create_contact: User wants to create a new contact
- query_database: User wants to view, search, or filter database records
- generate_chart: User wants to create a chart or visualization
- analyze_file: User wants to analyze uploaded files
- general_conversation: General chat or questions

Extract entities like:
- recipient: Who the email is for (name)
- contact_name: Name for new contact
- contact_email: Email for new contact
- query_type: Type of database query (contacts, accounts, deals, activities)
- chart_type: Type of chart to generate
- file_action: What to do with uploaded files

Context:
- User: ${context.userProfile?.name || 'Unknown'}
- Company: ${context.companyData?.name || 'Unknown'}

Message: "${message}"

Return ONLY a JSON object: { "action": "...", "entities": { ... }, "confidence": 0.0-1.0 }
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return result;
  } catch (error) {
    console.error('LLM intent classification failed:', error);
    return { action: "general_conversation", entities: {}, confidence: 0.5 };
  }
}

// Entity extraction for email requests
async function extractEmailEntities(message: string, context: any) {
  const prompt = `
Extract email-related entities from the user's message.

Extract:
- recipient: The person to send email to (name)
- subject: Email subject (if mentioned)
- content_type: Type of email (thank you, follow up, introduction, etc.)

Message: "${message}"

Return ONLY a JSON object: { "recipient": "...", "subject": "...", "content_type": "..." }
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.1,
      max_tokens: 150
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    console.error('Entity extraction failed:', error);
    return {};
  }
}

// Main intent classification function
async function classifyIntent(message: string, context: any) {
  // Step 1: Fast pattern matching (0-5ms)
  const fastResult = fastPatternMatch(message);
  
  if (fastResult.confidence > 0.8) {
    console.log('Fast pattern match:', fastResult);
    return fastResult;
  }
  
  // Step 2: LLM classification for ambiguous cases (1-2s)
  console.log('Using LLM classification for:', message);
  const llmResult = await classifyIntentWithLLM(message, context);
  
  return llmResult;
}

// Action handlers
async function handleEmailRequest(message: string, entities: any, userId: string, context: any) {
  // Extract recipient from message or entities
  const emailEntities = await extractEmailEntities(message, context);
  const recipient = entities.recipient || emailEntities.recipient;
  
  if (!recipient) {
    return NextResponse.json({
      message: "I couldn't identify who you want to send an email to. Please specify the recipient's name.",
      error: true
    });
  }
  
  // Check if contact exists
  try {
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
    
    const matchingContact = contacts.find(contact => {
      const contactName = contact.firstName && contact.lastName 
        ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
        : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
      const searchName = recipient.toLowerCase();
      
      return contactName.includes(searchName) || 
             searchName.includes(contactName) ||
             contactName.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => contactName.includes(part));
    });
    
    if (matchingContact) {
      // Contact exists, draft email
      return await draftEmail(matchingContact, context);
    } else {
      // Contact doesn't exist, prompt for creation
      return NextResponse.json({
        message: `I couldn't find a contact named "${recipient}" in your database. Would you like me to help you create a new contact for this person? Please provide their email address so I can add them to your contacts and then send the email.`,
        needsContactCreation: true,
        suggestedContactName: recipient,
        action: "create_contact"
      });
    }
  } catch (error) {
    console.error('Error checking contacts:', error);
    return NextResponse.json({
      message: "I encountered an error while checking your contacts. Please try again.",
      error: true
    });
  }
}

async function draftEmail(contact: any, context: any) {
  const emailPrompt = `
You are drafting a professional email.

Sender: ${context.userProfile?.name || 'User'}
Company: ${context.companyData?.name || 'Company'}
Recipient: ${contact.firstName} ${contact.lastName} (${contact.email})

Draft a professional email. Return ONLY a JSON object:
{
  "message": "I've drafted an email for you. You can review and edit it below.",
  "emailDraft": {
    "to": "${contact.email}",
    "subject": "Email Subject",
    "content": "Email body content..."
  }
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: emailPrompt }],
      temperature: 0.7,
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return NextResponse.json(result);
  } catch (error) {
    console.error('Email drafting failed:', error);
    return NextResponse.json({
      message: "I've drafted an email for you. You can review and edit it below.",
      emailDraft: {
        to: contact.email,
        subject: "Follow Up",
        content: `Dear ${contact.firstName},\n\nI hope this message finds you well.\n\nBest regards,\n${context.userProfile?.name || 'User'}`
      }
    });
  }
}

async function handleContactCreation(message: string, entities: any, userId: string) {
  // Extract contact details from message
  const nameMatch = message.match(/name\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                   message.match(/name\s+([^\s,]+(?:\s+[^\s,]+)*)/i) ||
                   message.match(/name\s+([^,\n]+?)(?:\s+email\s|$)/i);
  const emailMatch = message.match(/email\s*[=:]\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i) || 
                    message.match(/email\s+([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  const titleMatch = message.match(/title\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                    message.match(/title\s+([^\s,]+(?:\s+[^\s,]+)*)/i);
  
  if (nameMatch && emailMatch) {
    const fullName = nameMatch[1].trim();
    const email = emailMatch[1].trim();
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';
    
    try {
      const teams = await convex.query(api.crm.getTeamsByUser, { userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      const contactId = await convex.mutation(api.crm.createContact, {
        teamId,
        createdBy: userId,
        firstName,
        lastName,
        email,
        title: title || undefined,
        leadStatus: "new",
        contactType: "contact",
        source: "email_creation"
      });
      
      return NextResponse.json({
        message: `Great! I've successfully created a new contact for ${fullName} (${email}) in your database. Now let me draft an email for you.`,
        action: "draft_email",
        contactName: fullName,
        contactEmail: email
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      return NextResponse.json({
        message: "I encountered an error while creating the contact. Please try again.",
        error: true
      });
    }
  } else {
    return NextResponse.json({
      message: "I couldn't parse the contact details. Please provide the information in this format: 'name [full name] email [email address] title [optional title]'",
      error: true
    });
  }
}

async function handleDatabaseQuery(message: string, entities: any, userId: string) {
  // Use existing database operation logic
  return await handleDatabaseOperation(message, userId);
}

async function handleChartGeneration(message: string, entities: any, sessionFiles: any[], userId: string) {
  // Use existing chart generation logic
  return await handleChart(message, sessionFiles, userId);
}

async function handleGeneralConversation(message: string, messages: any[], context: any) {
  // General AI conversation
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are Shabe ai, an intelligent AI assistant that helps users with their business operations. You can analyze files, generate charts, help with database operations, and draft emails. Be helpful and professional.`
      },
      ...messages.map((msg: Message) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return NextResponse.json({
    message: completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."
  });
}

// Validation functions
function validateRequiredFields(data: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

function validateStringField(value: unknown, fieldName: string, maxLength?: number) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (maxLength && value.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less`);
  }
}

// Database operation handler (existing logic)
async function handleDatabaseOperation(userMessage: string, userId: string) {
  // Implementation from existing code
  const isContactQuery = userMessage.toLowerCase().includes('contact');
  const isAccountQuery = userMessage.toLowerCase().includes('account');
  const isDealQuery = userMessage.toLowerCase().includes('deal');
  const isActivityQuery = userMessage.toLowerCase().includes('activity');
  
  try {
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    
    let dataType = '';
    let records: any[] = [];
    
    if (isContactQuery) {
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
    
    if (records.length === 0) {
      return {
        message: `No ${dataType} found for the specified criteria.`
      };
    }
    
    return {
      message: `Found ${records.length} ${dataType}.`,
      data: records,
      dataType: dataType
    };
  } catch (error) {
    console.error('Database operation error:', error);
    return {
      message: "I encountered an error while querying the database. Please try again.",
      error: true
    };
  }
}

// Chart generation handler (existing logic)
async function handleChart(userMessage: string, sessionFiles: Array<{ name: string; content: string }>, userId?: string) {
  // Implementation from existing code
  const chartPrompt = `
    Generate a chart based on the user's request.
    
    User request: "${userMessage}"
    Available data: ${sessionFiles.length > 0 ? 'Session files available' : 'No session files'}
    
    Return ONLY a JSON object with chart specification:
    {
      "chartType": "bar|line|pie|area",
      "data": [...],
      "xAxis": "field_name",
      "yAxis": "field_name",
      "title": "Chart Title"
    }
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: chartPrompt }],
      temperature: 0.1,
      max_tokens: 1000
    });
    
    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      message: "I've generated a chart for you.",
      chartSpec: result
    };
  } catch (error) {
    console.error('Chart generation error:', error);
    return {
      message: "I encountered an error while generating the chart. Please try again.",
      error: true
    };
  }
}

// Main POST handler with LLM-agent architecture
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userId, sessionFiles = [], companyData = {}, userData = {} } = body;

    // Validate required fields
    validateRequiredFields(body, ['userId', 'messages']);
    
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }

    // Validate each message
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (!message.role || !message.content) {
        throw new Error(`Message at index ${i} is missing required fields`);
      }
      validateStringField(message.role, `message[${i}].role`);
      validateStringField(message.content, `message[${i}].content`, 10000);
    }

    const lastUserMessage = messages[messages.length - 1].content;
    
    // Create context for LLM classification
    const context = {
      userProfile: {
        name: userData.name || "User",
        email: userData.email || "user@example.com",
        company: userData.company || "Unknown Company"
      },
      companyData: {
        name: companyData.name || "Shabe ai",
        website: companyData.website || "www.shabe.ai",
        description: companyData.description || "Shabe AI is a chat-first revenue platform"
      },
      conversationHistory: messages,
      sessionFiles
    };

    console.log('Chat API received user context:', context);

    // Step 1: Intent Classification (Fast pattern + LLM fallback)
    const intent = await classifyIntent(lastUserMessage, context);
    console.log('Intent classification result:', intent);

    // Step 2: Route to appropriate handler based on intent
    switch (intent.action) {
      case 'sendEmail':
        return await handleEmailRequest(lastUserMessage, intent.entities || {}, userId, context);
        
      case 'createContact':
        return await handleContactCreation(lastUserMessage, intent.entities || {}, userId);
        
      case 'queryDatabase':
        return await handleDatabaseQuery(lastUserMessage, intent.entities || {}, userId);
        
      case 'generateChart':
        return await handleChartGeneration(lastUserMessage, intent.entities || {}, sessionFiles, userId);
        
      case 'analyzeFile':
        // Handle file analysis
        return await handleGeneralConversation(lastUserMessage, messages, context);
        
      case 'generalConversation':
      default:
        return await handleGeneralConversation(lastUserMessage, messages, context);
    }

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}