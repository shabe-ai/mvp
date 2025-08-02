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
      /view.*?accounts/i,
      /show.*?accounts/i,
      /list.*?accounts/i,
      /all.*?accounts/i,
      /view.*?deals/i,
      /show.*?deals/i,
      /list.*?deals/i,
      /all.*?deals/i,
      /view.*?activities/i,
      /show.*?activities/i,
      /list.*?activities/i,
      /all.*?activities/i,
      /view.*?data/i,
      /show.*?data/i,
      // Add specific name patterns for database queries
      /view\s+[a-zA-Z\s]+/i,
      /show\s+[a-zA-Z\s]+/i,
      /find\s+[a-zA-Z\s]+/i,
      /get\s+[a-zA-Z\s]+/i
    ],
    confidence: 0.9
  },
  generateChart: {
    patterns: [
      /create.*?chart/i,
      /generate.*?chart/i,
      /make.*?chart/i,
      /build.*?chart/i,
      /chart.*?of/i,
      /graph.*?of/i,
      /plot.*?of/i,
      /visualize.*?data/i,
      /chart.*?data/i,
      /graph.*?data/i
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
- query_database: User wants to view, search, or filter database records (contacts, accounts, deals, activities)
- generate_chart: User wants to create a chart or visualization of data
- analyze_file: User wants to analyze uploaded files
- general_conversation: General chat or questions

IMPORTANT CLASSIFICATION RULES:
- If the user mentions viewing/searching/finding specific people, companies, or records → query_database
- If the user mentions creating charts, graphs, or visualizations → generate_chart
- If the user mentions "view", "show", "find", "get" + a name → query_database
- If the user mentions "chart", "graph", "visualize" + data → generate_chart

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
  const result = await handleDatabaseOperation(message, userId);
  return NextResponse.json(result);
}

async function handleChartGeneration(message: string, entities: any, sessionFiles: any[], userId: string) {
  // Use existing chart generation logic
  const result = await handleChart(message, sessionFiles, userId);
  return NextResponse.json(result);
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
  const message = userMessage.toLowerCase();
  const isContactQuery = message.includes('contact');
  const isAccountQuery = message.includes('account');
  const isDealQuery = message.includes('deal');
  const isActivityQuery = message.includes('activity');
  
  try {
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    
    let dataType = '';
    let records: any[] = [];
    
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
    
    // If filtering returns too many results or ambiguous results, ask for clarification
    if (filteredRecords.length > 3) {
      const clarificationMessage = getClarificationMessage(dataType, filteredRecords, userMessage);
      return {
        message: clarificationMessage,
        needsClarification: true,
        data: {
          records: filteredRecords.slice(0, 5).map((record: any) => formatRecord(record, dataType)),
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
    const formattedRecords = filteredRecords.map((record: any) => formatRecord(record, dataType));
    
    const filterInfo = getFilterInfo(userMessage, dataType);
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
function applyFilters(records: any[], userMessage: string, dataType: string): any[] {
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
  
  const filteredRecords = records.filter((record: any) => {
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
      
      // If we have multiple terms, prioritize exact name matching
      if (filterTerms.length > 1) {
        const combinedTerms = filterTerms.join(' ');
        // Exact full name match
        if (fullName === combinedTerms) {
          return true;
        }
        // Full name contains the combined terms
        if (fullName.includes(combinedTerms)) {
          return true;
        }
        // Check if ALL terms are found in the name (not just any)
        const allTermsInName = filterTerms.every(term => 
          fullName.includes(term) || firstName.includes(term) || lastName.includes(term)
        );
        if (allTermsInName) {
          return true;
        }
        // If no name match found, don't check other fields for multiple terms
        return false;
      }
      
      // Single term matching
      return filterTerms.some(term => {
        // Check for exact name match first
        if (fullName === term || fullName.includes(term)) {
          return true;
        }
        
        // Check individual name parts (exact matches only)
        if (firstName === term || lastName === term) {
          return true;
        }
        
        // Only check other fields for single terms
        return email.includes(term) || 
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

// Helper function to extract filter terms from user message
function extractFilterTerms(message: string): string[] {
  // Remove common query words but preserve names
  const queryWords = ['view', 'show', 'list', 'all', 'contacts', 'accounts', 'deals', 'activities', 'contact', 'account', 'deal', 'activity', 'at', 'in', 'with'];
  let filteredMessage = message;
  
  queryWords.forEach(word => {
    filteredMessage = filteredMessage.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });
  
  // Split by common separators and clean up
  const terms = filteredMessage
    .split(/[\s,]+/)
    .map(term => term.trim())
    .filter(term => term.length > 0 && term.length < 50); // Reasonable length limits
  
  // If no terms found, try to extract names from the original message
  if (terms.length === 0) {
    // Look for patterns like "view john smith" or "show john"
    const namePatterns = [
      /view\s+([a-zA-Z\s]+)/i,
      /show\s+([a-zA-Z\s]+)/i,
      /find\s+([a-zA-Z\s]+)/i,
      /get\s+([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 0) {
          return [name];
        }
      }
    }
  }
  
  // If we have multiple terms that look like a full name, keep them together
  if (terms.length >= 2) {
    // Check if this looks like a full name (first + last)
    const combinedName = terms.join(' ');
    if (combinedName.length <= 50) {
      return [combinedName, ...terms]; // Return both combined and individual terms
    }
  }
  
  return terms;
}

// Helper function to get filter info for display
function getFilterInfo(userMessage: string, dataType: string): string | null {
  const terms = extractFilterTerms(userMessage.toLowerCase());
  if (terms.length === 0) return null;
  
  return terms.join(', ');
}

// Helper function to format records consistently
function formatRecord(record: any, dataType: string) {
  if (dataType === 'contacts') {
    return {
      id: record._id,
      name: `${record.firstName || ''} ${record.lastName || ''}`.trim(),
      email: record.email || '',
      phone: record.phone || '',
      company: record.company || '',
      title: record.title || '',
      status: record.leadStatus || '',
      type: record.contactType || '',
      source: record.source || '',
      created: new Date(record._creationTime).toLocaleDateString()
    };
  } else if (dataType === 'accounts') {
    return {
      id: record._id,
      name: record.name || '',
      industry: record.industry || '',
      size: record.size || '',
      website: record.website || '',
      created: new Date(record._creationTime).toLocaleDateString()
    };
  } else if (dataType === 'deals') {
    return {
      id: record._id,
      name: record.name || '',
      value: record.value || '',
      stage: record.stage || '',
      probability: record.probability || '',
      created: new Date(record._creationTime).toLocaleDateString()
    };
  } else if (dataType === 'activities') {
    return {
      id: record._id,
      type: record.type || '',
      subject: record.subject || '',
      status: record.status || '',
      dueDate: record.dueDate ? new Date(record.dueDate).toLocaleDateString() : '',
      created: new Date(record._creationTime).toLocaleDateString()
    };
  }
  return record;
}

// Helper function to generate clarification messages
function getClarificationMessage(dataType: string, records: any[], userMessage: string): string {
  if (dataType === 'contacts') {
    const companies = [...new Set(records.map(r => r.company).filter(Boolean))];
    const titles = [...new Set(records.map(r => r.title).filter(Boolean))];
    
    let message = `I found ${records.length} contacts that might match your search. To help me find the exact contact you're looking for, could you please provide more details?\n\n`;
    
    if (companies.length > 0) {
      message += `**Companies found:** ${companies.slice(0, 3).join(', ')}${companies.length > 3 ? '...' : ''}\n`;
    }
    
    if (titles.length > 0) {
      message += `**Titles found:** ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '...' : ''}\n`;
    }
    
    message += `\nPlease try:\n`;
    message += `• "view john smith at acme corporation"\n`;
    message += `• "show sarah johnson with ceo title"\n`;
    message += `• "find mike chen with email"\n`;
    message += `• Or provide the company name, title, or email address`;
    
    return message;
  } else if (dataType === 'accounts') {
    const industries = [...new Set(records.map(r => r.industry).filter(Boolean))];
    
    let message = `I found ${records.length} accounts that might match your search. To help me find the exact account, could you please provide more details?\n\n`;
    
    if (industries.length > 0) {
      message += `**Industries found:** ${industries.slice(0, 3).join(', ')}${industries.length > 3 ? '...' : ''}\n`;
    }
    
    message += `\nPlease try:\n`;
    message += `• "view acme corporation in technology"\n`;
    message += `• "show global solutions in healthcare"\n`;
    message += `• Or provide the industry or website`;
    
    return message;
  }
  
  return `I found ${records.length} ${dataType} that might match your search. Could you please provide more specific details to help me find the exact ${dataType} you're looking for?`;
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
      case 'query_database':
      case 'viewData':
        return await handleDatabaseQuery(lastUserMessage, intent.entities || {}, userId);
        
      case 'generateChart':
      case 'generate_chart':
        return await handleChartGeneration(lastUserMessage, intent.entities || {}, sessionFiles, userId);
        
      case 'analyzeFile':
      case 'analyze_file':
        // Handle file analysis
        return await handleGeneralConversation(lastUserMessage, messages, context);
        
      case 'generalConversation':
      case 'general_conversation':
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