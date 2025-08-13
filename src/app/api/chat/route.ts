import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addBreadcrumb } from '@sentry/nextjs';
import { getConversationManager } from '@/lib/conversationManager';
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
  conversationHistory: any[];
  sessionFiles: any[];
}

// Main POST handler
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actualUserId = userId;
    const body = await request.json();
    const { message, messages = [], context: requestContext = {} } = body;

    console.log('🧠 Message content:', message);
    console.log('🧠 User ID:', actualUserId);

    // Validate that we have a message
    if (!message || typeof message !== 'string') {
      console.log('❌ Invalid or missing message:', message);
      return NextResponse.json({
        message: "I didn't receive a valid message. Please try again.",
        error: true
      });
    }

    // Check if this is a simple confirmation response
    const isSimpleConfirmation = message && (
      message.toLowerCase().trim() === 'yes' || 
      message.toLowerCase().trim() === 'y' ||
      message.toLowerCase().trim() === 'confirm' ||
      message.toLowerCase().trim() === 'correct'
    );

    if (isSimpleConfirmation) {
      console.log('🎯 Simple confirmation detected:', message);
      
      // Check if there's a pending confirmation in the conversation
      const conversationManager = await getConversationManager(actualUserId, 'session-id');
      if (conversationManager) {
        const currentState = conversationManager.getState();
        const lastMessage = currentState.memory.sessionHistory[currentState.memory.sessionHistory.length - 1];
        
        console.log('🔍 Checking for pending confirmation:', {
          lastMessageExists: !!lastMessage,
          lastMessageAction: lastMessage?.conversationContext?.action,
          lastMessagePhase: lastMessage?.conversationContext?.phase
        });
        
        if (lastMessage?.conversationContext?.action === 'update_contact' && 
            lastMessage?.conversationContext?.phase === 'confirmation') {
          
          console.log('✅ Pending confirmation found! Processing directly...');
          
          // Extract confirmation data
          const contactId = lastMessage.conversationContext.contactId;
          const field = lastMessage.conversationContext.field;
          const value = lastMessage.conversationContext.value;
          const contactName = lastMessage.conversationContext.contactName;
          
          console.log('📝 Confirmation data:', { contactId, field, value, contactName });
          
          if (contactId && field && value) {
            try {
              console.log('🚀 Starting direct database update...');
              
              // Import Convex for database operations
              const { convex } = await import('@/lib/convex');
              const { api } = await import('@/convex/_generated/api');
              
              // Update the contact in the database
              const result = await convex.mutation(api.crm.updateContact, {
                contactId: contactId as any,
                updates: { [field]: value }
              });

              console.log('✅ Direct database update successful:', result);
              
              // Update conversation state
              conversationManager.updateContext(message, 'update_contact');
              
              // Add assistant response to history
              const assistantMessage = {
                role: 'assistant' as const,
                content: `Perfect! I've successfully updated ${contactName}'s ${field} to "${value}". The changes have been saved to your database.`,
                timestamp: new Date(),
                conversationContext: {
                  phase: 'exploration',
                  action: 'update_contact',
                  referringTo: 'new_request'
                }
              };
              conversationManager.addToHistory(assistantMessage);
              
              return NextResponse.json({
                message: `Perfect! I've successfully updated ${contactName}'s ${field} to "${value}". The changes have been saved to your database.`,
                action: "contact_updated",
                suggestions: conversationManager.getSuggestions(),
                conversationContext: {
                  phase: 'exploration',
                  action: 'update_contact',
                  referringTo: 'new_request'
                }
              });
              
            } catch (error) {
              console.error('❌ Direct database update failed:', error);
              return NextResponse.json({
                message: "I encountered an error while updating the contact. Please try again.",
                conversationContext: {
                  phase: 'error',
                  action: 'update_contact',
                  referringTo: 'new_request'
                }
              });
            }
          }
        }
      }
    }

    // Get conversation manager
    const conversationManager = await getConversationManager(actualUserId, 'session-id');
    
    if (conversationManager) {
      console.log('🧠 Using intent-based processing for:', message);
      console.log('🧠 Message content:', message);
      console.log('🧠 User ID:', actualUserId);
      
      // Classify intent using LLM
      console.log('🧠 Starting intent classification...');
      const intent = await intentClassifier.classifyIntent(message, conversationManager.getState());
      console.log('🧠 Classified intent:', JSON.stringify(intent, null, 2));
      
      // Route intent to appropriate handler
      console.log('🧠 Starting intent routing...');
      const response = await intentRouter.routeIntent(intent, conversationManager, {
        messages,
        userId: actualUserId,
        ...requestContext
      });
      console.log('🧠 Intent routing response:', JSON.stringify(response, null, 2));
      
      // Update conversation state with response
      conversationManager.updateContext(message, response.conversationContext?.action);
      
      // Add assistant response to history
      const assistantMessage = {
        role: 'assistant' as const,
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
        conversationContext: response.conversationContext,
        action: response.action // Add action to trigger table refresh
      });
    }
    
    // Fallback for when conversation manager is not available
    console.log('⚠️ No conversation manager available, using fallback');
    return NextResponse.json({
      message: "I'm having trouble processing your request. Please try again.",
      error: true
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

