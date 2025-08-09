import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
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
  data?: FormattedRecord[];
  contactName?: string;
  contactId?: string;
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
  
  // For natural language input like "Howard Hall howard.hall@1414ventures.com"
  // Try to extract name and email from the message
  
  // Look for email pattern
  const emailMatch = message.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  if (emailMatch) {
    details.email = emailMatch[1].trim();
  }
  
  // Extract name - everything before the email
  if (emailMatch) {
    const beforeEmail = message.substring(0, emailMatch.index).trim();
    if (beforeEmail) {
      details.name = beforeEmail;
    }
  } else {
    // If no email found, try to extract just a name
    const words = message.trim().split(/\s+/);
    if (words.length >= 2) {
      details.name = words.slice(0, 2).join(' '); // Take first two words as name
    } else if (words.length === 1) {
      details.name = words[0];
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
    console.error('❌ Error updating contact:', error);
    return NextResponse.json({
      message: "I encountered an error while updating the contact. Please try again.",
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
    
    const lastAssistantMessage = messages[messages.length - 2];
    console.log('📋 Last assistant message:', { role: lastAssistantMessage?.role, action: lastAssistantMessage?.action, contactName: lastAssistantMessage?.contactName });
    
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
      return await handleContactUpdate(message, userId);
    }
    
    // Check if the user wants to send an email and go directly to email preview
    if (lowerMessage.includes('send') && lowerMessage.includes('email')) {
      // Extract contact name from the message
      const contactMatch = message.match(/(?:send|email)\s+(?:to\s+)?([a-z\s]+)/i) ||
                          message.match(/send.*email.*to\s+([^,\n]+)/i);
      
      if (contactMatch) {
        const contactName = contactMatch[1].trim();
        const matchingContact = contacts.find(contact => {
          const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
          return fullName.includes(contactName.toLowerCase()) || 
                 contactName.toLowerCase().includes(fullName);
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
    
    // If filtering returns too many results or ambiguous results, ask for clarification
    if (filteredRecords.length > 3) {
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
    console.log('📊 Starting chart generation for user:', userId);
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
      console.log('📊 Analyzing uploaded file data for chart generation');
      return await generateChartFromFileData(userMessage, sessionFiles);
    }
    
    // Analyze CRM data (either no files or user wants CRM data specifically)
    console.log('📊 Analyzing CRM data for chart generation');
    
    // Get user's team and data
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const teamId = teams.length > 0 ? teams[0]._id : 'default';
    let chartData: Array<{ stage?: string; status?: string; industry?: string; count: number; name: string }> = [];
    let chartType = 'bar';
    let title = 'Chart';
    
    if ((lowerMessage.includes('deal') && lowerMessage.includes('stage')) || 
        (lowerMessage.includes('deal') && (lowerMessage.includes('pipeline') || lowerMessage.includes('progress')))) {
      // Deals by stage chart
      console.log('📊 Generating deals by stage chart');
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
      chartType = 'bar';
      
    } else if (lowerMessage.includes('contact')) {
      // Contacts chart
      console.log('📊 Generating contacts chart');
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
      chartType = 'pie';
      
    } else if (lowerMessage.includes('account')) {
      // Accounts chart
      console.log('📊 Generating accounts chart');
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
      chartType = 'pie';
      
    } else {
      // Ask for clarification when chart type is unclear
      console.log('📊 Chart request unclear, asking for clarification');
      
      return {
        message: "I'd be happy to create a chart for you! To provide the most relevant visualization, could you please specify what type of data you'd like to see? For example:\n\n• **Deals by stage** - Shows your sales pipeline\n• **Contacts by status** - Shows lead progression\n• **Accounts by industry** - Shows customer distribution\n\nOr feel free to describe any other data you'd like visualized from your CRM.",
        needsClarification: true,
        action: 'chart_clarification'
      };
    }
    
    console.log('📊 Chart data generated:', { chartData, chartType, title });
    
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
    
    // Create chart specification with proper chartConfig
    const chartSpec = {
      chartType,
      data: chartData,
      title,
      chartConfig: {
        width: 600,
        height: 400,
        margin: { top: 20, right: 30, left: 20, bottom: 60 },
        xAxis: { dataKey: xAxisDataKey },
        yAxis: { dataKey: 'count' }
      }
    };
    
    return {
      message: `I've generated a ${title.toLowerCase()} chart for you.`,
      chartSpec
    };
    
  } catch (error) {
    console.error('❌ Chart generation error:', error);
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