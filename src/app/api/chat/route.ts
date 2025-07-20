import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

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

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Call OpenAI to understand the intent
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: CRM_SYSTEM_PROMPT },
        ...messages.map((msg: any) => ({
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

    switch (parsedResponse.action) {
      case "message":
        responseMessage = parsedResponse.message;
        break;
      case "create":
        responseMessage = await handleCreate(parsedResponse, userId, teamId);
        break;
      case "read":
        responseMessage = await handleRead(parsedResponse, teamId);
        break;
      case "update":
        responseMessage = await handleUpdate(parsedResponse, userId);
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
      action: parsedResponse.action,
      data: parsedResponse.data,
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
async function handleCreate(response: any, userId: string, teamId: string) {
  const { objectType, data } = response;
  
  try {
    switch (objectType) {
      case "contacts":
        const contactId = await convex.mutation(api.crm.createContact, {
          teamId,
          createdBy: userId,
          ...data,
        });
        return `✅ Contact created successfully! ID: ${contactId}`;
      
      case "accounts":
        const accountId = await convex.mutation(api.crm.createAccount, {
          teamId,
          createdBy: userId,
          ...data,
        });
        return `✅ Account created successfully! ID: ${accountId}`;
      
      case "activities":
        const activityId = await convex.mutation(api.crm.createActivity, {
          teamId,
          createdBy: userId,
          ...data,
        });
        return `✅ Activity created successfully! ID: ${activityId}`;
      
      case "deals":
        const dealId = await convex.mutation(api.crm.createDeal, {
          teamId,
          createdBy: userId,
          ...data,
        });
        return `✅ Deal created successfully! ID: ${dealId}`;
      
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
  } catch (error) {
    console.error("Create error:", error);
    return `❌ Error creating ${objectType}: ${error}`;
  }
}

async function handleRead(response: any, teamId: string) {
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
        return `❌ Unknown object type: ${objectType}`;
    }

    if (data.length === 0) {
      return `📭 No ${objectType} found.`;
    }

    // Format as table
    const tableData = formatAsTable(data, objectType);
    return `📊 Found ${data.length} ${objectType}:\n\n${tableData}`;
  } catch (error) {
    console.error("Read error:", error);
    return `❌ Error reading ${objectType}: ${error}`;
  }
}

async function handleUpdate(response: any, userId: string) {
  const { objectType, id, updates } = response;
  
  try {
    switch (objectType) {
      case "contacts":
        await convex.mutation(api.crm.updateContact, {
          contactId: id,
          updates,
        });
        break;
      case "accounts":
        await convex.mutation(api.crm.updateAccount, {
          accountId: id,
          updates,
        });
        break;
      case "activities":
        await convex.mutation(api.crm.updateActivity, {
          activityId: id,
          updates,
        });
        break;
      case "deals":
        await convex.mutation(api.crm.updateDeal, {
          dealId: id,
          updates,
        });
        break;
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
    
    return `✅ ${objectType} updated successfully!`;
  } catch (error) {
    console.error("Update error:", error);
    return `❌ Error updating ${objectType}: ${error}`;
  }
}

async function handleDelete(response: any) {
  const { objectType, id } = response;
  
  try {
    switch (objectType) {
      case "contacts":
        await convex.mutation(api.crm.deleteContact, { contactId: id });
        break;
      case "accounts":
        await convex.mutation(api.crm.deleteAccount, { accountId: id });
        break;
      case "activities":
        await convex.mutation(api.crm.deleteActivity, { activityId: id });
        break;
      case "deals":
        await convex.mutation(api.crm.deleteDeal, { dealId: id });
        break;
      default:
        return `❌ Unknown object type: ${objectType}`;
    }
    
    return `✅ ${objectType} deleted successfully!`;
  } catch (error) {
    console.error("Delete error:", error);
    return `❌ Error deleting ${objectType}: ${error}`;
  }
}

async function handleAddField(response: any, teamId: string) {
  const { objectType, fieldName, fieldType, fieldOptions } = response;
  
  try {
    await convex.mutation(api.crm.addCustomField, {
      teamId,
      objectType,
      fieldName,
      fieldType,
      fieldOptions,
    });
    
    return `✅ Custom field "${fieldName}" added to ${objectType}!`;
  } catch (error) {
    console.error("Add field error:", error);
    return `❌ Error adding custom field: ${error}`;
  }
}

function formatAsTable(data: any[], objectType: string): string {
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