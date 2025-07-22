import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

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

Available object types:
${Object.entries(CRM_OBJECTS).map(([key, obj]) => 
  `- ${key}: ${obj.description}\n  Fields: ${Object.entries(obj.fields).map(([field, type]) => `${field} (${type})`).join(', ')}`
).join('\n')}

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
  try {
    const body = await req.json();
    console.log("Chat API received:", JSON.stringify(body, null, 2));
    
    const { messages, userId, teamId } = body;

    if (!userId || !teamId) {
      console.log("Missing userId or teamId:", { userId, teamId });
      return NextResponse.json(
        { error: "User ID and Team ID are required" },
        { status: 400 }
      );
    }

    // Call OpenAI to understand the intent
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: CRM_SYSTEM_PROMPT },
        ...messages.map((msg: Message) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      temperature: 0.1,
    });

    const aiResponse = completion.choices[0]?.message?.content || "";
    
    // Try to parse JSON from the response
    let parsedResponse;
    try {
      // Extract JSON from markdown if present
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiResponse;
      parsedResponse = JSON.parse(jsonString);
    } catch (error) {
      // If JSON parsing fails, create a simple response
      parsedResponse = {
        action: "message",
        message: aiResponse,
        needsClarification: false,
      };
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
        responseMessage = await handleCreate(parsedResponse, userId, teamId);
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
        responseMessage = await handleDelete(parsedResponse);
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
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handler functions for different actions
async function handleCreate(response: CRMActionRequest, userId: string, teamId: string) {
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

  try {
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
        return `✅ Contact created successfully! ID: ${contactId}`;
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
        return `✅ Account created successfully! ID: ${accountId}`;
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
        const activityId = await convex.mutation(api.crm.createActivity, activityData as Doc<'activities'>);
        return `✅ Activity created successfully! ID: ${activityId}`;
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
        return `✅ Deal created successfully! ID: ${dealId}`;
      }
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
  } catch (error) {
    console.error("Create error:", error);
    return `❌ Error creating ${objectType}: ${error}`;
  }
}

async function handleRead(response: CRMActionRequest, teamId: string) {
  const { objectType, filters } = response;
  
  try {
    let data;
    switch (objectType) {
      case "contacts":
        data = await convex.query(api.crm.getContactsByTeam, { teamId });
        break;
      case "accounts":
        data = await convex.query(api.crm.getAccountsByTeam, { teamId });
        break;
      case "activities":
        data = await convex.query(api.crm.getActivitiesByTeam, { teamId });
        break;
      case "deals":
        data = await convex.query(api.crm.getDealsByTeam, { teamId });
        break;
      default:
        return { message: `❌ Unknown object type: ${objectType}` };
    }

    if (data.length === 0) {
      return { message: `📭 No ${objectType} found.` };
    }

    return {
      message: `📊 Found ${data.length} ${objectType}:`,
      data: data
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
          const { firstName, lastName, ...updateFields } = data;
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
            return `❌ Contact ID or name is required for update`;
          }
        }

        // Only assign contactId if it is a non-empty string and not undefined
        if (typeof contactId === 'string' && contactId !== '' && contactId !== undefined) {
          await convex.mutation(api.crm.updateContact, {
            contactId: contactId as Id<'contacts'>,
            updates: contactUpdates,
          });
        } else {
          return `❌ Invalid contact ID`;
        }
        break;
      case "accounts": {
        const accountId = id;
        if (typeof accountId === 'string' && accountId !== '' && accountId !== undefined) {
          await convex.mutation(api.crm.updateAccount, {
            accountId: accountId as Id<'accounts'>,
            updates,
          });
        } else {
          return `❌ Invalid account ID`;
        }
        break;
      }
      case "activities": {
        const activityId = id;
        if (typeof activityId === 'string' && activityId !== '' && activityId !== undefined) {
          await convex.mutation(api.crm.updateActivity, {
            activityId: activityId as Id<'activities'>,
            updates,
          });
        } else {
          return `❌ Invalid activity ID`;
        }
        break;
      }
      case "deals": {
        const dealId = id;
        if (typeof dealId === 'string' && dealId !== '' && dealId !== undefined) {
          await convex.mutation(api.crm.updateDeal, {
            dealId: dealId as Id<'deals'>,
            updates,
          });
        } else {
          return `❌ Invalid deal ID`;
        }
        break;
      }
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
    
    return `✅ ${objectType} updated successfully!`;
  } catch (error) {
    console.error("Update error:", error);
    return `❌ Error updating ${objectType}: ${error}`;
  }
}

async function handleDelete(response: CRMActionRequest) {
  const { objectType, id } = response;
  
  try {
    switch (objectType) {
      case "contacts": {
        if (typeof id === 'string' && id !== '' && id !== undefined) {
          await convex.mutation(api.crm.deleteContact, { contactId: id as Id<'contacts'> });
        } else {
          return `❌ Invalid contact ID`;
        }
        break;
      }
      case "accounts": {
        if (typeof id === 'string' && id !== '' && id !== undefined) {
          await convex.mutation(api.crm.deleteAccount, { accountId: id as Id<'accounts'> });
        } else {
          return `❌ Invalid account ID`;
        }
        break;
      }
      case "activities": {
        if (typeof id === 'string' && id !== '' && id !== undefined) {
          await convex.mutation(api.crm.deleteActivity, { activityId: id as Id<'activities'> });
        } else {
          return `❌ Invalid activity ID`;
        }
        break;
      }
      case "deals": {
        if (typeof id === 'string' && id !== '' && id !== undefined) {
          await convex.mutation(api.crm.deleteDeal, { dealId: id as Id<'deals'> });
        } else {
          return `❌ Invalid deal ID`;
        }
        break;
      }
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
    
    return `✅ ${objectType} deleted successfully!`;
  } catch (error) {
    console.error("Delete error:", error);
    return `❌ Error deleting ${objectType}: ${error}`;
  }
}

async function handleAddField(response: CRMActionRequest, teamId: string) {
  const { objectType, fieldName, fieldType, fieldOptions } = response;
  
  try {
    if (
      typeof objectType === 'string' &&
      ["contacts", "accounts", "activities", "deals"].includes(objectType) &&
      typeof fieldName === 'string' &&
      typeof fieldType === 'string' &&
      ["number", "boolean", "text", "date", "dropdown"].includes(fieldType)
    ) {
      await convex.mutation(api.crm.addCustomField, {
        teamId,
        objectType: objectType as "contacts" | "accounts" | "activities" | "deals",
        fieldName,
        fieldType: fieldType as "number" | "boolean" | "text" | "date" | "dropdown",
        fieldOptions: Array.isArray(fieldOptions) ? fieldOptions as string[] : undefined,
      });
      return `✅ Custom field "${fieldName}" added to ${objectType}!`;
    } else {
      return `❌ Invalid custom field parameters`;
    }
  } catch (error) {
    console.error("Add field error:", error);
    return `❌ Error adding custom field: ${error}`;
  }
}

function formatAsTable(data: Record<string, unknown>[], objectType: string): string {
  if (data.length === 0) return "No data to display";
  
  // Get all unique keys from all objects
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key !== '_id' && key !== '_creationTime' && key !== 'teamId' && key !== 'createdBy' && key !== 'sharedWith') {
        allKeys.add(key);
      }
    });
  });
  
  const keys = Array.from(allKeys);
  
  // Create header
  let table = keys.join(' | ') + '\n';
  table += keys.map(() => '---').join(' | ') + '\n';
  
  // Add rows
  data.forEach(item => {
    const row = keys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
    table += row.join(' | ') + '\n';
  });
  
  return table;
} 