import { SimplifiedIntent } from './simplifiedIntentClassifier';
import { conversationalHandler } from './conversationalHandler';
import { logger } from './logger';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { openaiClient } from './openaiClient';

interface IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean;
  handle(intent: SimplifiedIntent, context: any): Promise<any>;
}

interface IntentRouterContext {
  userId: string;
  conversationManager?: any;
  messages?: any[];
  userProfile?: any;
  companyData?: any;
  lastAction?: string;
}

class IntentRouter {
  private handlers: IntentHandler[] = [];

  registerHandler(handler: IntentHandler) {
    this.handlers.push(handler);
  }

  async routeIntent(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Routing intent', {
      action: intent.action,
      confidence: intent.confidence,
      userId: context.userId,
      originalMessage: intent.originalMessage,
      entities: intent.entities
    });

    // Find the appropriate handler
    const handler = this.handlers.find(h => h.canHandle(intent));
    
    if (handler) {
      logger.info('Found handler for intent', {
        action: intent.action,
        handlerType: handler.constructor.name,
        userId: context.userId
      });
      return await handler.handle(intent, context);
    }

    // Check if this is a follow-up question that should use conversation context
    if (intent.action === 'general_conversation' && context.conversationManager) {
      const conversationState = context.conversationManager.getState();
      const lastCompanyFilter = conversationState.currentContext.lastCompanyFilter;
      const lastDataType = conversationState.currentContext.lastDataType;
      
      if (lastCompanyFilter && lastDataType) {
        logger.info('Detected follow-up question, using conversation context', {
          lastCompanyFilter,
          lastDataType,
          originalMessage: intent.originalMessage,
          userId: context.userId
        });
        
        // Create a view_data intent for the follow-up question
        const followUpIntent = {
          action: 'view_data' as const,
          confidence: 0.8,
          originalMessage: intent.originalMessage,
          entities: {
            dataType: lastDataType,
            query: 'list',
            company: lastCompanyFilter
          },
          context: {
            referringTo: 'follow_up' as const,
            userGoal: intent.originalMessage
          },
          metadata: {
            isAmbiguous: false,
            needsClarification: false,
            clarificationQuestion: undefined
          }
        };
        
        // Route to data handler
        const dataHandler = this.handlers.find(h => h.canHandle(followUpIntent));
        if (dataHandler) {
          return await dataHandler.handle(followUpIntent, context);
        }
      }
    }

    logger.warn('No specific handler found, falling back to general conversation', {
      action: intent.action,
      userId: context.userId
    });

    // Fallback to general conversation
    return await conversationalHandler.handleConversation(
      intent.originalMessage || intent.context.userGoal || 'General conversation',
      context.conversationManager,
      context.userId
    );
  }
}

// Chart Intent Handler
class ChartIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_chart' || intent.action === 'modify_chart';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling chart intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { chartType, dataType, dimension } = intent.entities;
      
      // Generate chart using AI
      const chartSpec = await this.generateChartSpec(chartType, dataType, dimension, context);
      
      return {
        type: 'chart',
        chartSpec,
        hasData: true
      };
      
    } catch (error) {
      logger.error('Error handling chart intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });
    
    return {
        type: 'text',
        content: 'I encountered an error while creating your chart. Please try again.',
        hasData: false
      };
    }
  }

  private async generateChartSpec(chartType: string, dataType: string, dimension: string, context: IntentRouterContext): Promise<any> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a data visualization expert. Create chart specifications for ${chartType} charts.`
          },
          {
            role: "user",
            content: `Create a ${chartType} chart for ${dataType} data with dimension ${dimension}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }, {
        userId: context.userId,
        operation: 'chart_generation',
        model: 'gpt-4'
      });
      
      return {
        type: chartType,
        dataType,
        dimension,
        config: JSON.parse(response.choices[0]?.message?.content || '{}')
      };
    } catch (error) {
      logger.error('Error generating chart spec', error instanceof Error ? error : new Error(String(error)), {
        chartType,
        dataType,
        dimension,
        userId: context.userId
      });
      throw error;
    }
  }
}

// Data Intent Handler
class DataIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'view_data' || intent.action === 'explore_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling data intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { dataType, query, company } = intent.entities;
      
      // Fetch data from Convex
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      let data: any[] = [];
      
      if (dataType === 'contacts') {
        data = await convex.query(api.crm.getContactsByTeam, { teamId: context.userId });
      } else if (dataType === 'deals') {
        data = await convex.query(api.crm.getDealsByTeam, { teamId: context.userId });
      } else if (dataType === 'accounts') {
        data = await convex.query(api.crm.getAccountsByTeam, { teamId: context.userId });
      } else if (dataType === 'activities') {
        data = await convex.query(api.crm.getActivitiesByTeam, { teamId: context.userId });
      }
      
      return {
        type: 'data',
        data,
        dataType,
        query,
        company,
        hasData: true
      };
      
    } catch (error) {
      logger.error('Error handling data intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while fetching your data. Please try again.',
        hasData: false
      };
    }
  }
}

// CRUD Intent Handler
class CrudIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action.includes('create_') || intent.action.includes('update_') || intent.action.includes('delete_');
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling CRUD intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { dataType, field, value } = intent.entities;
      
      // Handle CRUD operations
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      let result = null;
      
      // For now, return a placeholder result since the specific CRUD operations
      // would need to be implemented based on the dataType
      result = { success: true, message: `${intent.action} operation completed` };
      
    return {
        type: 'crud_result',
        result,
        action: intent.action,
        hasData: true
      };

    } catch (error) {
      logger.error('Error handling CRUD intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });
      
      return {
        type: 'text',
        content: 'I encountered an error while processing your request. Please try again.',
        hasData: false
      };
    }
  }
}

// Email Intent Handler
class EmailIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'send_email';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling email intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { recipient, content_type, context: emailContext } = intent.entities;
      
      // Generate email content
      const emailContent = await this.generateEmailContent(recipient, content_type, emailContext, context);
      
      return {
        type: 'email_draft',
        emailDraft: {
          to: recipient,
          subject: emailContent.subject,
          content: emailContent.body
        },
        hasData: true
      };
      
    } catch (error) {
      logger.error('Error handling email intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while creating your email. Please try again.',
        hasData: false
      };
    }
  }

  private async generateEmailContent(recipient: string, contentType: string, context: string, routerContext: IntentRouterContext): Promise<any> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a professional email writer. Create ${contentType} emails that are clear, professional, and appropriate for the context.`
          },
          {
            role: "user",
            content: `Create a ${contentType} email to ${recipient} about ${context}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }, {
        userId: routerContext.userId,
        operation: 'email_generation',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content || '';
      const lines = content.split('\n');
      const subject = lines[0] || `Email to ${recipient}`;
      const body = lines.slice(1).join('\n') || content;

      return { subject, body };
    } catch (error) {
      logger.error('Error generating email content', error instanceof Error ? error : new Error(String(error)), {
        recipient,
        contentType,
        context,
        userId: routerContext.userId
      });
      throw error;
    }
  }
}

// Calendar Intent Handler
class CalendarIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_calendar_event';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling calendar intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { attendee, date, time } = intent.entities;
      
      // Create calendar event
      const eventDetails = await this.createCalendarEvent(attendee, date, time, context);
      
      return {
        type: 'calendar_event',
        eventDetails,
        hasData: true
      };
      
    } catch (error) {
      logger.error('Error handling calendar intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

        return {
        type: 'text',
        content: 'I encountered an error while creating your calendar event. Please try again.',
        hasData: false
      };
    }
  }

  private async createCalendarEvent(attendee: string, date: string, time: string, context: IntentRouterContext): Promise<any> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a calendar assistant. Create calendar event details for meetings.`
          },
          {
            role: "user",
            content: `Create a calendar event with ${attendee} on ${date} at ${time}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      }, {
        userId: context.userId,
        operation: 'calendar_event_creation',
        model: 'gpt-4'
      });

        return {
        attendee,
        date,
        time,
        details: response.choices[0]?.message?.content || 'Meeting scheduled'
      };
    } catch (error) {
      logger.error('Error creating calendar event', error instanceof Error ? error : new Error(String(error)), {
        attendee,
        date,
        time,
        userId: context.userId
      });
      throw error;
    }
  }
}

// Analysis Intent Handler
class AnalysisIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'analyze_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling analysis intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { dataType, dimension } = intent.entities;
      
      // Perform data analysis
      const analysis = await this.performAnalysis(dataType, dimension, context);
      
        return {
        type: 'analysis',
        analysis,
        hasData: true
      };
      
    } catch (error) {
      logger.error('Error handling analysis intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });
          
          return {
        type: 'text',
        content: 'I encountered an error while analyzing your data. Please try again.',
        hasData: false
      };
    }
  }

  private async performAnalysis(dataType: string, dimension: string, context: IntentRouterContext): Promise<any> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a data analyst. Provide insights and analysis for ${dataType} data.`
          },
          {
            role: "user",
            content: `Analyze ${dataType} data by ${dimension}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }, {
        userId: context.userId,
        operation: 'data_analysis',
        model: 'gpt-4'
      });

        return {
        dataType,
        dimension,
        insights: response.choices[0]?.message?.content || 'No insights available'
      };
    } catch (error) {
      logger.error('Error performing analysis', error instanceof Error ? error : new Error(String(error)), {
        dataType,
        dimension,
        userId: context.userId
      });
      throw error;
    }
  }
}

// Profile Intent Handler
class ProfileIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'query_profile';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling profile intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { profileType, query } = intent.entities;
      
      // Fetch profile data
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      let profileData = null;
      
      // For now, return placeholder profile data since the specific profile API
      // would need to be implemented
      if (profileType === 'user') {
        profileData = { name: 'User', title: 'Professional' };
      } else if (profileType === 'company') {
        profileData = { name: 'Company', industry: 'Technology' };
      }
      
      const content = this.formatProfileResponse(profileData, query, profileType);
      
        return {
        type: 'text',
        content,
        hasData: true
      };
      
    } catch (error) {
      logger.error('Error handling profile intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while fetching your profile. Please try again.',
        hasData: false
      };
    }
  }

  private formatProfileResponse(profileData: any, query: string, profileType: string): string {
    if (profileType === 'user') {
      return this.handleUserProfileQuery(profileData, query);
    } else if (profileType === 'company') {
      return this.handleCompanyProfileQuery(profileData, query);
    }
    return 'Profile information not available.';
  }

  private handleUserProfileQuery(userData: any, query: string): string {
    let content = '';
    
    if (query === 'name') {
      content = `Your name is **${userData.name}**.`;
    } else if (query === 'role' || query === 'title') {
      if (userData.title) {
        content = `Your job title is **${userData.title}**.`;
      } else if (userData.role) {
        content = `Your role is **${userData.role}**.`;
      } else {
        content = 'I don\'t have your job title or role information. You can update this in your profile settings.';
      }
    } else if (query === 'details') {
      content = `**Your Profile Information:**\n\n`;
      content += `**Name:** ${userData.name}\n`;
      if (userData.title) content += `**Title:** ${userData.title}\n`;
      if (userData.department) content += `**Department:** ${userData.department}\n`;
      if (userData.role) content += `**Role:** ${userData.role}\n`;
      if (userData.communicationStyle) content += `**Communication Style:** ${userData.communicationStyle}\n`;
      if (userData.preferredDetailLevel) content += `**Preferred Detail Level:** ${userData.preferredDetailLevel}\n`;
    } else {
      content = `**Your Profile Information:**\n\n`;
      content += `**Name:** ${userData.name}\n`;
      if (userData.title) content += `**Title:** ${userData.title}\n`;
      if (userData.department) content += `**Department:** ${userData.department}\n`;
    }

    return content;
  }

  private handleCompanyProfileQuery(companyData: any, query: string): string {
    let content = '';

    if (companyData) {
      content += `**Company Information:**\n`;
      content += `**Name:** ${companyData.name}\n`;
      if (companyData.industry) content += `**Industry:** ${companyData.industry}\n`;
      if (companyData.companySize) content += `**Size:** ${companyData.companySize} employees\n\n`;
    }

    if (!companyData) {
      content = 'I couldn\'t find your company information. Please complete your profile in the admin section.';
    }

    return content;
  }
}

// LinkedIn Post Intent Handler
class LinkedInPostIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_linkedin_post';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling LinkedIn post intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { content, platform, schedule } = intent.entities;
      
      // Generate LinkedIn post content using AI
      const postContent = await this.generateLinkedInPost(content, context);
      
      // Create post preview
      const postPreview = {
        content: postContent,
        platform: 'linkedin',
        scheduledAt: schedule ? this.parseScheduleTime(schedule) : undefined,
        visibility: 'public',
        postType: 'text',
        isCompanyPost: true // Indicate this is a company page post
      };

      const response = {
        type: 'linkedin_post_preview',
        content: postPreview,
        hasData: true,
        needsConfirmation: true
      };
      
      logger.info('LinkedIn post preview response', {
        responseType: response.type,
        hasContent: !!response.content,
        contentKeys: response.content ? Object.keys(response.content) : [],
        userId: context.userId
      });
      
      return response;
      
    } catch (error) {
      logger.error('Error handling LinkedIn post intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while creating your LinkedIn post. Please try again.',
        hasData: false
      };
    }
  }

  private async generateLinkedInPost(content: string, context: IntentRouterContext): Promise<string> {
    // Use the dedicated LinkedIn content generation endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.shabe.ai';
    const apiUrl = `${baseUrl}/api/linkedin/generate-content`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content,
        userId: context.userId
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate LinkedIn post content');
    }

    const data = await response.json();
    return data.content || `Excited to share about ${content}! #innovation #business`;
  }

  private parseScheduleTime(schedule: string): string | undefined {
    // Simple schedule parsing - can be enhanced
    const now = new Date();
    
    if (schedule.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM
      return tomorrow.toISOString();
    }
    
    if (schedule.toLowerCase().includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0); // 9 AM
      return nextWeek.toISOString();
    }
    
    return undefined; // Post immediately
  }
}

// Blog Post Intent Handler
class BlogPostIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_blog_post';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling blog post intent', {
      action: intent.action,
      entities: intent.entities,
      userId: context.userId
    });

    try {
      const { content, length } = intent.entities;
      
      // Generate blog post content using AI
      const blogContent = await this.generateBlogPost(content, length, context);
      
      // Create blog post preview
      const blogPreview = {
        content: blogContent,
        topic: content,
        length: length || 'standard',
        type: 'blog_post',
        needsConfirmation: true
      };

      const response = {
        type: 'blog_post_preview',
        content: blogPreview,
        hasData: true,
        needsConfirmation: true
      };
      
      logger.info('Blog post preview response', {
        responseType: response.type,
        hasContent: !!response.content,
        contentKeys: response.content ? Object.keys(response.content) : [],
        userId: context.userId
      });
      
      return response;
      
    } catch (error) {
      logger.error('Error handling blog post intent', error instanceof Error ? error : new Error(String(error)), {
        intent: intent.action,
        userId: context.userId
      });

      return {
        type: 'text',
        content: 'I encountered an error while creating your blog post. Please try again.',
        hasData: false
      };
    }
  }

  private async generateBlogPost(content: string, length: string, context: IntentRouterContext): Promise<string> {
    try {
      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a professional blog writer. Write the COMPLETE blog post content, not an outline or summary.

IMPORTANT: Write the actual blog post content that readers would see, not an outline or structure. Do not say things like "Please note that the content needs to be written by you" or "This outline should provide a good starting point."

            
            Focus on creating content that:
            - Is engaging and informative
            - Has a clear structure with proper paragraphs
            - Uses professional language
            - Includes relevant insights and value for readers
            - Is optimized for readability
            
            ${length === '3 paragraphs' ? 'Create exactly 3 well-structured paragraphs.' : 
              length === 'short' ? 'Keep it concise (2-3 paragraphs).' :
              length === 'long' ? 'Create a comprehensive post (5-7 paragraphs).' :
              'Create a standard blog post (4-5 paragraphs).'}`
          },
          {
            role: "user",
            content: `Write a complete blog post about: ${content}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }, {
        userId: context.userId,
        operation: 'blog_post_generation',
        model: 'gpt-4'
      });

      return response.choices[0]?.message?.content || `Blog post about ${content}`;
    } catch (error) {
      logger.error('Error generating blog post content', error instanceof Error ? error : new Error(String(error)), {
        content,
        length,
        userId: context.userId
      });
      throw error;
    }
  }
}

// Create and configure the router
export const intentRouter = new IntentRouter();

// Register all handlers
intentRouter.registerHandler(new ChartIntentHandler());
intentRouter.registerHandler(new DataIntentHandler());
intentRouter.registerHandler(new CrudIntentHandler());
intentRouter.registerHandler(new EmailIntentHandler());
intentRouter.registerHandler(new CalendarIntentHandler());
intentRouter.registerHandler(new AnalysisIntentHandler());
intentRouter.registerHandler(new ProfileIntentHandler());
intentRouter.registerHandler(new LinkedInPostIntentHandler());
intentRouter.registerHandler(new BlogPostIntentHandler());
