import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { aiContextService } from "@/lib/aiContext";
import { 
  handleApiError, 
  validateRequiredFields, 
  validateStringField,
  ValidationError 
} from "@/lib/errorHandler";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

console.log("Convex URL:", process.env.NEXT_PUBLIC_CONVEX_URL);

// CRM object types for the AI to understand
const CRM_OBJECTS = {
  contacts: {
    description: "People/leads in your CRM",
    fields: {
      firstName: "string",
      lastName: "string", 
      email: "string",
      phone: "string (optional)",
      title: "string (optional)",
      company: "string (optional)",
      accountId: "string (optional - links to account)",
      leadStatus: "new|contacted|qualified|unqualified",
      contactType: "lead|contact",
      source: "string (optional)",
      notes: "string (optional)",
      customFields: "object (optional)"
    }
  },
  accounts: {
    description: "Companies/organizations",
    fields: {
      name: "string",
      industry: "string (optional)",
      website: "string (optional)", 
      phone: "string (optional)",
      address: "object (optional)",
      annualRevenue: "number (optional)",
      employeeCount: "number (optional)",
      notes: "string (optional)",
      customFields: "object (optional)"
    }
  },
  activities: {
    description: "Emails, calls, meetings, events",
    fields: {
      type: "email|event|call|meeting",
      subject: "string",
      description: "string (optional)",
      contactId: "string (optional)",
      accountId: "string (optional)", 
      dealId: "string (optional)",
      status: "scheduled|completed|cancelled",
      startTime: "number (optional)",
      endTime: "number (optional)",
      attendees: "array (optional)",
      customFields: "object (optional)"
    }
  },
  deals: {
    description: "Sales opportunities",
    fields: {
      name: "string",
      contactId: "string (optional)",
      accountId: "string (optional)",
      stage: "prospecting|qualification|proposal|negotiation|closed_won|closed_lost",
      amount: "number (optional)",
      currency: "string (optional)",
      closeDate: "number (optional)",
      probability: "number (optional)",
      description: "string (optional)",
      customFields: "object (optional)"
    }
  }
};

// System prompt for CRM operations
const CRM_SYSTEM_PROMPT = `You are a CRM assistant that helps users manage their customer relationships through natural language. You can:

1. CREATE new records (contacts, accounts, activities, deals)
2. READ/VIEW existing records with filtering and search
3. UPDATE existing records
4. DELETE records
5. ADD custom fields to any object type
6. Handle general conversation and greetings
7. Handle ambiguous queries by asking follow-up questions
8. ANALYZE and answer questions about documents from Google Drive (CSV files, Excel spreadsheets, PDFs, Word documents)

IMPORTANT: You have access to processed documents from the user's Google Drive. When users ask about their documents, files, or data, you can analyze and provide insights from these documents. You can:
- Answer questions about document content
- Analyze data from CSV files and Excel spreadsheets
- Provide summaries of document information
- Help with data interpretation and insights

Available object types:
${Object.entries(CRM_OBJECTS).map(([key, obj]) => 
  `- ${key}: ${obj.description}\n  Fields: ${Object.entries(obj.fields).map(([field, type]) => `${field} (${type})`).join(', ')}`
).join('\n')}

IMPORTANT:
- When referencing a company or account in a request, use the 'company' or 'accountName' field with the company name (e.g., 'NBA'), unless you know the actual account ID. Only use 'accountId' if you have the real database ID.
- When referencing a contact, use 'contactName' (e.g., 'John Wall') or 'email' if you do not know the contact's ID. Only use 'contactId' if you have the real database ID.
- The backend will resolve names to IDs automatically. Do NOT put company names in the 'accountId' field or contact names in the 'contactId' field.
- For all read/view actions, always return the results as an array of objects in the "data" field. Do NOT format tables in the "message" field. The "message" field should only contain a summary or count, not a table.
- For range or date queries (e.g., "deals over $25k", "created this quarter"), use filter objects with operators like $gt, $gte, $lt, $lte. For example:
  { "amount": { "$gt": 25000 }, "createdAt": { "$gte": 1720000000000 } }

 - When the user specifies which fields/columns to display (e.g., "show only amount, close date, and name"), include a 'fields' array in the system action. For example:
   { "action": "read", "objectType": "deals", "fields": ["amount", "closeDate", "name"], "data": [...] }

SPECIAL INSTRUCTIONS FOR BLANK/EMPTY FIELD QUERIES:
- When the user asks for records where a field is blank, empty, or missing (e.g., "contacts with no email"), return a system action with a filter for that field set to an empty string ("") or null. For example:
  User: Show me all contacts with no email address.
  AI: { "action": "read", "objectType": "contacts", "data": { "email": "" } }
  Or: { "action": "read", "objectType": "contacts", "data": { "email": null } }
- If unsure whether a blank field is stored as "" or null, include both in the filter if possible.
- Always use the structured system action format for queries that can be mapped to backend filters.

SPECIAL INSTRUCTIONS FOR COUNT/SUMMARY QUERIES:
- When the user asks for a count, summary, or specific detail (e.g., "how many contacts do we have at the NBA"), include a human-readable answer in the "message" field (e.g., "You have 1 contact at the NBA.") in addition to any data returned.

SPECIAL INSTRUCTIONS FOR COMPANY FILTERS:
- When the user asks for contacts at a specific company (e.g., "contacts at the NBA" or "how many contacts do we have at the NBA"), include a filter for company name in the data field: { company: "NBA" }.
  Example:
  User: How many contacts do we have at the NBA?
  AI: { "action": "read", "objectType": "contacts", "data": { "company": "NBA" } }

SPECIAL INSTRUCTIONS FOR EMAIL REQUESTS:
- When the user asks to send an email to someone, you MUST:
  1. Extract the contact name from the request (e.g., "vigeash gobal" from "send email to vigeash gobal")
  2. Set the "contactName" field in the data to the extracted name
  3. Set the "type" field to "email"
  4. Generate an appropriate subject and content
  5. The backend will automatically resolve the contact name to find their email address
  6. If the contact doesn't exist, create them first with the email provided in the user's request
  Example:
  User: "send an email to vigeash gobal thanking him for his time"
  AI: { 
    "action": "create", 
    "objectType": "activities", 
    "data": {
      "type": "email",
      "contactName": "vigeash gobal",
      "subject": "Thank You for Your Time",
      "description": "Dear Vigeash Gobal,\n\nI would like to thank you for your time and look forward to future collaborations.\n\nBest Regards,\n[Your Name]"
    }
  }

       SPECIAL INSTRUCTIONS FOR DOCUMENT ANALYSIS:
       - When users ask about their documents, files, or data (e.g., "what files were processed", "analyze my data", "sum the invoices"), you MUST analyze the processed documents from their Google Drive
       - You have DIRECT ACCESS to document content including CSV data, Excel spreadsheets, and other processed files
       - Provide detailed analysis and insights based on the ACTUAL document content
       - For questions about processed files, explain what documents are available and their content
       - For data analysis requests, provide summaries, calculations, and insights from the document data
       - When users ask for comprehensive analysis (e.g., "sum all files", "analyze all documents"), you MUST analyze ALL the documents provided in the context
       - Do NOT ask for clarification when comprehensive document analysis is requested - instead, analyze all available documents and provide a complete summary
       - If you see multiple documents in the context, analyze each one and provide a comprehensive response covering all documents
       - NEVER say you cannot access files - you have direct access to the processed documents
       - When users ask about specific files (e.g., "breakdown the data in money.xlsx"), analyze the actual content of that file and provide detailed insights

When responding:
- For general conversation (greetings, questions about capabilities), use action "message"
- For CRM operations, use appropriate action (create, read, update, delete, add_field)
- Always return JSON with an "action" field and relevant data
- For ambiguous queries, ask follow-up questions
- For data display, format as tables when appropriate
- Support custom field operations
- Handle relationships between objects properly

Response format:
{
  "action": "message|create|read|update|delete|add_field|ask_clarification",
  "objectType": "contacts|accounts|activities|deals" (only for CRM operations),
  "data": {...} (only for CRM operations),
  "message": "Human readable message",
  "needsClarification": boolean,
  "clarificationQuestion": "string (if needed)"
}`;

// Define a type for CRM action requests
interface CRMActionRequest {
  objectType: string;
  id?: string;
  name?: { firstName?: string; lastName?: string };
  updates?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

// Add Message interface for typing
interface Message {
  role: string;
  content: string;
}

export async function POST(req: NextRequest) {
  let draftOnly = false;
  try {
    const body = await req.json();
    console.log("Chat API received:", JSON.stringify(body, null, 2));
    
    const { messages, userId, teamId } = body;

    // Support draftOnly flag for email preview
    if (body.draftOnly) {
      draftOnly = true;
    }

    // Validate required fields
    validateRequiredFields(body, ['userId', 'teamId', 'messages']);
    
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

    // Get document context for the user's query
    const lastUserMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : "";
    let documentContext = "";
    let hasRelevantDocuments = false;
    
    if (lastUserMessage) {
      try {
        // Determine how many documents to retrieve based on the query
        const lastUserMessageLower = lastUserMessage.toLowerCase();
        let maxResults = 3; // Default for specific queries
        
        // For comprehensive queries that need all documents, increase the limit
        if (
          lastUserMessageLower.includes("all") ||
          lastUserMessageLower.includes("sum") ||
          lastUserMessageLower.includes("total") ||
          lastUserMessageLower.includes("every") ||
          lastUserMessageLower.includes("each") ||
          lastUserMessageLower.includes("complete") ||
          lastUserMessageLower.includes("full") ||
          lastUserMessageLower.includes("entire") ||
          lastUserMessageLower.includes("everything") ||
          lastUserMessageLower.includes("processed") ||
          lastUserMessageLower.includes("files") ||
          lastUserMessageLower.includes("documents")
        ) {
          maxResults = 20; // Get many more documents for comprehensive queries
        }
        
        const contextResult = await aiContextService.createAIContext(
          lastUserMessage,
          teamId,
          maxResults
        );
        
        if (contextResult.hasRelevantDocuments) {
          documentContext = contextResult.context;
          hasRelevantDocuments = true;
          console.log(`📚 Found ${contextResult.totalDocuments} relevant documents for query (max: ${maxResults})`);
        }
      } catch (error) {
        console.error('❌ Error getting document context:', error);
      }
    }

    // Create enhanced system prompt with document context
    let enhancedSystemPrompt = CRM_SYSTEM_PROMPT;
    if (hasRelevantDocuments) {
      enhancedSystemPrompt += `\n\nDOCUMENT CONTEXT:\n${documentContext}\n\nCRITICAL: You MUST analyze the document context above and provide specific insights from the actual data. Do NOT say you cannot access files - you have direct access to the processed documents. When users ask about their files, analyze the content and provide detailed breakdowns, summaries, and insights from the actual data.`;
    }

    // Call OpenAI to understand the intent
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          ...messages.map((msg: Message) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ],
        temperature: 0.1,
      });
    } catch (error: unknown) {
      // If we hit token limit, try with reduced context
      if (error && typeof error === 'object' && 'code' in error && error.code === 'context_length_exceeded' && hasRelevantDocuments) {
        console.log('⚠️ Token limit exceeded, retrying with reduced context...');
        
        // Create a simplified context with just document names and types
        const simplifiedContext = 'Based on your question, here are the relevant documents from your knowledge base:\n\n' +
          documentContext.split('\n\n').slice(0, 3).join('\n\n') + // Take only first 3 documents
          '\n\n[Note: Document content was simplified due to length limits. Please ask for specific documents if you need detailed analysis.]';
        
        enhancedSystemPrompt = CRM_SYSTEM_PROMPT + `\n\nDOCUMENT CONTEXT:\n${simplifiedContext}\n\nCRITICAL: You MUST analyze the document context above and provide specific insights from the actual data. Do NOT say you cannot access files - you have direct access to the processed documents. When users ask about their files, analyze the content and provide detailed breakdowns, summaries, and insights from the actual data.`;
        
        completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: enhancedSystemPrompt },
            ...messages.map((msg: Message) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ],
          temperature: 0.1,
        });
      } else {
        throw error;
      }
    }

    const aiResponse = completion.choices[0]?.message?.content || "";
    
    // Try to parse JSON from the response
    let parsedResponse;
    try {
      // Extract JSON from markdown if present
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiResponse;
      parsedResponse = JSON.parse(jsonString);
    } catch {
      // If JSON parsing fails, create a simple response
      parsedResponse = {
        action: "message",
        message: aiResponse,
        needsClarification: false,
      };
    }

    // Define lastUserMessage for post-processing (reuse the one from above)
    const lastUserMessageLower = lastUserMessage.toLowerCase();

    // --- POST-PROCESSING FOR COMPANY FILTER QUERIES ---
    if (
      lastUserMessageLower &&
      lastUserMessageLower.includes("at the ") &&
      parsedResponse.action === "read" &&
      parsedResponse.objectType === "contacts" &&
      (!parsedResponse.data || !parsedResponse.data.company)
    ) {
      // Extract company name after 'at the '
      const match = lastUserMessageLower.match(/at the ([\w\s]+)/);
      if (match && match[1]) {
        const company = match[1].trim();
        parsedResponse.data = { ...(parsedResponse.data || {}), company };
      }
    }

    // --- POST-PROCESSING FOR BLANK EMAIL QUERIES ---
    if (
      lastUserMessageLower &&
      (lastUserMessageLower.includes("blank email") || lastUserMessageLower.includes("no email") || lastUserMessageLower.includes("empty email")) &&
      parsedResponse.action === "read" &&
      parsedResponse.objectType === "contacts" &&
      (!parsedResponse.data || !parsedResponse.data.email)
    ) {
      parsedResponse.data = { ...(parsedResponse.data || {}), email: "" };
    }

    // --- POST-PROCESSING FOR COUNT/SUMMARY QUERIES ---
    if (
      lastUserMessageLower &&
      (lastUserMessageLower.includes("how many") || lastUserMessageLower.includes("count") || lastUserMessageLower.includes("number of")) &&
      parsedResponse.action === "read" &&
      Array.isArray(parsedResponse.data) &&
      (!parsedResponse.message || parsedResponse.message.startsWith("📊 Found"))
    ) {
      const count = parsedResponse.data.length;
      let subject = "contacts";
      if (parsedResponse.objectType) subject = parsedResponse.objectType;
      // Try to extract filter context from the user message
      let context = "";
      const match = lastUserMessageLower.match(/at (the )?([\w\s]+)/);
      if (match && match[2]) context = ` at ${match[2].trim()}`;
      parsedResponse.message = `You have ${count} ${subject}${context}.`;
    }

    // --- POST-PROCESSING: Filter data by fields if present ---
    if (parsedResponse.fields && Array.isArray(parsedResponse.fields) && parsedResponse.data && Array.isArray(parsedResponse.data)) {
      const allowed = new Set(parsedResponse.fields);
      parsedResponse.data = parsedResponse.data.map((row: Record<string, unknown>) => {
        const filtered: Record<string, unknown> = {};
        for (const key of Object.keys(row)) {
          if (allowed.has(key)) filtered[key] = row[key];
        }
        return filtered;
      });
    }

    // Handle the parsed response
    let responseMessage = "";
    let needsClarification = false;
    let clarificationQuestion = "";
    let responseData = null;
    let responseAction = null;

    switch (parsedResponse.action) {
      case "message":
        responseMessage = parsedResponse.message;
        break;
      case "create":
        // If draftOnly, do NOT create the activity, just return the draft data
        console.log("🔍 Create case - draftOnly:", draftOnly, "objectType:", parsedResponse.objectType, "data:", parsedResponse.data);
        if (draftOnly && parsedResponse.data && (parsedResponse.objectType === "activities" || parsedResponse.objectType === undefined) && (parsedResponse.data.type === "email" || parsedResponse.data.type === undefined)) {
          console.log("✅ Email draft condition met, processing contact resolution");
          
          // For email drafts, we need to resolve the contact and get their email
          const emailData = { ...parsedResponse.data };
          if (parsedResponse.data.contactName && !parsedResponse.data.to && !parsedResponse.data.email) {
            // Try to resolve the contact name to get their email
            const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
            const contactName = String(parsedResponse.data.contactName);
            const nameParts = contactName.split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
            
            const foundContact = contacts.find((c) =>
              typeof c.firstName === 'string' && typeof c.lastName === 'string' &&
              c.firstName.toLowerCase() === firstName.toLowerCase() &&
              c.lastName.toLowerCase() === lastName.toLowerCase()
            );
            
            if (foundContact && typeof foundContact.email === 'string') {
              emailData.to = foundContact.email;
              emailData.contactId = foundContact._id;
              console.log(`✅ Found contact ${contactName} with email ${foundContact.email}`);
            } else {
              // Contact not found - try to create it if we have an email
              const emailMatch = lastUserMessage.toLowerCase().match(/email should be ([^\s]+@[^\s]+)/i);
              if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1];
                const nameParts = contactName.split(" ");
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
                
                // Create the contact
                const contactId = await convex.mutation(api.crm.createContact, {
                  teamId,
                  createdBy: userId,
                  firstName,
                  lastName,
                  email,
                  contactType: "contact",
                  leadStatus: "contacted"
                });
                
                emailData.to = email;
                emailData.contactId = contactId;
                console.log(`✅ Created contact ${contactName} with email ${email}`);
              }
            }
          }
          
          responseMessage = "✉️ Email draft ready. Review and send.";
          responseData = emailData;
          responseAction = "create";
          break;
        }
        const createResult = await handleCreate(parsedResponse, userId, teamId, lastUserMessage);
        responseMessage = createResult.message;
        responseData = createResult.data;
        responseAction = "create";
        break;
      case "read":
        const readResult = await handleRead(parsedResponse, teamId);
        responseMessage = readResult.message;
        responseData = readResult.data;
        responseAction = "read";
        break;
      case "update":
        responseMessage = await handleUpdate(parsedResponse, userId, teamId);
        break;
      case "delete":
        responseMessage = await handleDelete(parsedResponse, teamId);
        break;
      case "add_field":
        responseMessage = await handleAddField(parsedResponse, teamId);
        break;
      case "ask_clarification":
        needsClarification = true;
        clarificationQuestion = parsedResponse.clarificationQuestion;
        responseMessage = parsedResponse.message;
        break;
      default:
        responseMessage = aiResponse;
    }

    // Log the interaction (commented out for debugging)
    // await convex.mutation(api.crm.createLog, {
    //   teamId,
    //   createdBy: userId,
    //   message: lastUserMessage,
    //   role: "user",
    // });

    // await convex.mutation(api.crm.createLog, {
    //   teamId,
    //   createdBy: userId,
    //   message: responseMessage,
    //   role: "assistant",
    //   metadata: {
    //     action: parsedResponse.action,
    //     objectType: parsedResponse.objectType,
    //   },
    // });

    return NextResponse.json({
      message: responseMessage,
      needsClarification,
      clarificationQuestion,
      action: responseAction || parsedResponse.action,
      data: responseData || parsedResponse.data,
      ...(parsedResponse.fields ? { fields: parsedResponse.fields } : {}),
      documentContext: hasRelevantDocuments ? {
        hasRelevantDocuments: true,
        totalDocuments: documentContext.split('\n\n').length - 1, // Rough count
      } : {
        hasRelevantDocuments: false,
        totalDocuments: 0,
      },
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// Handler functions for different actions
async function handleCreate(response: CRMActionRequest, userId: string, teamId: string, originalMessage?: string) {
  const { objectType, data } = response;
  
  // Allowed literals for union types
  const contactTypes = ["lead", "contact"];
  const leadStatuses = ["new", "contacted", "qualified", "unqualified"];
  const activityTypes = ["email", "event", "call", "meeting"];
  const activityStatuses = ["scheduled", "completed", "cancelled"];
  const dealStages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];

  function isCustomFieldsRecord(obj: unknown): obj is Record<string, string | number | boolean | null> {
    if (typeof obj !== "object" || obj === null) return false;
    return Object.values(obj).every(
      v => ["string", "number", "boolean"].includes(typeof v) || v === null
    );
  }

  // --- ID Resolution Logic ---
  // Helper to check if a string is a valid Convex ID (24 chars, alphanumeric)
  function isValidId(id: string) {
    return typeof id === 'string' && /^[a-zA-Z0-9]{24}$/.test(id);
  }

  // Resolve accountId if it's a name
  async function resolveAccountId(accountIdOrName: string): Promise<string | undefined> {
    if (!accountIdOrName || isValidId(accountIdOrName)) return accountIdOrName;
    const accounts: Array<{ [key: string]: unknown }> = await convex.query(api.crm.getAccountsByTeam, { teamId });
    const found = accounts.find((a) =>
      typeof a.name === 'string' && a.name.toLowerCase() === accountIdOrName.toLowerCase()
    );
    return found && typeof found._id === 'string' ? found._id : undefined;
  }

  // Resolve contactId if it's a name ("First Last")
  async function resolveContactId(contactIdOrName: string): Promise<string | undefined> {
    if (!contactIdOrName || isValidId(contactIdOrName)) return contactIdOrName;
    const contacts: Array<{ [key: string]: unknown }> = await convex.query(api.crm.getContactsByTeam, { teamId });
    // Try to match "First Last" or just email
    const [firstName, ...rest] = contactIdOrName.split(" ");
    const lastName = rest.join(" ");
    let found = contacts.find((c) =>
      typeof c.firstName === 'string' && typeof c.lastName === 'string' &&
      c.firstName.toLowerCase() === firstName.toLowerCase() &&
      c.lastName.toLowerCase() === lastName.toLowerCase()
    );
    if (!found) {
      found = contacts.find((c) =>
        typeof c.email === 'string' && c.email.toLowerCase() === contactIdOrName.toLowerCase()
      );
    }
    return found && typeof found._id === 'string' ? found._id : undefined;
  }

  try {
    // --- Preprocess data for all object types ---
    if (data) {
      if (typeof data.accountId === 'string') {
        const resolvedAccountId = await resolveAccountId(data.accountId);
        if (data.accountId && !resolvedAccountId) {
          return { message: `❌ Account not found: ${data.accountId}`, data: null };
        }
        data.accountId = resolvedAccountId;
      }
      if (typeof data.contactId === 'string') {
        const resolvedContactId = await resolveContactId(data.contactId);
        if (data.contactId && !resolvedContactId) {
          return { message: `❌ Contact not found: ${data.contactId}`, data: null };
        }
        data.contactId = resolvedContactId;
      }
    }
    switch (objectType) {
      case "contacts": {
        const contactData: Partial<Doc<'contacts'>> = {
          teamId,
          createdBy: userId,
          firstName: typeof data?.firstName === "string" ? data.firstName : "",
          lastName: typeof data?.lastName === "string" ? data.lastName : "",
          email: typeof data?.email === "string" ? data.email : "",
          contactType: (data && contactTypes.includes(String(data.contactType))) ? data.contactType as "lead" | "contact" : "contact",
          leadStatus: (data && leadStatuses.includes(String(data.leadStatus))) ? data.leadStatus as "new" | "contacted" | "qualified" | "unqualified" : "new",
        };
        if (typeof data?.phone === "string") contactData.phone = data.phone;
        if (typeof data?.title === "string") contactData.title = data.title;
        if (typeof data?.company === "string") contactData.company = data.company;
        if (typeof data?.accountId === "string" && data.accountId !== "" && data.accountId !== undefined) contactData.accountId = data.accountId as Id<'accounts'>;
        if (typeof data?.source === "string") contactData.source = data.source;
        if (typeof data?.notes === "string") contactData.notes = data.notes;
        if (isCustomFieldsRecord(data?.customFields)) contactData.customFields = data.customFields;
        const contactId = await convex.mutation(api.crm.createContact, contactData as Doc<'contacts'>);
        return { message: `✅ Contact created successfully! ID: ${contactId}`, data: null };
      }
      case "accounts": {
        const accountData: Partial<Doc<'accounts'>> = {
          teamId,
          createdBy: userId,
          name: typeof data?.name === "string" ? data.name : "",
        };
        if (typeof data?.phone === "string") accountData.phone = data.phone;
        if (typeof data?.notes === "string") accountData.notes = data.notes;
        if (isCustomFieldsRecord(data?.customFields)) accountData.customFields = data.customFields;
        if (typeof data?.industry === "string") accountData.industry = data.industry;
        if (typeof data?.website === "string") accountData.website = data.website;
        if (typeof data?.address === "object" && data.address !== null) accountData.address = data.address;
        if (typeof data?.annualRevenue === "number") accountData.annualRevenue = data.annualRevenue;
        if (typeof data?.employeeCount === "number") accountData.employeeCount = data.employeeCount;
        const accountId = await convex.mutation(api.crm.createAccount, accountData as Doc<'accounts'>);
        return { message: `✅ Account created successfully! ID: ${accountId}`, data: null };
      }
      case "activities": {
        const activityData: Partial<Doc<'activities'>> = {
          teamId,
          createdBy: userId,
          subject: typeof data?.subject === "string" ? data.subject : "",
          type: (data && activityTypes.includes(String(data.type))) ? data.type as "email" | "event" | "call" | "meeting" : "meeting",
          status: (data && activityStatuses.includes(String(data.status))) ? data.status as "scheduled" | "completed" | "cancelled" : "scheduled",
        };
        if (typeof data?.accountId === "string" && data.accountId !== "" && data.accountId !== undefined) activityData.accountId = data.accountId as Id<'accounts'>;
        if (isCustomFieldsRecord(data?.customFields)) activityData.customFields = data.customFields;
        if (typeof data?.description === "string") activityData.description = data.description;
        if (typeof data?.contactId === "string" && data.contactId !== "" && data.contactId !== undefined) activityData.contactId = data.contactId as Id<'contacts'>;
        if (typeof data?.dealId === "string" && data.dealId !== "" && data.dealId !== undefined) activityData.dealId = data.dealId as Id<'deals'>;
        if (typeof data?.startTime === "number") activityData.startTime = data.startTime;
        if (typeof data?.endTime === "number") activityData.endTime = data.endTime;
        if (Array.isArray(data?.attendees)) activityData.attendees = data.attendees;
        // If this is an email, return both the message and the data for preview
        if (activityData.type === "email") {
          // For email activities, we need to resolve the contact and get their email
          const emailData = { ...(data || {}) };
          if (data && data.contactName && !data.to && !data.email) {
            // Try to resolve the contact name to get their email
            const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
            const contactName = String(data.contactName);
            const nameParts = contactName.split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
            
            const foundContact = contacts.find((c) =>
              typeof c.firstName === 'string' && typeof c.lastName === 'string' &&
              c.firstName.toLowerCase() === firstName.toLowerCase() &&
              c.lastName.toLowerCase() === lastName.toLowerCase()
            );
            
            if (foundContact && typeof foundContact.email === 'string') {
              emailData.to = foundContact.email;
              emailData.contactId = foundContact._id;
            } else {
              // Contact not found - try to create it if we have an email
              const emailMatch = originalMessage?.toLowerCase().match(/email should be ([^\s]+@[^\s]+)/i);
              if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1];
                const nameParts = contactName.split(" ");
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
                
                // Create the contact
                const contactId = await convex.mutation(api.crm.createContact, {
                  teamId,
                  createdBy: userId,
                  firstName,
                  lastName,
                  email,
                  contactType: "contact",
                  leadStatus: "contacted"
                });
                
                emailData.to = email;
                emailData.contactId = contactId;
                console.log(`✅ Created contact ${contactName} with email ${email}`);
              }
            }
          }
          
          return {
            message: `✅ Activity created successfully! ID: ${await convex.mutation(api.crm.createActivity, activityData as Doc<'activities'>)}`,
            data: emailData,
            action: "create",
            objectType: "activities"
          };
        }
        const activityId = await convex.mutation(api.crm.createActivity, activityData as Doc<'activities'>);
        return { message: `✅ Activity created successfully! ID: ${activityId}`, data: null };
      }
      case "deals": {
        const dealData: Partial<Doc<'deals'>> = {
          teamId,
          createdBy: userId,
          name: typeof data?.name === "string" ? data.name : "",
          stage: (data && dealStages.includes(String(data.stage)))
            ? (data.stage as "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost")
            : "prospecting",
        };
        if (typeof data?.accountId === "string" && data.accountId !== "" && data.accountId !== undefined) dealData.accountId = data.accountId as Id<'accounts'>;
        if (isCustomFieldsRecord(data?.customFields)) dealData.customFields = data.customFields;
        if (typeof data?.description === "string") dealData.description = data.description;
        if (typeof data?.contactId === "string" && data.contactId !== "" && data.contactId !== undefined) dealData.contactId = data.contactId as Id<'contacts'>;
        if (typeof data?.amount === "number") dealData.amount = data.amount;
        if (typeof data?.currency === "string") dealData.currency = data.currency;
        if (typeof data?.closeDate === "number") dealData.closeDate = data.closeDate;
        if (typeof data?.probability === "number") dealData.probability = data.probability;
        const dealId = await convex.mutation(api.crm.createDeal, dealData as Doc<'deals'>);
        return { message: `✅ Deal created successfully! ID: ${dealId}`, data: null };
      }
      default:
        return { message: `❌ Unknown object type: ${objectType}`, data: null };
    }
  } catch (error) {
    console.error("Create error:", error);
    return { message: `❌ Error creating ${objectType}: ${error}`, data: null };
  }
}

async function handleRead(response: CRMActionRequest, teamId: string) {
  const { objectType, data } = response;
  try {
    let records: unknown[];
    switch (objectType) {
      case "contacts":
        records = await convex.query(api.crm.getContactsByTeam, { teamId });
        break;
      case "accounts":
        records = await convex.query(api.crm.getAccountsByTeam, { teamId });
        break;
      case "activities":
        records = await convex.query(api.crm.getActivitiesByTeam, { teamId });
        break;
      case "deals":
        records = await convex.query(api.crm.getDealsByTeam, { teamId });
        break;
      default:
        return { message: `❌ Unknown object type: ${objectType}` };
    }

    // Enhanced filter logic: support $gt, $gte, $lt, $lte
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        if (value && typeof value === 'object' && ("$gt" in value || "$gte" in value || "$lt" in value || "$lte" in value)) {
          const filterValue = value as Record<string, unknown>;
          if ("$gt" in value) {
            records = records.filter((c) => {
              const record = c as Record<string, unknown>;
              return typeof record[key] === 'number' && record[key] > (filterValue["$gt"] as number);
            });
          }
          if ("$gte" in value) {
            records = records.filter((c) => {
              const record = c as Record<string, unknown>;
              return typeof record[key] === 'number' && record[key] >= (filterValue["$gte"] as number);
            });
          }
          if ("$lt" in value) {
            records = records.filter((c) => {
              const record = c as Record<string, unknown>;
              return typeof record[key] === 'number' && record[key] < (filterValue["$lt"] as number);
            });
          }
          if ("$lte" in value) {
            records = records.filter((c) => {
              const record = c as Record<string, unknown>;
              return typeof record[key] === 'number' && record[key] <= (filterValue["$lte"] as number);
            });
          }
        } else if (value === "" || value === null) {
          records = records.filter((c) => {
            const record = c as Record<string, unknown>;
            return !record[key] || record[key] === "";
          });
        } else {
          records = records.filter((c) => {
            const record = c as Record<string, unknown>;
            return record[key] === value;
          });
        }
      });
    }

    if (!records || records.length === 0) {
      return { message: `📭 No ${objectType} found.` };
    }

    // Always return an array for data
    if (!Array.isArray(records)) {
      records = [records];
    }

    return {
      message: `📊 Found ${records.length} ${objectType}:`,
      data: records
    };
  } catch (error) {
    console.error("Read error:", error);
    return { message: `❌ Error reading ${objectType}: ${error}` };
  }
}

async function handleUpdate(response: CRMActionRequest, userId: string, teamId: string) {
  const { objectType, id, name, updates, data } = response;
  
  console.log("Update request:", { objectType, id, name, updates, data });
  
  try {
    switch (objectType) {
      case "contacts":
        let contactId = id;
        let contactName = name;
        let contactUpdates = updates;
        
        // Handle the new data structure with filter and update
        if (data && data.filter && data.update && typeof data.update === 'object' && data.update !== null) {
          contactName = data.filter;
          contactUpdates = data.update as Record<string, unknown>;
        }
        // Handle the case where AI puts everything in data field
        else if (
          data &&
          typeof data.firstName === 'string' &&
          typeof data.lastName === 'string'
        ) {
          contactName = {
            firstName: data.firstName,
            lastName: data.lastName
          };
          // Extract updates from data (remove name fields)
          const { firstName: _, lastName: __, ...updateFields } = data;
          contactUpdates = updateFields;
        } else if (data && data.contactName) {
          // Handle contactName as a string (e.g., "vigeash gobal")
          const contactNameStr = String(data.contactName);
          const nameParts = contactNameStr.split(" ");
          contactName = {
            firstName: nameParts[0],
            lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""
          };
          // Extract updates from data (remove contactName field)
          const { contactName: _, ...updateFields } = data;
          contactUpdates = updateFields;
        } else if (data) {
          return '❌ Invalid contact name for update';
        }
        
        // If no ID provided but name is provided, try to find the contact
        if (!contactId && contactName && typeof contactName.firstName === 'string' && typeof contactName.lastName === 'string') {
          const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
          const contact = contacts.find(c =>
            c.firstName?.toLowerCase() === String(contactName.firstName).toLowerCase() &&
            c.lastName?.toLowerCase() === String(contactName.lastName).toLowerCase()
          );
          if (contact) {
            contactId = contact._id;
          } else {
            return `❌ Contact not found: ${String(contactName.firstName)} ${String(contactName.lastName)}`;
          }
        }

        // Check if we have a valid contactId (either provided or found)
        if (!contactId || contactId === "1") {
          // If contactId is "1", it's likely a placeholder, try to find by name
          if (contactName && typeof contactName.firstName === 'string' && typeof contactName.lastName === 'string') {
            const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
            const contact = contacts.find(c =>
              c.firstName?.toLowerCase() === String(contactName.firstName).toLowerCase() &&
              c.lastName?.toLowerCase() === String(contactName.lastName).toLowerCase()
            );
            if (contact) {
              contactId = contact._id;
            } else {
              return `❌ Contact not found: ${String(contactName.firstName)} ${String(contactName.lastName)}`;
            }
          } else {
            return `❌ Unknown object type: ${objectType}`;
          }
        }

        // Update the contact
        await convex.mutation(api.crm.updateContact, {
          contactId: contactId as string & { __tableName: "contacts" },
          updates: contactUpdates,
        });
        return `✅ Contact updated successfully.`;
      case "accounts":
        let accountId = id;
        
        // If no ID provided, try to find the account by name
        if (!accountId && data) {
          const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
          
          // Filter accounts based on data criteria
          let matches = accounts;
          
          if (data.name) {
            matches = matches.filter(a =>
              typeof a.name === 'string' &&
              a.name.toLowerCase() === String(data.name).toLowerCase()
            );
          }
          
          if (matches.length === 1) {
            accountId = matches[0]._id;
            console.log(`✅ Found account to update: ${matches[0].name}`);
          } else if (matches.length > 1) {
            return `❌ Multiple accounts found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No account found matching your criteria.`;
          }
        }
        
        if (!accountId) {
          return `❌ No account ID provided and no matching account found.`;
        }
        
        // Update the account
        await convex.mutation(api.crm.updateAccount, {
          accountId: accountId as string & { __tableName: "accounts" },
          updates: contactUpdates,
        });
        return `✅ Account updated successfully.`;
      case "activities":
        let activityId = id;
        
        // If no ID provided, try to find the activity by subject
        if (!activityId && data) {
          const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
          
          // Filter activities based on data criteria
          let matches = activities;
          
          if (data.subject) {
            matches = matches.filter(a =>
              typeof a.subject === 'string' &&
              a.subject.toLowerCase().includes(String(data.subject).toLowerCase())
            );
          }
          
          if (matches.length === 1) {
            activityId = matches[0]._id;
            console.log(`✅ Found activity to update: ${matches[0].subject}`);
          } else if (matches.length > 1) {
            return `❌ Multiple activities found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No activity found matching your criteria.`;
          }
        }
        
        if (!activityId) {
          return `❌ No activity ID provided and no matching activity found.`;
        }
        
        // Update the activity
        await convex.mutation(api.crm.updateActivity, {
          activityId: activityId as string & { __tableName: "activities" },
          updates: contactUpdates,
        });
        return `✅ Activity updated successfully.`;
      case "deals":
        let dealId = id;
        
        // If no ID provided, try to find the deal by name
        if (!dealId && data) {
          const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
          
          // Filter deals based on data criteria
          let matches = deals;
          
          if (data.name) {
            matches = matches.filter(d =>
              typeof d.name === 'string' &&
              d.name.toLowerCase().includes(String(data.name).toLowerCase())
            );
          }
          
          if (matches.length === 1) {
            dealId = matches[0]._id;
            console.log(`✅ Found deal to update: ${matches[0].name}`);
          } else if (matches.length > 1) {
            return `❌ Multiple deals found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No deal found matching your criteria.`;
          }
        }
        
        if (!dealId) {
          return `❌ No deal ID provided and no matching deal found.`;
        }
        
        // Update the deal
        await convex.mutation(api.crm.updateDeal, {
          dealId: dealId as string & { __tableName: "deals" },
          updates: contactUpdates,
        });
        return `✅ Deal updated successfully.`;
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
      } catch (error) {
      console.error("Update error:", error);
      return `❌ Error updating ${objectType}: ${error}`;
    }
}

async function handleDelete(response: CRMActionRequest, teamId: string) {
  const { objectType, id, data } = response;
  
  console.log("Delete request:", { objectType, id, data, teamId });
  
  try {
    switch (objectType) {
      case "contacts":
        let contactId = id;
        
        // If no ID provided, try to find the contact by name or filter
        if (!contactId && data) {
          const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
          
          // Filter contacts based on data criteria
          let matches = contacts;
          
          if (data.firstName && data.lastName) {
            matches = matches.filter(c =>
              typeof c.firstName === 'string' && typeof c.lastName === 'string' &&
              c.firstName.toLowerCase() === String(data.firstName).toLowerCase() &&
              c.lastName.toLowerCase() === String(data.lastName).toLowerCase()
            );
          }
          
          // Filter by email if specified
          if (data.email === "" || data.email === null) {
            matches = matches.filter(c => !c.email || c.email === "");
          }
          
          if (matches.length === 1) {
            contactId = matches[0]._id;
            console.log(`✅ Found contact to delete: ${matches[0].firstName} ${matches[0].lastName} (${matches[0].email || 'no email'})`);
          } else if (matches.length > 1) {
            return `❌ Multiple contacts found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No contact found matching your criteria.`;
          }
        }
        
        if (!contactId) {
          return `❌ No contact ID provided and no matching contact found.`;
        }
        
        await convex.mutation(api.crm.deleteContact, {
          contactId: contactId as string & { __tableName: "contacts" },
        });
        return `✅ Contact deleted successfully.`;
      case "accounts":
        let accountId = id;
        
        // If no ID provided, try to find the account by name
        if (!accountId && data) {
          const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
          
          // Filter accounts based on data criteria
          let matches = accounts;
          
          if (data.name) {
            matches = matches.filter(a =>
              typeof a.name === 'string' &&
              a.name.toLowerCase() === String(data.name).toLowerCase()
            );
          }
          
          if (matches.length === 1) {
            accountId = matches[0]._id;
            console.log(`✅ Found account to delete: ${matches[0].name}`);
          } else if (matches.length > 1) {
            return `❌ Multiple accounts found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No account found matching your criteria.`;
          }
        }
        
        if (!accountId) {
          return `❌ No account ID provided and no matching account found.`;
        }
        
        await convex.mutation(api.crm.deleteAccount, {
          accountId: accountId as string & { __tableName: "accounts" },
        });
        return `✅ Account deleted successfully.`;
      case "activities":
        let activityId = id;
        
        // If no ID provided, try to find the activity by subject
        if (!activityId && data) {
          const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });
          
          // Filter activities based on data criteria
          let matches = activities;
          
          if (data.subject) {
            matches = matches.filter(a =>
              typeof a.subject === 'string' &&
              a.subject.toLowerCase().includes(String(data.subject).toLowerCase())
            );
          }
          
          if (matches.length === 1) {
            activityId = matches[0]._id;
            console.log(`✅ Found activity to delete: ${matches[0].subject}`);
          } else if (matches.length > 1) {
            return `❌ Multiple activities found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No activity found matching your criteria.`;
          }
        }
        
        if (!activityId) {
          return `❌ No activity ID provided and no matching activity found.`;
        }
        
        await convex.mutation(api.crm.deleteActivity, {
          activityId: activityId as string & { __tableName: "activities" },
        });
        return `✅ Activity deleted successfully.`;
      case "deals":
        let dealId = id;
        
        // If no ID provided, try to find the deal by name
        if (!dealId && data) {
          const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
          
          // Filter deals based on data criteria
          let matches = deals;
          
          if (data.name) {
            matches = matches.filter(d =>
              typeof d.name === 'string' &&
              d.name.toLowerCase().includes(String(data.name).toLowerCase())
            );
          }
          
          if (matches.length === 1) {
            dealId = matches[0]._id;
            console.log(`✅ Found deal to delete: ${matches[0].name}`);
          } else if (matches.length > 1) {
            return `❌ Multiple deals found matching your criteria. Please be more specific.`;
          } else {
            return `❌ No deal found matching your criteria.`;
          }
        }
        
        if (!dealId) {
          return `❌ No deal ID provided and no matching deal found.`;
        }
        
        await convex.mutation(api.crm.deleteDeal, {
          dealId: dealId as string & { __tableName: "deals" },
        });
        return `✅ Deal deleted successfully.`;
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
      } catch (error) {
      console.error("Delete error:", error);
      return `❌ Error deleting ${objectType}: ${error}`;
    }
}

async function handleAddField(response: CRMActionRequest, teamId: string) {
  const { objectType, id, name, field, value } = response;
  
  console.log("Add field request:", { objectType, id, name, field, value });
  
  try {
    switch (objectType) {
      case "contacts":
        // Note: Using addAccountField as a workaround since addContactField doesn't exist
        const addFieldResult = await convex.mutation(api.crm.addAccountField, {
          teamId,
          accountId: id as string & { __tableName: "accounts" },
          fieldName: field as string,
          fieldValue: value,
        });
        return addFieldResult.message;
      case "accounts":
        const addAccountFieldResult = await convex.mutation(api.crm.addAccountField, {
          teamId,
          accountId: id as string & { __tableName: "accounts" },
          fieldName: field as string,
          fieldValue: value,
        });
        return addAccountFieldResult.message;
      case "activities":
        const addActivityFieldResult = await convex.mutation(api.crm.addActivityField, {
          teamId,
          activityId: id as string & { __tableName: "activities" },
          fieldName: field as string,
          fieldValue: value,
        });
        return addActivityFieldResult.message;
      case "deals":
        const addDealFieldResult = await convex.mutation(api.crm.addDealField, {
          teamId,
          dealId: id as string & { __tableName: "deals" },
          fieldName: field as string,
          fieldValue: value,
        });
        return addDealFieldResult.message;
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
  } catch (error) {
    console.error("Add field error:", error);
    return `❌ Error adding field to ${objectType}: ${error}`;
  }
}