import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { openaiClient } from "@/lib/openaiClient";
import { logError, addBreadcrumb } from "@/lib/errorLogger";
import { getConversationManager, resetConversationManager } from "@/lib/conversationManager";
import { Message, ConversationResponse } from "@/types/chat";
import { intentClassifier } from "@/lib/intentClassifier";
import { intentRouter } from "@/lib/intentRouter";

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
  _id: string; // Add _id for LiveTables compatibility
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

// Main conversation handler using LLM-powered system
async function handleGeneralConversationWithState(message: string, messages: Message[], context: UserContext, userId?: string, conversationManager?: any) {
  try {
    // Get user's data for context
    const actualUserId = userId || context.userProfile?.email || 'unknown';
    console.log('🔍 Getting data for user:', actualUserId);
    
    // Log conversation state
    if (conversationManager) {
      console.log('🧠 Conversation state:', conversationManager.getState());
      console.log('💡 Suggestions:', conversationManager.getSuggestions());
    }
    
    // Use intent-based processing instead of pattern matching
    if (conversationManager) {
      console.log('🧠 Using intent-based processing for:', message);
      
      // Classify intent using LLM
      const intent = await intentClassifier.classifyIntent(message, conversationManager.getState());
      console.log('🧠 Classified intent:', intent);
      
      // Route intent to appropriate handler
      const response = await intentRouter.routeIntent(intent, conversationManager, {
        messages,
        userId: actualUserId,
        ...context
      });
      
      // Update conversation state with response
      conversationManager.updateContext(message, response.conversationContext?.action);
      
      // Add assistant response to history
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        conversationContext: response.conversationContext
      };
      conversationManager.addToHistory(assistantMessage);
      
      // Return structured response
      return NextResponse.json({
        message: response.message,
        chartSpec: response.chartSpec,
        enhancedChart: response.enhancedChart,
        data: response.data,
        suggestions: response.suggestions,
        needsClarification: response.needsClarification,
        conversationContext: response.conversationContext
      });
    }
    
    // Fallback for when conversation manager is not available
    console.log('⚠️ No conversation manager available, using fallback');
    return NextResponse.json({
      message: "I'm having trouble processing your request. Please try again.",
      error: true
    });

  } catch (error) {
    console.error('❌ Conversation handling error:', error);
    
    // Log error with context
    logError(error instanceof Error ? error : String(error), {
      action: 'conversation_handling',
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

// Main POST handler
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
    
    // Initialize conversation manager
    const sessionId = `${userId}-${Date.now()}`;
    const conversationManager = getConversationManager(userId, sessionId);
    
    // Add user message to conversation history
    const userMessage: Message = {
      role: 'user',
      content: lastUserMessage,
      timestamp: new Date()
    };
    conversationManager.addToHistory(userMessage);
    
    // Update conversation context
    conversationManager.updateContext(lastUserMessage);
    
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
    console.log('Conversation context:', conversationManager.getConversationContext());

    // Use enhanced conversation handling with state management
    return await handleGeneralConversationWithState(lastUserMessage, messages, context, userId, conversationManager);

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

