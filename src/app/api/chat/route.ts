import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { openaiClient } from "@/lib/openaiClient";
import { logError, addBreadcrumb } from "@/lib/errorLogger";

// Add proper interfaces at the top
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

interface IntentResult {
  action: string | null;
  entities?: Record<string, unknown>;
  confidence: number;
}

interface EmailEntities {
  recipient?: string;
  subject?: string;
  content_type?: string;
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

// Convex client is now imported from lib/convex

interface Message {
  role: string;
  content: string;
  action?: string;
  objectType?: string;
  partialDetails?: Record<string, string>;
  details?: Record<string, string>;
  data?: FormattedRecord[];
  chartSpec?: any;
  enhancedChart?: boolean;
  contactName?: string;
  contactId?: string;
  field?: string;
  value?: string;
  contactEmail?: string;
  accountId?: string;
  accountName?: string;
  dealId?: string;
  dealName?: string;
  activityId?: string;
  activitySubject?: string;
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
      /contact.*?creation/i,
      /create.*?account/i,
      /add.*?account/i,
      /new.*?account/i,
      /account.*?creation/i,
      /create.*?deal/i,
      /add.*?deal/i,
      /new.*?deal/i,
      /deal.*?creation/i,
      /create.*?activity/i,
      /add.*?activity/i,
      /new.*?activity/i,
      /activity.*?creation/i
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



// Entity extraction for email requests
async function extractEmailEntities(message: string, context: UserContext) {
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
    const response = await openaiClient.chatCompletionsCreate({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.1,
      max_tokens: 150
    }, {
      userId: context.userProfile?.name || 'unknown',
      operation: 'email_entity_extraction',
      model: 'gpt-4'
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    console.error('Entity extraction failed:', error);
    return {};
  }
}



// Action handlers
// Function to resolve pronouns by looking at conversation context
function resolvePronoun(pronoun: string, context: UserContext): string | null {
  const pronouns = {
    'him': ['male', 'he'],
    'her': ['female', 'she'], 
    'them': ['they', 'them'],
    'his': ['male', 'he'],
    'hers': ['female', 'she'],
    'theirs': ['they', 'them']
  };
  
  // Look through recent conversation history for mentioned contacts
  const recentMessages = context.conversationHistory.slice(-5); // Last 5 messages
  
  for (const message of recentMessages) {
    if (message.role === 'assistant' && message.data) {
      // Check if the assistant mentioned a contact in the data
      const records = message.data as FormattedRecord[];
      if (records && records.length > 0) {
        const contact = records[0];
        const contactName = contact.name.toLowerCase();
        
        // Simple gender detection based on common names (this could be improved)
        const maleNames = ['john', 'mike', 'david', 'james', 'robert', 'william', 'richard', 'thomas', 'chris', 'daniel'];
        const femaleNames = ['sarah', 'emily', 'jane', 'lisa', 'mary', 'jennifer', 'jessica', 'ashley', 'amanda', 'michelle'];
        
        const firstName = contactName.split(' ')[0];
        const isMale = maleNames.includes(firstName);
        const isFemale = femaleNames.includes(firstName);
        
        // Check if pronoun matches the contact's likely gender
        const pronounKey = pronoun.toLowerCase() as keyof typeof pronouns;
        if (pronouns[pronounKey]) {
          const pronounTypes = pronouns[pronounKey];
          if ((isMale && pronounTypes.includes('male')) || 
              (isFemale && pronounTypes.includes('female')) ||
              (!isMale && !isFemale)) { // Default case for unknown gender
            return contact.name;
          }
        }
      }
    }
  }
  
  return null;
}



async function draftEmail(contact: DatabaseRecord, context: UserContext, emailContext?: string) {
  // Get the latest user message for context
  const latestUserMessage = context.conversationHistory[context.conversationHistory.length - 1]?.content || '';
  const contextToUse = emailContext || latestUserMessage;
  
  const emailPrompt = `
You are drafting a professional email based on the user's request.

Sender: ${context.userProfile?.name || 'User'}
Company: ${context.companyData?.name || 'Company'}
Recipient: ${contact.firstName} ${contact.lastName} (${contact.email})

User's request/context: "${contextToUse}"

Based on the user's request, draft a professional email. Return ONLY a JSON object:
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
    const response = await openaiClient.chatCompletionsCreate({
      model: "gpt-4",
      messages: [{ role: "system", content: emailPrompt }],
      temperature: 0.7,
      max_tokens: 500
    }, {
      userId: context.userProfile?.name || 'unknown',
      operation: 'email_drafting',
      model: 'gpt-4'
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



function determineObjectType(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('contact') || lowerMessage.includes('person')) {
    return 'contact';
  } else if (lowerMessage.includes('account') || lowerMessage.includes('company') || lowerMessage.includes('organization')) {
    return 'account';
  } else if (lowerMessage.includes('deal') || lowerMessage.includes('opportunity') || lowerMessage.includes('sale')) {
    return 'deal';
  } else if (lowerMessage.includes('activity') || lowerMessage.includes('event') || lowerMessage.includes('meeting') || lowerMessage.includes('call')) {
    return 'activity';
  } else {
    // Default to contact if no specific type mentioned
    return 'contact';
  }
}

function extractObjectDetails(message: string): Record<string, string> {
  const details: Record<string, string> = {};
  
  // Extract name patterns
  const nameMatch = message.match(/name\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                   message.match(/name\s+([^\s,]+(?:\s+[^\s,]+)*)/i) ||
                   message.match(/name\s+([^,\n]+?)(?:\s+email\s|$)/i);
  if (nameMatch) {
    details.name = nameMatch[1].trim();
  }
  
  // Extract email patterns
  const emailMatch = message.match(/email\s*[=:]\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i) || 
                    message.match(/email\s+([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  if (emailMatch) {
    details.email = emailMatch[1].trim();
  }
  
  // Extract phone patterns
  const phoneMatch = message.match(/phone\s*[=:]\s*([^\s,]+)/i) || 
                    message.match(/phone\s+([^\s,]+)/i);
  if (phoneMatch) {
    details.phone = phoneMatch[1].trim();
  }
  
  // Extract title patterns
  const titleMatch = message.match(/title\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                    message.match(/title\s+([^\s,]+(?:\s+[^\s,]+)*)/i);
  if (titleMatch) {
    details.title = titleMatch[1].trim();
  }
  
  // Extract company patterns
  const companyMatch = message.match(/company\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                      message.match(/company\s+([^\s,]+(?:\s+[^\s,]+)*)/i);
  if (companyMatch) {
    details.company = companyMatch[1].trim();
  }
  
  // Extract website patterns
  const websiteMatch = message.match(/website\s*[=:]\s*([^\s,]+)/i) || 
                      message.match(/website\s+([^\s,]+)/i);
  if (websiteMatch) {
    details.website = websiteMatch[1].trim();
  }
  
  // Extract industry patterns
  const industryMatch = message.match(/industry\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                       message.match(/industry\s+([^\s,]+(?:\s+[^\s,]+)*)/i);
  if (industryMatch) {
    details.industry = industryMatch[1].trim();
  }
  
  // Extract amount patterns
  const amountMatch = message.match(/amount\s*[=:]\s*([^\s,]+)/i) || 
                     message.match(/amount\s+([^\s,]+)/i);
  if (amountMatch) {
    details.amount = amountMatch[1].trim();
  }
  
  // Extract stage patterns
  const stageMatch = message.match(/stage\s*[=:]\s*([^\s,]+)/i) || 
                    message.match(/stage\s+([^\s,]+)/i);
  if (stageMatch) {
    details.stage = stageMatch[1].trim();
  }
  
  // Extract subject patterns
  const subjectMatch = message.match(/subject\s*[=:]\s*([^\s,]+(?:\s+[^\s,]+)*)/i) || 
                      message.match(/subject\s+([^\s,]+(?:\s+[^\s,]+)*)/i);
  if (subjectMatch) {
    details.subject = subjectMatch[1].trim();
  }
  
  return details;
}

function extractObjectDetailsFromNaturalLanguage(message: string): Record<string, string> {
  const details: Record<string, string> = {};
  
  // Look for email pattern
  const emailMatch = message.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  if (emailMatch) {
    details.email = emailMatch[1].trim();
  }
  
  // Extract name - look for patterns like "named X", "name X", or just names after command words
  let nameMatch = message.match(/named\s+([^\s@,]+(?:\s+[^\s@,]+)*)/i) ||
                 message.match(/name\s+([^\s@,]+(?:\s+[^\s@,]+)*)/i);
  
  if (nameMatch) {
    details.name = nameMatch[1].trim();
  } else if (emailMatch) {
    // If no "named" pattern found, try to extract name from before the email
    // but exclude common command words more carefully
    const beforeEmail = message.substring(0, emailMatch.index).trim();
    if (beforeEmail) {
      // Remove common command words but be more careful about preserving the actual name
      const cleanedName = beforeEmail
        .replace(/\b(create|add|new|contact|person)\b/gi, '') // Don't remove "name" or "named" as they might be part of the actual name
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanedName) {
        details.name = cleanedName;
      }
    }
  } else {
    // If no email found, try to extract just a name
    // Look for patterns like "Name X Y" or just names
    const namePattern = message.match(/(?:name|named)\s+([^\s@,]+(?:\s+[^\s@,]+)*)/i);
    if (namePattern) {
      details.name = namePattern[1].trim();
    } else {
      // Fallback: take words that look like names (not command words)
      const words = message.trim().split(/\s+/);
      const nameWords = words.filter(word => 
        !/\b(create|add|new|contact|person|email|company|phone|title)\b/i.test(word) &&
        word.length > 1
      );
      
      if (nameWords.length >= 2) {
        details.name = nameWords.slice(0, 2).join(' '); // Take first two name-like words
      } else if (nameWords.length === 1) {
        details.name = nameWords[0];
      }
    }
  }
  
  // Extract company if mentioned
  const companyMatch = message.match(/company\s+(?:should\s+be\s+)?([^\s,]+(?:\s+[^\s,]+)*)/i);
  if (companyMatch) {
    details.company = companyMatch[1].trim();
  }
  
  return details;
}

function isContactUpdateMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check if the message contains update keywords
  const hasUpdateKeywords = lowerMessage.includes('update') || 
                           lowerMessage.includes('change') || 
                           lowerMessage.includes('modify') ||
                           lowerMessage.includes('edit') ||
                           lowerMessage.includes('company') || 
                           lowerMessage.includes('phone') || 
                           lowerMessage.includes('title') || 
                           lowerMessage.includes('address') ||
                           lowerMessage.includes('email') ||
                           lowerMessage.includes('=');
  
  // Check if the message contains a name (for contact identification)
  const hasName = /\b(john|jane|smith|jones|brown|wilson|taylor|anderson|thomas|jackson)\b/i.test(message);
  
  // Check if the message contains field updates
  const hasFieldUpdate = lowerMessage.includes('to ') || 
                        lowerMessage.includes('email to ') ||
                        lowerMessage.includes('phone to ') ||
                        lowerMessage.includes('title to ') ||
                        lowerMessage.includes('company to ');
  
  return hasUpdateKeywords && (hasName || hasFieldUpdate);
}

async function handleContactUpdateWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting contact update for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract contact name and field updates from the message
    const lowerMessage = message.toLowerCase();
    
    // Extract name (look for patterns like "john smith", "john", "smith")
    // Handle both uppercase and lowercase names
    const nameMatch = message.match(/\b([A-Za-z]+)\s+([A-Za-z]+)\b/) || 
                     message.match(/\b([A-Za-z]+)\b/);
    const contactName = nameMatch ? nameMatch[0] : null;
    
    // Extract field and value (e.g., "email to johnsmith@acme.com")
    const fieldMatch = lowerMessage.match(/(email|phone|title|company)\s+to\s+([^\s]+)/);
    const field = fieldMatch ? fieldMatch[1] : null;
    const value = fieldMatch ? fieldMatch[2] : null;
    
    console.log('📝 Extracted data:', { contactName, field, value });
    
    if (!contactName || !field || !value) {
      console.log('❌ Missing required data for contact update');
    return NextResponse.json({
        message: "I couldn't understand the update request. Please specify the contact name and what field to update. For example: 'update john smith's email to johnsmith@acme.com'",
        error: true
      });
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
    console.log('📋 Contact names:', contacts.map(c => `${c.firstName} ${c.lastName}`));
    
    const matchingContact = contacts.find(contact => {
      const contactFullName = contact.firstName && contact.lastName 
        ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
        : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
      const searchName = contactName.toLowerCase();
      
      const matches = contactFullName.includes(searchName) || 
             searchName.includes(contactFullName) ||
             contactFullName.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => contactFullName.includes(part));
      
      console.log(`🔍 Checking "${contactFullName}" against "${searchName}": ${matches}`);
      return matches;
    });
    
    if (!matchingContact) {
      console.log('❌ No matching contact found');
      return NextResponse.json({
        message: `I couldn't find a contact named "${contactName}" in your database. Please check the spelling or create the contact first.`,
        error: true
      });
    }
    
    console.log('✅ Found matching contact:', matchingContact);
    
    // Ask for confirmation before updating
    const confirmationMessage = `Please confirm the contact update:\n\n**Contact:** ${matchingContact.firstName} ${matchingContact.lastName}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_update",
      contactId: matchingContact._id,
      field: field,
      value: value,
      contactName: `${matchingContact.firstName} ${matchingContact.lastName}`
    });
    
  } catch (error) {
    console.error('Contact update failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the contact update. Please try again.",
      error: true
    });
  }
}

async function handleContactUpdate(message: string, userId: string) {
  try {
    console.log('🔍 Starting contact update for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract contact name and field updates from the message
    const lowerMessage = message.toLowerCase();
    
    // Extract name (look for patterns like "john smith", "john", "smith")
    // Handle both uppercase and lowercase names
    const nameMatch = message.match(/\b([A-Za-z]+)\s+([A-Za-z]+)\b/) || 
                     message.match(/\b([A-Za-z]+)\b/);
    const contactName = nameMatch ? nameMatch[0] : null;
    
    // Extract field and value (e.g., "email to johnsmith@acme.com")
    const fieldMatch = lowerMessage.match(/(email|phone|title|company)\s+to\s+([^\s]+)/);
    const field = fieldMatch ? fieldMatch[1] : null;
    const value = fieldMatch ? fieldMatch[2] : null;
    
    console.log('📝 Extracted data:', { contactName, field, value });
    
    if (!contactName || !field || !value) {
      console.log('❌ Missing required data for contact update');
    return NextResponse.json({
        message: "I couldn't understand the update request. Please specify the contact name and what field to update. For example: 'update john smith's email to johnsmith@acme.com'",
        error: true
      });
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
    console.log('📋 Contact names:', contacts.map(c => `${c.firstName} ${c.lastName}`));
    
    const matchingContact = contacts.find(contact => {
      const contactFullName = contact.firstName && contact.lastName 
        ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
        : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
      const searchName = contactName.toLowerCase();
      
      const matches = contactFullName.includes(searchName) || 
             searchName.includes(contactFullName) ||
             contactFullName.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => contactFullName.includes(part));
      
      console.log(`🔍 Checking "${contactFullName}" against "${searchName}": ${matches}`);
      return matches;
    });
    
    if (!matchingContact) {
      console.log('❌ No matching contact found');
      return NextResponse.json({
        message: `I couldn't find a contact named "${contactName}" in your database. Please check the spelling or create the contact first.`,
        error: true
      });
    }
    
    console.log('✅ Found matching contact:', matchingContact);
    
    // Update the contact in the database
    const updateData: Record<string, string> = {};
    if (field === 'email') updateData.email = value;
    if (field === 'phone') updateData.phone = value;
    if (field === 'title') updateData.title = value;
    if (field === 'company') updateData.company = value;
    
    console.log('📝 Update data:', updateData);
    
    // Call Convex mutation to update the contact
    console.log('🔄 Calling Convex mutation...');
    await convex.mutation(api.crm.updateContact, {
      contactId: matchingContact._id,
      updates: updateData
    });
    
    console.log('✅ Contact update successful');
    return NextResponse.json({
      message: `I've successfully updated ${contactName}'s ${field} to ${value}.`,
    action: "contact_updated"
  });
    
  } catch (error) {
    console.error('Contact update failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the contact update. Please try again.",
      error: true
    });
  }
}

async function handleContactDeleteWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting contact deletion for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract contact identifier from the message
    const lowerMessage = message.toLowerCase();
    
    // Look for email pattern first (most specific)
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    let contactIdentifier = emailMatch ? emailMatch[0] : null;
    let identifierType = 'email';
    
    // If no email found, look for name pattern
    if (!contactIdentifier) {
      const nameMatch = message.match(/\b([A-Za-z]+)\s+([A-Za-z]+)\b/) || 
                       message.match(/\b([A-Za-z]+)\b/);
      contactIdentifier = nameMatch ? nameMatch[0] : null;
      identifierType = 'name';
    }
    
    console.log('📝 Extracted identifier:', { contactIdentifier, identifierType });
    
    if (!contactIdentifier) {
      console.log('❌ No contact identifier found');
      return NextResponse.json({
        message: "I couldn't understand the delete request. Please specify the contact by name or email. For example: 'delete contact john smith' or 'delete contact johnsmith@example.com'",
        error: true
      });
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
    
    let matchingContact = null;
    
    if (identifierType === 'email') {
      // Search by email
      matchingContact = contacts.find(contact => 
        contact.email?.toLowerCase() === contactIdentifier.toLowerCase()
      );
    } else {
      // Search by name
      matchingContact = contacts.find(contact => {
        const contactFullName = contact.firstName && contact.lastName 
          ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
          : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
        const searchName = contactIdentifier.toLowerCase();
        
        return contactFullName.includes(searchName) || 
               searchName.includes(contactFullName) ||
               contactFullName.split(' ').some((part: string) => searchName.includes(part)) ||
               searchName.split(' ').some((part: string) => contactFullName.includes(part));
      });
    }
    
    if (!matchingContact) {
      console.log('❌ No matching contact found');
      return NextResponse.json({
        message: `I couldn't find a contact with ${identifierType} "${contactIdentifier}" in your database. Please check the spelling or try a different identifier.`,
        error: true
      });
    }
    
    console.log('✅ Found matching contact:', matchingContact);
    
    // Ask for confirmation before deleting
    const contactName = `${matchingContact.firstName} ${matchingContact.lastName}`.trim();
    const contactEmail = matchingContact.email || 'No email';
    
    const confirmationMessage = `To confirm, you'd like to delete the contact associated with the ${identifierType} ${contactIdentifier}. Please note that this action is irreversible. Are you sure you want to proceed?`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_delete",
      contactId: matchingContact._id,
      contactName: contactName,
      contactEmail: contactEmail,
      identifierType: identifierType,
      identifier: contactIdentifier
    });
    
  } catch (error) {
    console.error('Contact deletion failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the contact deletion. Please try again.",
      error: true
    });
  }
}

function hasRequiredDetails(details: Record<string, string>, objectType: string): boolean {
  switch (objectType) {
    case 'contact':
      return !!(details.name && details.email);
    case 'account':
      return !!details.name;
    case 'deal':
      return !!details.name;
    case 'activity':
      return !!details.subject;
    default:
      return false;
  }
}

function getConfirmationMessage(objectType: string, details: Record<string, string>): string {
  switch (objectType) {
    case 'contact':
      const contactInfo = [
        `**Name:** ${details.name}`,
        `**Email:** ${details.email}`,
        details.company ? `**Company:** ${details.company}` : null,
        details.title ? `**Title:** ${details.title}` : null,
        details.phone ? `**Phone:** ${details.phone}` : null
      ].filter(Boolean).join('\n');
      
      return `Please confirm the contact details before I create the record:\n\n${contactInfo}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
    case 'account':
      const accountInfo = [
        `**Name:** ${details.name}`,
        details.industry ? `**Industry:** ${details.industry}` : null,
        details.website ? `**Website:** ${details.website}` : null,
        details.phone ? `**Phone:** ${details.phone}` : null
      ].filter(Boolean).join('\n');
      
      return `Please confirm the account details before I create the record:\n\n${accountInfo}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
    case 'deal':
      const dealInfo = [
        `**Name:** ${details.name}`,
        details.stage ? `**Stage:** ${details.stage}` : null,
        details.amount ? `**Amount:** $${details.amount}` : null,
        details.company ? `**Company:** ${details.company}` : null
      ].filter(Boolean).join('\n');
      
      return `Please confirm the deal details before I create the record:\n\n${dealInfo}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
    case 'activity':
      const activityInfo = [
        `**Subject:** ${details.subject}`,
        details.activityType ? `**Type:** ${details.activityType}` : null,
        details.dueDate ? `**Due Date:** ${details.dueDate}` : null
      ].filter(Boolean).join('\n');
      
      return `Please confirm the activity details before I create the record:\n\n${activityInfo}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
      
    default:
      return `Please confirm the ${objectType} details before I create the record. Is this correct? Please respond with "yes" to confirm or "no" to cancel.`;
  }
}

function getCreationPrompt(objectType: string, partialDetails: Record<string, string>): string {
  const providedFields = Object.keys(partialDetails).join(', ');
  const providedText = providedFields ? ` (You provided: ${providedFields})` : '';
  
  switch (objectType) {
    case 'contact':
      if (!partialDetails.name && !partialDetails.email) {
        return "I'd be happy to help you create a new contact! Please provide the contact's name and email address. For example: 'name John Smith email john@example.com'";
      } else if (!partialDetails.name) {
        return "I need the contact's name to create the record. Please provide the full name.";
      } else if (!partialDetails.email) {
        return "I need the contact's email address to create the record. Please provide a valid email address.";
      }
      break;
      
    case 'account':
      if (!partialDetails.name) {
        return "I'd be happy to help you create a new account! Please provide the company name. For example: 'name Acme Corporation'";
      }
      break;
      
    case 'deal':
      if (!partialDetails.name) {
        return "I'd be happy to help you create a new deal! Please provide the deal name. For example: 'name Q4 Software License'";
      }
      break;
      
    case 'activity':
      if (!partialDetails.subject) {
        return "I'd be happy to help you create a new activity! Please provide the subject. For example: 'subject Follow-up call with John'";
      }
      break;
  }
  
  return `I need more information to create this ${objectType}.${providedText} Please provide the missing details.`;
}

async function createObject(details: Record<string, string>, objectType: string, userId: string) {
  try {
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    
    switch (objectType) {
      case 'contact':
        return await createContact(details, teamId, userId);
      case 'account':
        return await createAccount(details, teamId, userId);
      case 'deal':
        return await createDeal(details, teamId, userId);
      case 'activity':
        return await createActivity(details, teamId, userId);
      default:
        throw new Error(`Unknown object type: ${objectType}`);
    }
  } catch (error) {
    console.error(`Error creating ${objectType}:`, error);
    return NextResponse.json({
      message: `I encountered an error while creating the ${objectType}. Please try again.`,
      error: true
    });
  }
}

async function createContact(details: Record<string, string>, teamId: string, userId: string) {
  const nameParts = details.name!.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const contactId = await convex.mutation(api.crm.createContact, {
          teamId,
          createdBy: userId,
    firstName,
    lastName,
    email: details.email!,
    phone: details.phone,
    title: details.title,
    company: details.company,
    leadStatus: "new",
    contactType: "contact",
    source: "chat_creation"
  });
  
  return NextResponse.json({
    message: `✅ Contact created successfully! I've added ${details.name} (${details.email}) to your database.`,
    action: "contact_created",
    contactId,
    contactName: details.name,
    contactEmail: details.email
  });
}

async function createAccount(details: Record<string, string>, teamId: string, userId: string) {
  const accountId = await convex.mutation(api.crm.createAccount, {
          teamId,
          createdBy: userId,
    name: details.name!,
    industry: details.industry,
    website: details.website,
    phone: details.phone
  });
  
  return NextResponse.json({
    message: `✅ Account created successfully! I've added ${details.name} to your database.`,
    action: "account_created",
    accountId,
    accountName: details.name
  });
}

async function createDeal(details: Record<string, string>, teamId: string, userId: string) {
  // Validate stage is one of the allowed values
  const validStages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
  const stage = details.stage && validStages.includes(details.stage as typeof validStages[number]) ? details.stage as typeof validStages[number] : "prospecting";
  
  const dealId = await convex.mutation(api.crm.createDeal, {
          teamId,
          createdBy: userId,
    name: details.name!,
    stage,
    amount: details.amount ? parseFloat(details.amount) : undefined,
    description: details.description
  });
  
  return NextResponse.json({
    message: `✅ Deal created successfully! I've added ${details.name} to your database.`,
    action: "deal_created",
    dealId,
    dealName: details.name
  });
}

async function createActivity(details: Record<string, string>, teamId: string, userId: string) {
  const activityId = await convex.mutation(api.crm.createActivity, {
                  teamId,
                  createdBy: userId,
    type: "event",
    subject: details.subject!,
    description: details.description,
    status: "scheduled"
  });
  
  return NextResponse.json({
    message: `✅ Activity created successfully! I've added ${details.subject} to your database.`,
    action: "activity_created",
    activityId,
    activitySubject: details.subject
  });
}

async function handleDatabaseQuery(message: string, entities: Record<string, unknown>, userId: string) {
  // Use existing database operation logic
  const result = await handleDatabaseOperation(message, userId);
  return NextResponse.json(result);
}

async function handleChartGeneration(message: string, entities: Record<string, unknown>, sessionFiles: Array<{ name: string; content: string }>, userId: string) {
  // Use existing chart generation logic
  const result = await handleChart(message, sessionFiles, userId);
  return NextResponse.json(result);
}

async function handleGeneralConversation(message: string, messages: Message[], context: UserContext, userId?: string) {
  try {
    // Get user's data for context
    const actualUserId = userId || context.userProfile?.email || 'unknown';
    console.log('🔍 Getting data for user:', actualUserId);
    
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: actualUserId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
    console.log('👥 Contacts found:', contacts.length);
    
    const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
    const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
    const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });

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
        }))
    ],
    temperature: 0.7,
      max_tokens: 1500
    }, {
      userId: context.userProfile?.name || 'unknown',
      operation: 'general_conversation',
      model: 'gpt-4'
    });

    const aiResponse = response.choices[0]?.message?.content || "I'm here to help! What would you like to do?";

    // Check if this is a follow-up to an email context prompt
    console.log('🔍 Checking for email context response...');
    console.log('📋 Messages length:', messages.length);
    console.log('📋 Last few messages:', messages.slice(-3).map(m => ({ role: m.role, action: m.action, content: m.content?.substring(0, 50) + '...' })));
    
    // Find the last assistant message by looking backwards through the messages array
    let lastAssistantMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantMessage = messages[i];
        break;
      }
    }
    console.log('📋 Last assistant message:', { 
      role: lastAssistantMessage?.role, 
      action: lastAssistantMessage?.action, 
      contactName: lastAssistantMessage?.contactName,
      contactId: lastAssistantMessage?.contactId,
      contactEmail: lastAssistantMessage?.contactEmail,
      content: lastAssistantMessage?.content?.substring(0, 100) + '...'
    });
    
    // Alternative detection: Check if the last assistant message asked for email context
    const lastAssistantContent = lastAssistantMessage?.content?.toLowerCase() || '';
    const askedForEmailContext = lastAssistantContent.includes("what would you like to say in the email") ||
                                lastAssistantContent.includes("provide any other context for the email");
    
    console.log('🎯 Asked for email context:', askedForEmailContext);
    
    if (askedForEmailContext && lastAssistantMessage?.role === 'assistant') {
      // Extract contact name from the assistant's message
      const contactNameMatch = lastAssistantContent.match(/send an email to ([^.]+)/i);
      const contactName = contactNameMatch ? contactNameMatch[1].trim() : null;
      
      console.log('🔍 Detected email context response. ContactName from message:', contactName);
      
      if (contactName) {
        const matchingContact = contacts.find(contact => {
          const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
          return fullName.includes(contactName.toLowerCase()) || 
                 contactName.toLowerCase().includes(fullName);
        });
        
        if (matchingContact) {
          console.log('📧 Creating email with provided context for:', contactName);
          return await draftEmail(matchingContact, context, message);
        } else {
          console.log('❌ Could not find matching contact for name:', contactName);
        }
      }
    }
    
    // Check if this is a follow-up to a creation details prompt
    const askedForCreationDetails = lastAssistantContent.includes("please provide") ||
                                   lastAssistantContent.includes("need the") ||
                                   lastAssistantContent.includes("missing details") ||
                                   lastAssistantContent.includes("provide the");
    
    console.log('🎯 Asked for creation details:', askedForCreationDetails);
    
    if (askedForCreationDetails && lastAssistantMessage?.role === 'assistant') {
      // Check if the last message had objectType and partialDetails
      if (lastAssistantMessage?.objectType && lastAssistantMessage?.partialDetails) {
        console.log('🔍 Detected creation details response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Extract additional details from the current message
        const additionalDetails = extractObjectDetailsFromNaturalLanguage(message);
        console.log('📝 Additional details extracted:', additionalDetails);
        
        // Combine with previous partial details
        const combinedDetails = { ...lastAssistantMessage.partialDetails, ...additionalDetails };
        console.log('📝 Combined details:', combinedDetails);
        
        // Check if we now have enough details
        if (hasRequiredDetails(combinedDetails, lastAssistantMessage.objectType)) {
          // Ask for confirmation before creating
          const confirmationMessage = getConfirmationMessage(lastAssistantMessage.objectType, combinedDetails);
          console.log('✅ Sufficient details found, asking for confirmation');
          return NextResponse.json({
            message: confirmationMessage,
            action: "confirm_creation",
            objectType: lastAssistantMessage.objectType,
            details: combinedDetails
          });
        } else {
          // Still missing details
          const prompt = getCreationPrompt(lastAssistantMessage.objectType, combinedDetails);
          console.log('❓ Still missing details, prompting again');
          return NextResponse.json({
            message: prompt,
            action: "prompt_creation_details",
            objectType: lastAssistantMessage.objectType,
            partialDetails: combinedDetails
          });
        }
      }
    }
    
    // Check if this is a confirmation response
    const askedForConfirmation = lastAssistantContent.includes("confirm") ||
                                lastAssistantContent.includes("correct") ||
                                lastAssistantContent.includes("Is this correct");
    
    console.log('🎯 Asked for confirmation:', askedForConfirmation);
    
    if (askedForConfirmation && lastAssistantMessage?.role === 'assistant') {
      // Check if the last message had objectType and details (for creation)
      if (lastAssistantMessage?.objectType && lastAssistantMessage?.details) {
        console.log('🔍 Detected creation confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed, cancelled, or provided corrections
        const lowerResponse = message.toLowerCase().trim();
        
        // Check for corrections first (before yes/no)
        const correctionPatterns = [
          /(?:the|change|update|correct|fix)\s+(?:name|email|company|phone|title)\s+(?:should\s+be|to|is)\s+(.+)/i,
          /(?:name|email|company|phone|title)\s+(?:should\s+be|is)\s+(.+)/i,
          /(?:it's|it is)\s+(.+)/i
        ];
        
        let isCorrection = false;
        let correctedDetails = { ...lastAssistantMessage.details };
        
        for (const pattern of correctionPatterns) {
          const match = message.match(pattern);
          if (match) {
            isCorrection = true;
            const correction = match[1].trim();
            
            // Determine which field is being corrected based on context
            if (message.toLowerCase().includes('name')) {
              correctedDetails.name = correction;
            } else if (message.toLowerCase().includes('email')) {
              correctedDetails.email = correction;
            } else if (message.toLowerCase().includes('company')) {
              correctedDetails.company = correction;
            } else if (message.toLowerCase().includes('phone')) {
              correctedDetails.phone = correction;
            } else if (message.toLowerCase().includes('title')) {
              correctedDetails.title = correction;
            } else {
              // If no specific field mentioned, assume it's the name if it looks like a name
              if (!correction.includes('@') && !correction.includes('.com')) {
                correctedDetails.name = correction;
              }
            }
            break;
          }
        }
        
        if (isCorrection) {
          console.log('🔧 User provided correction, updating details:', correctedDetails);
          return NextResponse.json({
            message: `Please confirm the corrected contact details before I create the record:\n\n**Name:** ${correctedDetails.name || 'Not specified'}\n**Email:** ${correctedDetails.email || 'Not specified'}\n**Company:** ${correctedDetails.company || 'Not specified'}\n**Phone:** ${correctedDetails.phone || 'Not specified'}\n**Title:** ${correctedDetails.title || 'Not specified'}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`,
            action: "confirm_creation",
            objectType: lastAssistantMessage.objectType,
            details: correctedDetails
          });
        } else if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, creating object');
          return await createObject(lastAssistantMessage.details, lastAssistantMessage.objectType, userId);
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled');
          return NextResponse.json({
            message: "Creation cancelled. What would you like to do instead?",
            action: "creation_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_creation",
            objectType: lastAssistantMessage.objectType,
            details: lastAssistantMessage.details
          });
        }
      }
      
      // Check if the last message had contactId and field (for updates)
      if (lastAssistantMessage?.contactId && lastAssistantMessage?.field && lastAssistantMessage?.value) {
        console.log('🔍 Detected update confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, updating contact');
          
          // Update the contact in the database
          const updateData: Record<string, string> = {};
          if (lastAssistantMessage.field === 'email') updateData.email = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'phone') updateData.phone = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'title') updateData.title = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'company') updateData.company = lastAssistantMessage.value;
          
          console.log('📝 Update data:', updateData);
          
          // Call Convex mutation to update the contact
          console.log('🔄 Calling Convex mutation...');
          await convex.mutation(api.crm.updateContact, {
            contactId: lastAssistantMessage.contactId as Id<"contacts">,
            updates: updateData
          });
          
          console.log('✅ Contact update successful');
          return NextResponse.json({
            message: `I've successfully updated ${lastAssistantMessage.contactName}'s ${lastAssistantMessage.field} to ${lastAssistantMessage.value}.`,
            action: "contact_updated"
          });
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled update');
          return NextResponse.json({
            message: "Update cancelled. What would you like to do instead?",
            action: "update_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_update",
            contactId: lastAssistantMessage.contactId,
            field: lastAssistantMessage.field,
            value: lastAssistantMessage.value,
            contactName: lastAssistantMessage.contactName
          });
        }
      }
      
      // Check if the last message had contactId and action for delete confirmation
      console.log('🔍 Checking for delete confirmation - contactId:', lastAssistantMessage?.contactId, 'action:', lastAssistantMessage?.action);
      if (lastAssistantMessage?.contactId && lastAssistantMessage?.action === 'confirm_delete') {
        console.log('🔍 Detected delete confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, deleting contact');
          
          try {
            // Call Convex mutation to delete the contact
            console.log('🔄 Calling Convex deleteContact mutation...');
            await convex.mutation(api.crm.deleteContact, {
              contactId: lastAssistantMessage.contactId as Id<"contacts">
            });
            
            console.log('✅ Contact deletion successful');
            return NextResponse.json({
              message: `I've successfully deleted the contact ${lastAssistantMessage.contactName} (${lastAssistantMessage.contactEmail}).`,
              action: "contact_deleted"
            });
          } catch (error) {
            console.error('❌ Contact deletion failed:', error);
            return NextResponse.json({
              message: "I encountered an error while deleting the contact. Please try again.",
              error: true
            });
          }
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled deletion');
          return NextResponse.json({
            message: "Deletion cancelled. What would you like to do instead?",
            action: "delete_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_delete",
            contactId: lastAssistantMessage.contactId,
            contactName: lastAssistantMessage.contactName,
            contactEmail: lastAssistantMessage.contactEmail
          });
        }
      }
      
      // Check if the last message had accountId and field (for account updates)
      if (lastAssistantMessage?.accountId && lastAssistantMessage?.field && lastAssistantMessage?.value) {
        console.log('🔍 Detected account update confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, updating account');
          
          // Update the account in the database
          const updateData: Record<string, string> = {};
          if (lastAssistantMessage.field === 'industry') updateData.industry = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'website') updateData.website = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'phone') updateData.phone = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'revenue') updateData.annualRevenue = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'employees') updateData.employeeCount = lastAssistantMessage.value;
          
          console.log('📝 Update data:', updateData);
          
          // Call Convex mutation to update the account
          console.log('🔄 Calling Convex mutation...');
          await convex.mutation(api.crm.updateAccount, {
            accountId: lastAssistantMessage.accountId as Id<"accounts">,
            updates: updateData
          });
          
          console.log('✅ Account update successful');
          return NextResponse.json({
            message: `I've successfully updated ${lastAssistantMessage.accountName}'s ${lastAssistantMessage.field} to ${lastAssistantMessage.value}.`,
            action: "account_updated"
          });
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled update');
          return NextResponse.json({
            message: "Update cancelled. What would you like to do instead?",
            action: "update_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_update",
            accountId: lastAssistantMessage.accountId,
            field: lastAssistantMessage.field,
            value: lastAssistantMessage.value,
            accountName: lastAssistantMessage.accountName
          });
        }
      }
      
      // Check if the last message had accountId and action for account delete confirmation
      if (lastAssistantMessage?.accountId && lastAssistantMessage?.action === 'confirm_delete') {
        console.log('🔍 Detected account delete confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, deleting account');
          
          try {
            // Call Convex mutation to delete the account
            console.log('🔄 Calling Convex deleteAccount mutation...');
            await convex.mutation(api.crm.deleteAccount, {
              accountId: lastAssistantMessage.accountId as Id<"accounts">
            });
            
            console.log('✅ Account deletion successful');
            return NextResponse.json({
              message: `I've successfully deleted the account ${lastAssistantMessage.accountName}.`,
              action: "account_deleted"
            });
          } catch (error) {
            console.error('❌ Account deletion failed:', error);
            return NextResponse.json({
              message: "I encountered an error while deleting the account. Please try again.",
              error: true
            });
          }
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled deletion');
          return NextResponse.json({
            message: "Deletion cancelled. What would you like to do instead?",
            action: "delete_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_delete",
            accountId: lastAssistantMessage.accountId,
            accountName: lastAssistantMessage.accountName
          });
        }
      }
      
      // Check if the last message had dealId and field (for deal updates)
      if (lastAssistantMessage?.dealId && lastAssistantMessage?.field && lastAssistantMessage?.value) {
        console.log('🔍 Detected deal update confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, updating deal');
          
          // Update the deal in the database
          const updateData: Record<string, string> = {};
          if (lastAssistantMessage.field === 'stage') updateData.stage = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'amount') updateData.amount = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'probability') updateData.probability = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'close date') updateData.closeDate = lastAssistantMessage.value;
          
          console.log('📝 Update data:', updateData);
          
          // Call Convex mutation to update the deal
          console.log('🔄 Calling Convex mutation...');
          await convex.mutation(api.crm.updateDeal, {
            dealId: lastAssistantMessage.dealId as Id<"deals">,
            updates: updateData
          });
          
          console.log('✅ Deal update successful');
          return NextResponse.json({
            message: `I've successfully updated ${lastAssistantMessage.dealName}'s ${lastAssistantMessage.field} to ${lastAssistantMessage.value}.`,
            action: "deal_updated"
          });
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled update');
          return NextResponse.json({
            message: "Update cancelled. What would you like to do instead?",
            action: "update_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_update",
            dealId: lastAssistantMessage.dealId,
            field: lastAssistantMessage.field,
            value: lastAssistantMessage.value,
            dealName: lastAssistantMessage.dealName
          });
        }
      }
      
      // Check if the last message had dealId and action for deal delete confirmation
      if (lastAssistantMessage?.dealId && lastAssistantMessage?.action === 'confirm_delete') {
        console.log('🔍 Detected deal delete confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, deleting deal');
          
          try {
            // Call Convex mutation to delete the deal
            console.log('🔄 Calling Convex deleteDeal mutation...');
            await convex.mutation(api.crm.deleteDeal, {
              dealId: lastAssistantMessage.dealId as Id<"deals">
            });
            
            console.log('✅ Deal deletion successful');
            return NextResponse.json({
              message: `I've successfully deleted the deal ${lastAssistantMessage.dealName}.`,
              action: "deal_deleted"
            });
          } catch (error) {
            console.error('❌ Deal deletion failed:', error);
            return NextResponse.json({
              message: "I encountered an error while deleting the deal. Please try again.",
              error: true
            });
          }
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled deletion');
          return NextResponse.json({
            message: "Deletion cancelled. What would you like to do instead?",
            action: "delete_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_delete",
            dealId: lastAssistantMessage.dealId,
            dealName: lastAssistantMessage.dealName
          });
        }
      }
      
      // Check if the last message had activityId and field (for activity updates)
      if (lastAssistantMessage?.activityId && lastAssistantMessage?.field && lastAssistantMessage?.value) {
        console.log('🔍 Detected activity update confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, updating activity');
          
          // Update the activity in the database
          const updateData: Record<string, string> = {};
          if (lastAssistantMessage.field === 'status') updateData.status = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'type') updateData.type = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'subject') updateData.subject = lastAssistantMessage.value;
          if (lastAssistantMessage.field === 'description') updateData.description = lastAssistantMessage.value;
          
          console.log('📝 Update data:', updateData);
          
          // Call Convex mutation to update the activity
          console.log('🔄 Calling Convex mutation...');
          await convex.mutation(api.crm.updateActivity, {
            activityId: lastAssistantMessage.activityId as Id<"activities">,
            updates: updateData
          });
          
          console.log('✅ Activity update successful');
          return NextResponse.json({
            message: `I've successfully updated ${lastAssistantMessage.activitySubject}'s ${lastAssistantMessage.field} to ${lastAssistantMessage.value}.`,
            action: "activity_updated"
          });
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled update');
          return NextResponse.json({
            message: "Update cancelled. What would you like to do instead?",
            action: "update_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_update",
            activityId: lastAssistantMessage.activityId,
            field: lastAssistantMessage.field,
            value: lastAssistantMessage.value,
            activitySubject: lastAssistantMessage.activitySubject
          });
        }
      }
      
      // Check if the last message had activityId and action for activity delete confirmation
      if (lastAssistantMessage?.activityId && lastAssistantMessage?.action === 'confirm_delete') {
        console.log('🔍 Detected activity delete confirmation response');
        
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        // Check if user confirmed
        const lowerResponse = message.toLowerCase().trim();
        if (lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm') {
          console.log('✅ User confirmed, deleting activity');
          
          try {
            // Call Convex mutation to delete the activity
            console.log('🔄 Calling Convex deleteActivity mutation...');
            await convex.mutation(api.crm.deleteActivity, {
              activityId: lastAssistantMessage.activityId as Id<"activities">
            });
            
            console.log('✅ Activity deletion successful');
            return NextResponse.json({
              message: `I've successfully deleted the activity ${lastAssistantMessage.activitySubject}.`,
              action: "activity_deleted"
            });
          } catch (error) {
            console.error('❌ Activity deletion failed:', error);
            return NextResponse.json({
              message: "I encountered an error while deleting the activity. Please try again.",
              error: true
            });
          }
        } else if (lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel') {
          console.log('❌ User cancelled deletion');
          return NextResponse.json({
            message: "Deletion cancelled. What would you like to do instead?",
            action: "delete_cancelled"
          });
        } else {
          console.log('❓ Unclear response, asking for clarification');
          return NextResponse.json({
            message: "I didn't understand your response. Please respond with 'yes' to confirm or 'no' to cancel.",
            action: "confirm_delete",
            activityId: lastAssistantMessage.activityId,
            activitySubject: lastAssistantMessage.activitySubject
          });
        }
      }
    }
    
    // Check if the user is asking about uploaded files
    const lowerMessage = message.toLowerCase();
    if (context.sessionFiles && context.sessionFiles.length > 0) {
      if (lowerMessage.includes('file') || lowerMessage.includes('upload') || lowerMessage.includes('data')) {
        console.log('📁 File-related query detected with sessionFiles');
        console.log('📂 Available sessionFiles:', context.sessionFiles.map(f => ({ name: f.name, contentLength: f.content?.length })));
        
        // Include actual file content in the system prompt for file-related questions
        const fileInfo = context.sessionFiles.map(file => 
          `File: ${file.name}\nContent: ${file.content.substring(0, 1000)}${file.content.length > 1000 ? '...' : ''}`
        ).join('\n\n');
        
        const fileSystemPrompt = `You are Shabe AI, a helpful assistant. The user has uploaded files and is asking about them. Here are the actual uploaded files:

${fileInfo}

Please analyze the ACTUAL file content above and respond based on what you see in the files. Do not make assumptions or reference data that isn't in the uploaded files.`;

        const response = await openaiClient.chatCompletionsCreate({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: fileSystemPrompt
            },
            {
              role: "user", 
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        }, {
          userId: context.userProfile?.name || 'unknown',
          operation: 'file_analysis',
          model: 'gpt-4'
        });

        const aiResponse = response.choices[0]?.message?.content || "I can help you analyze your uploaded files.";

  return NextResponse.json({
          message: aiResponse
        });
      }
    }
    
    // Check for enhanced chart modification and analysis requests FIRST
    const enhancedChartPatterns = [
      /(?:change|modify|update|switch|convert)\s+(?:to\s+)?(?:pie|bar|line|area|scatter)\s+(?:chart|graph)/i,
      /(?:show|hide|toggle)\s+(?:grid|legend|tooltip|animation)/i,
      /(?:analyze|find|detect)\s+(?:trends?|patterns?|anomalies?|insights?)/i,
      /(?:export|save|download)\s+(?:as\s+)?(?:png|csv|pdf)/i,
      /(?:predict|forecast)\s+(?:trends?|future|next)/i,
      /(?:highlight|emphasize|focus)\s+(?:on|the)/i,
      /(?:filter|show\s+only|display\s+only)/i,
      /(?:sort|order|arrange)\s+(?:by|in)/i,
      // Add patterns for simple data references that should modify existing charts
      /^(?:deals?|contacts?|accounts?)\s+(?:by\s+)?(?:stage|status|industry|type)$/i,
      /^(?:show|display|view)\s+(?:deals?|contacts?|accounts?)\s+(?:by\s+)?(?:stage|status|industry|type)$/i
    ];

    const matchingPattern = enhancedChartPatterns.find(pattern => pattern.test(message));
    const hasEnhancedChartRequest = !!matchingPattern;
    
    if (hasEnhancedChartRequest) {
      console.log('🚀 Enhanced chart request detected:', message);
      console.log('🚀 Matching pattern:', matchingPattern?.toString());
      
      // Find the most recent chart message
      const recentChartMessage = messages.findLast(m => m.chartSpec);
      console.log('🚀 Recent chart message found:', !!recentChartMessage);
      console.log('🚀 Chart spec exists:', !!recentChartMessage?.chartSpec);
      
      if (recentChartMessage?.chartSpec) {
        try {
          const { enhancedAnalytics } = await import('@/lib/enhancedAnalytics');
          
          // Detect the type of request
          const modificationIntent = enhancedAnalytics.detectModificationIntent(message);
          const analysisIntent = enhancedAnalytics.detectAnalysisIntent(message);
          
          if (modificationIntent.confidence > 0.7) {
            console.log('🚀 Chart modification request detected:', modificationIntent);
            const modifiedChart = await enhancedAnalytics.modifyChart(recentChartMessage.chartSpec, message);
            
            if (modifiedChart) {
              return NextResponse.json({
                message: `I've updated the chart based on your request: "${message}". The chart has been modified with your requested changes.`,
                chartSpec: modifiedChart,
                enhancedChart: true
              });
            }
          } else if (analysisIntent.confidence > 0.7) {
            console.log('🚀 Chart analysis request detected:', analysisIntent);
            
            if (analysisIntent.type === 'trend') {
              const { predictions, confidence } = await enhancedAnalytics.predictTrends(
                recentChartMessage.chartSpec.data,
                recentChartMessage.chartSpec.dataSource || 'database',
                'next 30 days'
              );
              
              return NextResponse.json({
                message: `Based on the chart data, here are the trend predictions:\n\n${predictions.map((pred, i) => `${i + 1}. ${pred}`).join('\n')}\n\nConfidence level: ${confidence}%`,
                enhancedChart: true
              });
            } else {
              const { analysis, recommendations } = await enhancedAnalytics.analyzeData(
                recentChartMessage.chartSpec.data,
                recentChartMessage.chartSpec.dataSource || 'database',
                analysisIntent.type
              );
              
              return NextResponse.json({
                message: `Here's my analysis of the chart data:\n\n**Analysis:**\n${analysis}\n\n**Recommendations:**\n${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}`,
                enhancedChart: true
              });
            }
          }
        } catch (error) {
          console.error('❌ Error processing enhanced chart request:', error);
        }
      }
    }

    // Check if the user wants to create a chart
    if (lowerMessage.includes('chart') || lowerMessage.includes('graph') || lowerMessage.includes('visualization') ||
        (lowerMessage.includes('deals') && lowerMessage.includes('stage')) ||
        (lowerMessage.includes('contacts') && lowerMessage.includes('status')) ||
        (lowerMessage.includes('accounts') && lowerMessage.includes('industry'))) {
      console.log('📊 Chart request detected, calling chart generation');
      console.log('📂 Context sessionFiles:', context.sessionFiles?.map(f => ({ name: f.name, contentLength: f.content?.length })));
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleChartGeneration(message, {}, context.sessionFiles, userId);
    }
    
    // Check if the user wants to view data (contacts, deals, accounts, etc.)
    if (lowerMessage.includes('view') || lowerMessage.includes('show') || lowerMessage.includes('list') || lowerMessage.includes('see')) {
      if (lowerMessage.includes('contact') || lowerMessage.includes('deal') || lowerMessage.includes('account') || lowerMessage.includes('activity')) {
        console.log('📋 Data view request detected, calling database query');
        if (!userId) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        return await handleDatabaseQuery(message, {}, userId);
      }
    }
    
    // Check if the user wants to update a contact
    if (lowerMessage.includes('update') && (lowerMessage.includes('email') || lowerMessage.includes('phone') || lowerMessage.includes('contact'))) {
      console.log('✏️ Contact update request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleContactUpdateWithConfirmation(message, userId);
    }
    
    // Check if the user wants to delete a contact
    if (lowerMessage.includes('delete') && lowerMessage.includes('contact')) {
      console.log('🗑️ Contact deletion request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleContactDeleteWithConfirmation(message, userId);
    }
    
    // Check if the user wants to update an account
    if (lowerMessage.includes('update') && lowerMessage.includes('account')) {
      console.log('✏️ Account update request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleAccountUpdateWithConfirmation(message, userId);
    }
    
    // Check if the user wants to delete an account
    if (lowerMessage.includes('delete') && lowerMessage.includes('account')) {
      console.log('🗑️ Account deletion request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleAccountDeleteWithConfirmation(message, userId);
    }
    
    // Check if the user wants to update a deal
    if (lowerMessage.includes('update') && lowerMessage.includes('deal')) {
      console.log('✏️ Deal update request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleDealUpdateWithConfirmation(message, userId);
    }
    
    // Check if the user wants to delete a deal
    if (lowerMessage.includes('delete') && lowerMessage.includes('deal')) {
      console.log('🗑️ Deal deletion request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleDealDeleteWithConfirmation(message, userId);
    }
    
    // Check if the user wants to update an activity
    if (lowerMessage.includes('update') && lowerMessage.includes('activity')) {
      console.log('✏️ Activity update request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleActivityUpdateWithConfirmation(message, userId);
    }
    
    // Check if the user wants to delete an activity
    if (lowerMessage.includes('delete') && lowerMessage.includes('activity')) {
      console.log('🗑️ Activity deletion request detected');
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      return await handleActivityDeleteWithConfirmation(message, userId);
    }
    
    // Check if the user wants to create a new object (contact, account, deal, activity)
    if (lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) {
      const objectType = determineObjectType(message);
      console.log('🆕 Object creation request detected:', objectType);
      
      if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      
      // Extract details from the message
      const details = extractObjectDetailsFromNaturalLanguage(message);
      console.log('📝 Extracted details:', details);
      
      // Check if we have enough details to create the object
      if (hasRequiredDetails(details, objectType)) {
        // Ask for confirmation before creating
        const confirmationMessage = getConfirmationMessage(objectType, details);
        console.log('✅ Sufficient details found, asking for confirmation');
        return NextResponse.json({
          message: confirmationMessage,
          action: "confirm_creation",
          objectType: objectType,
          details: details
        });
      } else {
        // Ask for missing details
        const prompt = getCreationPrompt(objectType, details);
        console.log('❓ Missing details, prompting user');
        return NextResponse.json({
          message: prompt,
          action: "prompt_creation_details",
          objectType: objectType,
          partialDetails: details
        });
      }
    }
    


    // Check if the user wants to send an email and go directly to email preview
    if (lowerMessage.includes('send') && lowerMessage.includes('email')) {
      // Extract contact name from the message - improved pattern matching
      const contactMatch = message.match(/(?:send|email)\s+(?:to\s+)?([a-z\s]+?)(?:\s+(?:a\s+)?email|\s+email)/i) ||
                          message.match(/send.*email.*to\s+([^,\n]+)/i) ||
                          message.match(/(?:send|email)\s+([a-z\s]+?)(?:\s+email|\s+a\s+email)/i) ||
                          message.match(/([a-z\s]+?)\s+(?:a\s+)?email/i);
      
              if (contactMatch) {
          const contactName = contactMatch[1].trim();
          console.log('📧 Email request detected - extracted contact name:', contactName);
          console.log('📧 Available contacts:', contacts.map(c => `${c.firstName} ${c.lastName}`));
          
          const matchingContact = contacts.find(contact => {
            const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
            const matches = fullName.includes(contactName.toLowerCase()) || 
                           contactName.toLowerCase().includes(fullName);
            console.log(`📧 Checking "${fullName}" against "${contactName}" - matches: ${matches}`);
            return matches;
          });

        if (matchingContact) {
          // Check if the user provided context for the email content
          const hasEmailContext = message.toLowerCase().includes('thank') || 
                                message.toLowerCase().includes('follow up') ||
                                message.toLowerCase().includes('meeting') ||
                                message.toLowerCase().includes('call') ||
                                message.toLowerCase().includes('discuss') ||
                                message.toLowerCase().includes('about') ||
                                message.toLowerCase().includes('regarding') ||
                                message.toLowerCase().includes('subject') ||
                                message.toLowerCase().includes('content');
          
          if (hasEmailContext) {
            console.log('📧 Going directly to email preview for:', contactName);
            return await draftEmail(matchingContact, context);
          } else {
            // Ask for more context
            return NextResponse.json({
              message: `I'd be happy to send an email to ${contactName}. What would you like to say in the email? For example:\n\n• "Thank him for the meeting yesterday"\n• "Follow up on our discussion"\n• "Schedule a call for next week"\n• Or provide any other context for the email content.`,
              action: "prompt_email_context",
              contactName: contactName,
              contactId: matchingContact._id
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: aiResponse
    });

  } catch (error) {
    console.error('General conversation failed:', error);
    return NextResponse.json({
      message: "I'm having trouble processing your request right now. Please try again.",
      error: true
    });
  }
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
  const queryWords = ['view', 'show', 'list', 'all', 'contacts', 'accounts', 'deals', 'activities', 'contact', 'account', 'deal', 'activity', 'at', 'in', 'with', 'find', 'get', 'search', 'filter'];
  let filteredMessage = message;
  
  queryWords.forEach(word => {
    filteredMessage = filteredMessage.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });
  
  // Split by common separators and clean up
  const terms = filteredMessage
    .split(/[\s,]+/)
    .map(term => term.trim())
    .filter(term => term.length > 0 && term.length < 50); // Reasonable length limits
  
  // Special case: if the message contains "all" and we're asking for all records, return empty array
  // This will show all records without filtering
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('all')) {
    return [];
  }
  
  // If no terms found, try to extract names from the original message
  if (terms.length === 0) {
    // Look for patterns like "view john smith" or "show john"
    const namePatterns = [
      /view\s+([a-zA-Z\s]+)/i,
      /show\s+([a-zA-Z\s]+)/i,
      /find\s+([a-zA-Z\s]+)/i,
      /get\s+([a-zA-Z\s]+)/i,
      /search\s+([a-zA-Z\s]+)/i
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
function getFilterInfo(userMessage: string): string | null {
  const terms = extractFilterTerms(userMessage.toLowerCase());
  if (terms.length === 0) return null;
  
  return terms.join(', ');
}

// Helper function to format records consistently
function formatRecord(record: DatabaseRecord, dataType: string): FormattedRecord {
  const baseRecord = {
    id: record._id,
    created: new Date(record._creationTime).toLocaleDateString()
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
      email: '', // Accounts don't have emails
      phone: '', // Accounts don't have phones
      company: record.name || '', // Use name as company for accounts
      title: '', // Accounts don't have titles
      status: '', // Accounts don't have status
      type: '', // Accounts don't have type
      source: '', // Accounts don't have source
      industry: record.industry || '',
      size: record.size || '',
      website: record.website || ''
    };
  } else if (dataType === 'deals') {
    return {
      ...baseRecord,
      name: record.name || '',
      email: '', // Deals don't have emails
      phone: '', // Deals don't have phones
      company: '', // Deals don't have company
      title: '', // Deals don't have title
      status: record.stage || '',
      type: '', // Deals don't have type
      source: '', // Deals don't have source
      value: record.value || '',
      stage: record.stage || '',
      probability: typeof record.probability === 'number' ? record.probability.toString() : record.probability || ''
    };
  } else if (dataType === 'activities') {
    return {
      ...baseRecord,
      name: record.subject || '', // Use subject as name for activities
      email: '', // Activities don't have emails
      phone: '', // Activities don't have phones
      company: '', // Activities don't have company
      title: '', // Activities don't have title
      status: record.status || '',
      type: record.type || '',
      source: '', // Activities don't have source
      subject: record.subject || '',
      dueDate: record.dueDate ? new Date(record.dueDate).toLocaleDateString() : ''
    };
  }
  
  // Fallback for unknown data types
  return {
    ...baseRecord,
    name: record.name || '',
    email: record.email || '',
    phone: record.phone || '',
    company: record.company || '',
    title: record.title || '',
    status: record.status || '',
    type: record.type || '',
    source: record.source || ''
  };
}

// Helper function to generate clarification messages
function getClarificationMessage(dataType: string, records: DatabaseRecord[]): string {
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
      chartSpec
    };

  } catch (error) {
    console.error('❌ File chart generation error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    return {
      message: `I encountered an error while analyzing your uploaded file for chart generation: ${error instanceof Error ? error.message : String(error)}. Please ensure the file contains structured data that can be visualized.`,
      error: true
    };
  }
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
    if (lowerMessage.includes('line') || lowerMessage.includes('trend') || lowerMessage.includes('over time')) {
      chartType = 'line';
      console.log('🚀 Chart type detected: line');
    } else if (lowerMessage.includes('pie') || lowerMessage.includes('distribution') || lowerMessage.includes('percentage')) {
      chartType = 'pie';
      console.log('🚀 Chart type detected: pie');
    } else if (lowerMessage.includes('area') || lowerMessage.includes('filled')) {
      chartType = 'area';
      console.log('🚀 Chart type detected: area');
    } else if (lowerMessage.includes('scatter') || lowerMessage.includes('correlation')) {
      chartType = 'scatter';
      console.log('🚀 Chart type detected: scatter');
    } else if (lowerMessage.includes('bar') || lowerMessage.includes('column')) {
      chartType = 'bar';
      console.log('🚀 Chart type detected: bar');
    } else {
      console.log('🚀 No specific chart type detected, using default: bar');
    }
    
    if ((lowerMessage.includes('deal') && lowerMessage.includes('stage')) || 
        (lowerMessage.includes('deal') && (lowerMessage.includes('pipeline') || lowerMessage.includes('progress')))) {
      // Deals by stage chart
      console.log('🚀 Generating deals by stage chart');
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      
      // Group deals by stage
      const stageGroups: Record<string, number> = {};
      deals.forEach(deal => {
        const stage = deal.stage || 'Unknown';
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
    console.error('❌ Enhanced chart generation error:', error);
    return {
      message: "I encountered an error while generating the enhanced chart. Please try again.",
      error: true
    };
  }
}

// Main POST handler with LLM-agent architecture
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userId, sessionFiles = [], companyData = {}, userData = {} } = body;

    // Add breadcrumb for tracking
    addBreadcrumb('Chat API called', 'api', {
      userId,
      messageCount: messages.length,
      hasSessionFiles: sessionFiles.length > 0,
    });

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
    const context: UserContext = {
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

    // Use LLM-driven approach instead of rigid rule-based routing
    // Let the LLM handle the conversation naturally and decide what actions to take
    return await handleGeneralConversation(lastUserMessage, messages, context, userId);

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    // Log error with context
    logError(error instanceof Error ? error : String(error), {
      action: 'chat_api_request',
      component: 'chat_route',
      additionalData: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleAccountUpdateWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting account update for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract account name and field updates from the message
    const lowerMessage = message.toLowerCase();
    
    // Extract name (look for patterns like "acme corp", "acme")
    const nameMatch = message.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/);
    const accountName = nameMatch ? nameMatch[0] : null;
    
    // Extract field and value (e.g., "industry to technology")
    const fieldMatch = lowerMessage.match(/(industry|website|phone|revenue|employees)\s+to\s+([^\s]+(?:\s+[^\s]+)*)/);
    const field = fieldMatch ? fieldMatch[1] : null;
    const value = fieldMatch ? fieldMatch[2] : null;
    
    console.log('📝 Extracted data:', { accountName, field, value });
    
    if (!accountName || !field || !value) {
      console.log('❌ Missing required data for account update');
      return NextResponse.json({
        message: "I couldn't understand the update request. Please specify the account name and what field to update. For example: 'update acme corp industry to technology'",
        error: true
      });
    }
    
    // Find the account in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up accounts for team...');
    const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
    console.log('🏢 Accounts found:', accounts.length);
    
    const matchingAccount = accounts.find(account => {
      const accountNameLower = account.name?.toLowerCase() || '';
      const searchName = accountName.toLowerCase();
      
      return accountNameLower.includes(searchName) || 
             searchName.includes(accountNameLower) ||
             accountNameLower.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => accountNameLower.includes(part));
    });
    
    if (!matchingAccount) {
      console.log('❌ No matching account found');
      return NextResponse.json({
        message: `I couldn't find an account named "${accountName}" in your database. Please check the spelling or create the account first.`,
        error: true
      });
    }
    
    console.log('✅ Found matching account:', matchingAccount);
    
    // Ask for confirmation before updating
    const confirmationMessage = `Please confirm the account update:\n\n**Account:** ${matchingAccount.name}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_update",
      accountId: matchingAccount._id,
      field: field,
      value: value,
      accountName: matchingAccount.name
    });
    
  } catch (error) {
    console.error('Account update failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the account update. Please try again.",
      error: true
    });
  }
}

async function handleAccountDeleteWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting account deletion for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract account name from the message
    const nameMatch = message.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/);
    const accountName = nameMatch ? nameMatch[0] : null;
    
    console.log('📝 Extracted account name:', accountName);
    
    if (!accountName) {
      console.log('❌ No account name found');
      return NextResponse.json({
        message: "I couldn't understand the delete request. Please specify the account by name. For example: 'delete account acme corp'",
        error: true
      });
    }
    
    // Find the account in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up accounts for team...');
    const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
    console.log('🏢 Accounts found:', accounts.length);
    
    const matchingAccount = accounts.find(account => {
      const accountNameLower = account.name?.toLowerCase() || '';
      const searchName = accountName.toLowerCase();
      
      return accountNameLower.includes(searchName) || 
             searchName.includes(accountNameLower) ||
             accountNameLower.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => accountNameLower.includes(part));
    });
    
    if (!matchingAccount) {
      console.log('❌ No matching account found');
      return NextResponse.json({
        message: `I couldn't find an account named "${accountName}" in your database. Please check the spelling or try a different name.`,
        error: true
      });
    }
    
    console.log('✅ Found matching account:', matchingAccount);
    
    // Ask for confirmation before deleting
    const confirmationMessage = `To confirm, you'd like to delete the account "${matchingAccount.name}". Please note that this action is irreversible. Are you sure you want to proceed?`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_delete",
      accountId: matchingAccount._id,
      accountName: matchingAccount.name
    });
    
  } catch (error) {
    console.error('Account deletion failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the account deletion. Please try again.",
      error: true
    });
  }
}

async function handleDealUpdateWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting deal update for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract deal name and field updates from the message
    const lowerMessage = message.toLowerCase();
    
    // Extract name (look for patterns like "acme deal", "enterprise license")
    const nameMatch = message.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/);
    const dealName = nameMatch ? nameMatch[0] : null;
    
    // Extract field and value (e.g., "stage to proposal", "amount to 50000")
    const fieldMatch = lowerMessage.match(/(stage|amount|probability|close date)\s+to\s+([^\s]+(?:\s+[^\s]+)*)/);
    const field = fieldMatch ? fieldMatch[1] : null;
    const value = fieldMatch ? fieldMatch[2] : null;
    
    console.log('📝 Extracted data:', { dealName, field, value });
    
    if (!dealName || !field || !value) {
      console.log('❌ Missing required data for deal update');
      return NextResponse.json({
        message: "I couldn't understand the update request. Please specify the deal name and what field to update. For example: 'update acme deal stage to proposal'",
        error: true
      });
    }
    
    // Find the deal in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up deals for team...');
    const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
    console.log('💰 Deals found:', deals.length);
    
    const matchingDeal = deals.find(deal => {
      const dealNameLower = deal.name?.toLowerCase() || '';
      const searchName = dealName.toLowerCase();
      
      return dealNameLower.includes(searchName) || 
             searchName.includes(dealNameLower) ||
             dealNameLower.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => dealNameLower.includes(part));
    });
    
    if (!matchingDeal) {
      console.log('❌ No matching deal found');
      return NextResponse.json({
        message: `I couldn't find a deal named "${dealName}" in your database. Please check the spelling or create the deal first.`,
        error: true
      });
    }
    
    console.log('✅ Found matching deal:', matchingDeal);
    
    // Ask for confirmation before updating
    const confirmationMessage = `Please confirm the deal update:\n\n**Deal:** ${matchingDeal.name}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_update",
      dealId: matchingDeal._id,
      field: field,
      value: value,
      dealName: matchingDeal.name
    });
    
  } catch (error) {
    console.error('Deal update failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the deal update. Please try again.",
      error: true
    });
  }
}

async function handleDealDeleteWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting deal deletion for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract deal name from the message
    const nameMatch = message.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/);
    const dealName = nameMatch ? nameMatch[0] : null;
    
    console.log('📝 Extracted deal name:', dealName);
    
    if (!dealName) {
      console.log('❌ No deal name found');
      return NextResponse.json({
        message: "I couldn't understand the delete request. Please specify the deal by name. For example: 'delete deal acme enterprise'",
        error: true
      });
    }
    
    // Find the deal in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up deals for team...');
    const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
    console.log('💰 Deals found:', deals.length);
    
    const matchingDeal = deals.find(deal => {
      const dealNameLower = deal.name?.toLowerCase() || '';
      const searchName = dealName.toLowerCase();
      
      return dealNameLower.includes(searchName) || 
             searchName.includes(dealNameLower) ||
             dealNameLower.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => dealNameLower.includes(part));
    });
    
    if (!matchingDeal) {
      console.log('❌ No matching deal found');
      return NextResponse.json({
        message: `I couldn't find a deal named "${dealName}" in your database. Please check the spelling or try a different name.`,
        error: true
      });
    }
    
    console.log('✅ Found matching deal:', matchingDeal);
    
    // Ask for confirmation before deleting
    const confirmationMessage = `To confirm, you'd like to delete the deal "${matchingDeal.name}". Please note that this action is irreversible. Are you sure you want to proceed?`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_delete",
      dealId: matchingDeal._id,
      dealName: matchingDeal.name
    });
    
  } catch (error) {
    console.error('Deal deletion failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the deal deletion. Please try again.",
      error: true
    });
  }
}

async function handleActivityUpdateWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting activity update for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract activity subject and field updates from the message
    const lowerMessage = message.toLowerCase();
    
    // Extract subject (look for patterns like "follow up call", "product demo")
    const subjectMatch = message.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/);
    const activitySubject = subjectMatch ? subjectMatch[0] : null;
    
    // Extract field and value (e.g., "status to completed", "type to meeting")
    const fieldMatch = lowerMessage.match(/(status|type|subject|description)\s+to\s+([^\s]+(?:\s+[^\s]+)*)/);
    const field = fieldMatch ? fieldMatch[1] : null;
    const value = fieldMatch ? fieldMatch[2] : null;
    
    console.log('📝 Extracted data:', { activitySubject, field, value });
    
    if (!activitySubject || !field || !value) {
      console.log('❌ Missing required data for activity update');
      return NextResponse.json({
        message: "I couldn't understand the update request. Please specify the activity subject and what field to update. For example: 'update follow up call status to completed'",
        error: true
      });
    }
    
    // Find the activity in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up activities for team...');
    const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
    console.log('📅 Activities found:', activities.length);
    
    const matchingActivity = activities.find(activity => {
      const activitySubjectLower = activity.subject?.toLowerCase() || '';
      const searchSubject = activitySubject.toLowerCase();
      
      return activitySubjectLower.includes(searchSubject) || 
             searchSubject.includes(activitySubjectLower) ||
             activitySubjectLower.split(' ').some((part: string) => searchSubject.includes(part)) ||
             searchSubject.split(' ').some((part: string) => activitySubjectLower.includes(part));
    });
    
    if (!matchingActivity) {
      console.log('❌ No matching activity found');
      return NextResponse.json({
        message: `I couldn't find an activity with subject "${activitySubject}" in your database. Please check the spelling or create the activity first.`,
        error: true
      });
    }
    
    console.log('✅ Found matching activity:', matchingActivity);
    
    // Ask for confirmation before updating
    const confirmationMessage = `Please confirm the activity update:\n\n**Activity:** ${matchingActivity.subject}\n**Field:** ${field}\n**New Value:** ${value}\n\nIs this correct? Please respond with "yes" to confirm or "no" to cancel.`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_update",
      activityId: matchingActivity._id,
      field: field,
      value: value,
      activitySubject: matchingActivity.subject
    });
    
  } catch (error) {
    console.error('Activity update failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the activity update. Please try again.",
      error: true
    });
  }
}

async function handleActivityDeleteWithConfirmation(message: string, userId: string) {
  try {
    console.log('🔍 Starting activity deletion for message:', message);
    console.log('👤 User ID:', userId);
    
    // Extract activity subject from the message
    const subjectMatch = message.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/);
    const activitySubject = subjectMatch ? subjectMatch[0] : null;
    
    console.log('📝 Extracted activity subject:', activitySubject);
    
    if (!activitySubject) {
      console.log('❌ No activity subject found');
      return NextResponse.json({
        message: "I couldn't understand the delete request. Please specify the activity by subject. For example: 'delete activity follow up call'",
        error: true
      });
    }
    
    // Find the activity in the database
    console.log('🔍 Looking up teams for user...');
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('📋 Teams found:', teams.length);
    
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    console.log('🏢 Using team ID:', teamId);
    
    console.log('🔍 Looking up activities for team...');
    const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
    console.log('📅 Activities found:', activities.length);
    
    const matchingActivity = activities.find(activity => {
      const activitySubjectLower = activity.subject?.toLowerCase() || '';
      const searchSubject = activitySubject.toLowerCase();
      
      return activitySubjectLower.includes(searchSubject) || 
             searchSubject.includes(activitySubjectLower) ||
             activitySubjectLower.split(' ').some((part: string) => searchSubject.includes(part)) ||
             searchSubject.split(' ').some((part: string) => activitySubjectLower.includes(part));
    });
    
    if (!matchingActivity) {
      console.log('❌ No matching activity found');
      return NextResponse.json({
        message: `I couldn't find an activity with subject "${activitySubject}" in your database. Please check the spelling or try a different subject.`,
        error: true
      });
    }
    
    console.log('✅ Found matching activity:', matchingActivity);
    
    // Ask for confirmation before deleting
    const confirmationMessage = `To confirm, you'd like to delete the activity "${matchingActivity.subject}". Please note that this action is irreversible. Are you sure you want to proceed?`;
    
    return NextResponse.json({
      message: confirmationMessage,
      action: "confirm_delete",
      activityId: matchingActivity._id,
      activitySubject: matchingActivity.subject
    });
    
  } catch (error) {
    console.error('Activity deletion failed:', error);
    return NextResponse.json({
      message: "I encountered an error while processing the activity deletion. Please try again.",
      error: true
    });
  }
}