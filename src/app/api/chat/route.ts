import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConversationManager } from '@/lib/conversationManager';
// Removed old intent classifier import - using simplified version in conversational handler
import { intentRouter } from "@/lib/intentRouter";
import { conversationalHandler } from '@/lib/conversationalHandler';
import { logger } from '@/lib/logger';
import { errorMonitoring } from '@/lib/errorMonitoring';
import { ConversationPruner } from '@/lib/conversationPruner';

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
  let actualUserId: string | undefined;
  let messageContent: string | undefined;
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    actualUserId = userId;
    const body = await request.json();
    const { message, messages = [], context: requestContext = {}, conversationContext: requestConversationContext = {} } = body;

    // Handle both message formats (single message or messages array)
    let messageContent = message;
    if (!messageContent && messages && messages.length > 0) {
      // Extract the last user message from the messages array
      const lastUserMessage = messages.findLast((msg: any) => msg.role === 'user');
      messageContent = lastUserMessage?.content;
    }

    // Set up error monitoring context
    errorMonitoring.setUserContext(actualUserId);
    errorMonitoring.setTransactionContext('chat_api', 'process_message', { messageLength: messageContent?.length });

    // Log API request with structured logging
    logger.logApiRequest('POST', '/api/chat', actualUserId, { messageLength: messageContent?.length });

    logger.debug('Processing chat message', { 
      userId: actualUserId, 
      messageLength: messageContent?.length,
      hasMessages: messages.length > 0
    });

    // Validate that we have a message
    if (!messageContent || typeof messageContent !== 'string') {
      logger.warn('Invalid or missing message received', { 
        userId: actualUserId, 
        messageContent: typeof messageContent 
      });
      
      errorMonitoring.captureValidationError(
        'Invalid or missing message',
        'messageContent',
        messageContent,
        { userId: actualUserId }
      );
      
      return NextResponse.json({
        message: "I didn't receive a valid message. Please try again.",
        error: true
      });
    }

    // Prune conversation history if needed
    if (messages.length > 0) {
      const pruningResult = ConversationPruner.smartPrune(messages);
      if (pruningResult.prunedCount > 0) {
        logger.info('Conversation history pruned', {
          userId: actualUserId,
          originalCount: pruningResult.originalCount,
          prunedCount: pruningResult.prunedCount,
          reason: pruningResult.reason
        });
      }
    }

    // Check if this is a simple confirmation response
    const isSimpleConfirmation = messageContent && (
      messageContent.toLowerCase().trim() === 'yes' || 
      messageContent.toLowerCase().trim() === 'y' ||
      messageContent.toLowerCase().trim() === 'confirm' ||
      messageContent.toLowerCase().trim() === 'confirm' ||
      messageContent.toLowerCase().trim() === 'correct'
    );

    if (isSimpleConfirmation) {
      logger.info('Simple confirmation detected', { 
        messageContent: messageContent.substring(0, 50),
        userId: actualUserId 
      });
      
      // Check if there's a pending confirmation in the conversation
      const conversationManager = await getConversationManager(actualUserId, 'session-id');
      if (conversationManager) {
        const currentState = conversationManager.getState();
        const lastMessage = currentState.memory.sessionHistory[currentState.memory.sessionHistory.length - 1];
        
        logger.debug('Checking for pending confirmation', {
          lastMessageExists: !!lastMessage,
          lastMessageAction: lastMessage?.conversationContext?.action,
          lastMessagePhase: lastMessage?.conversationContext?.phase,
          userId: actualUserId
        });
        
        if (lastMessage?.conversationContext?.action === 'update_contact' && 
            lastMessage?.conversationContext?.phase === 'confirmation') {
          
          logger.info('Pending update confirmation found, processing directly', { userId: actualUserId });
          
          // Extract confirmation data
          const contactId = lastMessage.conversationContext.contactId;
          const field = lastMessage.conversationContext.field;
          const value = lastMessage.conversationContext.value;
          const contactName = lastMessage.conversationContext.contactName;
          
          logger.debug('Confirmation data extracted', { 
            contactId, 
            field, 
            value, 
            contactName,
            userId: actualUserId 
          });
          
          if (contactId && field && value) {
            try {
              logger.info('Starting direct database update', { userId: actualUserId });
              
              // Import Convex for database operations
              const { convex } = await import('@/lib/convex');
              const { api } = await import('@/convex/_generated/api');
              
              // Update the contact in the database
              const result = await convex.mutation(api.crm.updateContact, {
                contactId: contactId as any,
                updates: { [field]: value }
              });

              logger.info('Direct database update successful', { 
                result,
                userId: actualUserId 
              });
              
              // Update conversation state
              conversationManager.updateContext(messageContent, 'update_contact');
              
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
              logger.error('Direct database update failed', error instanceof Error ? error : new Error(String(error)), {
                userId: actualUserId
              });
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
        } else if (lastMessage?.conversationContext?.action === 'delete_contact' && 
                   lastMessage?.conversationContext?.phase === 'confirmation') {
          
          logger.info('Pending delete confirmation found, processing directly', { userId: actualUserId });
          
          // Extract confirmation data
          const contactId = lastMessage.conversationContext.contactId;
          const contactName = lastMessage.conversationContext.contactName;
          
          logger.debug('Delete confirmation data extracted', { 
            contactId, 
            contactName,
            userId: actualUserId 
          });
          
          if (contactId) {
            try {
              logger.info('Starting direct database deletion', { userId: actualUserId });
              
              // Import Convex for database operations
              const { convex } = await import('@/lib/convex');
              const { api } = await import('@/convex/_generated/api');
              
              // Delete the contact from the database
              const result = await convex.mutation(api.crm.deleteContact, {
                contactId: contactId as any
              });

              logger.info('Direct database deletion successful', { 
                result,
                userId: actualUserId 
              });
              
              // Update conversation state
              conversationManager.updateContext(messageContent, 'delete_contact');
              
              // Add assistant response to history
              const assistantMessage = {
                role: 'assistant' as const,
                content: `Perfect! I've successfully deleted ${contactName} from your database.`,
                timestamp: new Date(),
                conversationContext: {
                  phase: 'exploration',
                  action: 'delete_contact',
                  referringTo: 'new_request'
                }
              };
              conversationManager.addToHistory(assistantMessage);
              
              return NextResponse.json({
                message: `Perfect! I've successfully deleted ${contactName} from your database.`,
                action: "contact_deleted",
                suggestions: conversationManager.getSuggestions(),
                conversationContext: {
                  phase: 'exploration',
                  action: 'delete_contact',
                  referringTo: 'new_request'
                }
              });
              
            } catch (error) {
              logger.error('Direct database deletion failed', error instanceof Error ? error : new Error(String(error)), {
                userId: actualUserId
              });
              return NextResponse.json({
                message: "I encountered an error while deleting the contact. Please try again.",
                conversationContext: {
                  phase: 'error',
                  action: 'delete_contact',
                  referringTo: 'new_request'
                }
              });
            }
          }
        }
      }
    }

    // Get conversation manager for the user (use userId as sessionId to make it user-specific)
    const conversationManager = await getConversationManager(actualUserId, actualUserId);
    
    // Restore conversation context from request if available
    if (requestConversationContext && Object.keys(requestConversationContext).length > 0) {
      logger.info('Restoring conversation context from request', {
        conversationContext: requestConversationContext,
        contextKeys: Object.keys(requestConversationContext),
        userId: actualUserId
      });
      conversationManager.updateFullContext(requestConversationContext);
    }
    
    if (conversationManager) {
      logger.info('Using conversational processing', { 
        messageContent: messageContent.substring(0, 100),
        userId: actualUserId 
      });
      
      try {
        // Use conversational handler for natural language understanding
        logger.info('Starting conversational handling', { userId: actualUserId });
        const response = await conversationalHandler.handleConversation(messageContent, conversationManager, {
          messages,
          userId: actualUserId,
          userProfile: requestContext.userProfile,
          companyData: requestContext.companyData,
          lastAction: conversationManager.getState().memory.sessionHistory.length > 0 
            ? conversationManager.getState().memory.sessionHistory[conversationManager.getState().memory.sessionHistory.length - 1]?.conversationContext?.action 
            : undefined,
          ...requestContext
        });
        logger.debug('Conversational response received', { 
          responseAction: response.conversationContext?.action,
          userId: actualUserId 
        });
        
        // Update conversation state with response
        conversationManager.updateContext(messageContent, response.conversationContext?.action);
        
        // Update full conversation context (including pending recipients, etc.)
        if (response.conversationContext) {
          logger.info('Storing conversation context', {
            conversationContext: response.conversationContext,
            contextKeys: Object.keys(response.conversationContext),
            userId: actualUserId
          });
          conversationManager.updateFullContext(response.conversationContext);
        }
        
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
          type: response.type,
          emailDraft: response.emailDraft,
          chartSpec: response.chartSpec,
          enhancedChart: response.enhancedChart,
          data: response.data,
          suggestions: response.suggestions,
          needsClarification: response.needsClarification,
          conversationContext: response.conversationContext,
          action: response.action // Add action to trigger table refresh
        });
      } catch (conversationError) {
        logger.error('Conversational handling failed in main route', undefined, { 
          userId: actualUserId,
          error: conversationError instanceof Error ? conversationError.message : String(conversationError)
        });
        
        // Return graceful fallback
        return NextResponse.json({
          message: "I encountered an issue while processing your request. Let me help you with something I can do:",
          suggestions: [
            "Show me my contacts",
            "Create a simple chart",
            "View my deals",
            "Help me with a specific task"
          ],
          conversationContext: {
            phase: 'exploration',
            action: 'general_conversation',
            referringTo: 'new_request'
          }
        });
      }
    }
    
    // Fallback for when conversation manager is not available
    logger.warn('No conversation manager available, using fallback', { userId: actualUserId });
    return NextResponse.json({
      message: "I'm having trouble processing your request. Please try again.",
      error: true
    });

  } catch (error) {
    // Log error with structured logging
    logger.error('Chat API error occurred', error instanceof Error ? error : undefined, {
      userId: actualUserId,
      operation: 'chat_api',
      messageLength: messageContent?.length
    });

    // Capture error for monitoring
    errorMonitoring.captureApiError(
      error instanceof Error ? error : new Error(String(error)),
      request,
      { userId: actualUserId }
    );

    // Log API response
    logger.logApiResponse('POST', '/api/chat', 500, actualUserId, { error: true });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

