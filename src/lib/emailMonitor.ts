import { google } from 'googleapis';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TokenStorage } from './tokenStorage';
import { logger } from './logger';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: {
      data?: string;
    };
    parts?: Array<{
      headers: Array<{ name: string; value: string }>;
      body?: {
        data?: string;
      };
    }>;
  };
  internalDate: string;
}

export interface ContactMatch {
  contactId: Id<"contacts">;
  email: string;
  name: string;
  teamId: string;
}

export class EmailMonitorService {
  private gmail: ReturnType<typeof google.gmail>;

  constructor(accessToken: string) {
    oauth2Client.setCredentials({
      access_token: accessToken,
    });
    
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Get recent emails from Gmail
   */
  async getRecentEmails(maxResults: number = 10): Promise<EmailMessage[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'is:inbox', // Only get inbox emails
      });

      if (!response.data.messages) {
        return [];
      }

      // Get full message details for each email
      const messagePromises = response.data.messages.map(message =>
        this.gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
        })
      );

      const messageResponses = await Promise.all(messagePromises);
      return messageResponses.map(response => response.data as EmailMessage);
    } catch (error) {
      logger.error('Error fetching recent emails', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Extract email details from Gmail message
   */
  extractEmailDetails(message: EmailMessage): {
    from: string;
    to: string;
    subject: string;
    body: string;
    date: Date;
  } {
    const headers = message.payload.headers;
    
    const from = headers.find(h => h.name === 'From')?.value || '';
    const to = headers.find(h => h.name === 'To')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    
    // Extract email body
    let body = '';
    if (message.payload.body?.data) {
      body = this.decodeBody(message.payload.body.data);
    } else if (message.payload.parts) {
      // Try to find text/plain part
      const textPart = message.payload.parts.find(part =>
        part.headers.some(h => h.name === 'Content-Type' && h.value?.includes('text/plain'))
      );
      if (textPart?.body?.data) {
        body = this.decodeBody(textPart.body.data);
      }
    }
    
    const date = new Date(parseInt(message.internalDate));

    return { from, to, subject, body, date };
  }

  /**
   * Decode base64 email body
   */
  private decodeBody(data: string): string {
    try {
      return Buffer.from(data, 'base64').toString('utf-8');
    } catch (error) {
      logger.error('Error decoding email body', error instanceof Error ? error : new Error(String(error)));
      return '';
    }
  }

  /**
   * Find contacts in database that match email addresses
   */
  async findMatchingContacts(emails: string[], userId: string): Promise<ContactMatch[]> {
    try {
      // Get user's teams
      const teams = await convex.query(api.crm.getTeamsByUser, { userId });
      if (!teams || teams.length === 0) {
        return [];
      }

      const teamId = teams[0]._id;
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });

      const matches: ContactMatch[] = [];

      for (const email of emails) {
        const contact = contacts.find((c: any) => 
          c.email?.toLowerCase() === email.toLowerCase()
        );

        if (contact) {
          matches.push({
            contactId: contact._id,
            email: contact.email,
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            teamId
          });
        }
      }

      return matches;
    } catch (error) {
      logger.error('Error finding matching contacts', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Create activity record for email
   */
  async createEmailActivity(
    emailDetails: { from: string; to: string; subject: string; body: string; date: Date },
    contactMatch: ContactMatch,
    userId: string
  ): Promise<string | null> {
    try {
      const activityId = await convex.mutation(api.crm.createActivity, {
        teamId: contactMatch.teamId,
        createdBy: userId,
        type: 'email',
        subject: emailDetails.subject || 'Email from contact',
        description: emailDetails.body.substring(0, 500) + (emailDetails.body.length > 500 ? '...' : ''),
        contactId: contactMatch.contactId,
        status: 'completed',
        startTime: emailDetails.date.getTime(),
        customFields: {
          emailFrom: emailDetails.from,
          emailTo: emailDetails.to,
          emailDate: emailDetails.date.toISOString(),
          emailBody: emailDetails.body,
          autoLogged: true
        }
      });

      logger.info('Email activity created successfully', {
        activityId,
        contactId: contactMatch.contactId,
        subject: emailDetails.subject,
        userId
      });

      return activityId;
    } catch (error) {
      logger.error('Error creating email activity', error instanceof Error ? error : new Error(String(error)), {
        contactId: contactMatch.contactId,
        subject: emailDetails.subject,
        userId
      });
      return null;
    }
  }

  /**
   * Check if email has already been logged as activity
   */
  async isEmailAlreadyLogged(emailId: string, userId: string): Promise<boolean> {
    try {
      const teams = await convex.query(api.crm.getTeamsByUser, { userId });
      if (!teams || teams.length === 0) {
        return false;
      }

      const teamId = teams[0]._id;
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });

      // Check if any activity has this email ID in custom fields
      return activities.some((activity: any) => 
        activity.customFields?.emailId === emailId
      );
    } catch (error) {
      logger.error('Error checking if email already logged', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Process recent emails and log activities for matching contacts
   */
  async processRecentEmails(userId: string): Promise<{
    processed: number;
    logged: number;
    errors: number;
  }> {
    try {
      logger.info('Starting email processing', { userId });

      const emails = await this.getRecentEmails(20);
      let processed = 0;
      let logged = 0;
      let errors = 0;

      for (const email of emails) {
        try {
          processed++;

          // Check if already logged
          if (await this.isEmailAlreadyLogged(email.id, userId)) {
            continue;
          }

          const emailDetails = this.extractEmailDetails(email);
          
          // Extract email addresses from From field
          const fromEmails = this.extractEmails(emailDetails.from);
          
          // Find matching contacts
          const matches = await this.findMatchingContacts(fromEmails, userId);

          if (matches.length > 0) {
            // Log activity for each matching contact
            for (const match of matches) {
              const activityId = await this.createEmailActivity(emailDetails, match, userId);
              if (activityId) {
                logged++;
              } else {
                errors++;
              }
            }
          }
        } catch (error) {
          errors++;
          logger.error('Error processing email', error instanceof Error ? error : new Error(String(error)), {
            emailId: email.id,
            userId
          });
        }
      }

      logger.info('Email processing completed', {
        userId,
        processed,
        logged,
        errors
      });

      return { processed, logged, errors };
    } catch (error) {
      logger.error('Error in email processing', error instanceof Error ? error : new Error(String(error)), { userId });
      throw error;
    }
  }

  /**
   * Extract email addresses from a string
   */
  private extractEmails(text: string): string[] {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailRegex);
    return matches || [];
  }
}

/**
 * Get email monitor service for a user
 */
export async function getEmailMonitorService(userId: string): Promise<EmailMonitorService | null> {
  try {
    const accessToken = await TokenStorage.getToken(userId);
    
    if (!accessToken) {
      logger.warn('No Google access token found for user', { userId });
      return null;
    }

    return new EmailMonitorService(accessToken);
  } catch (error) {
    logger.error('Error getting email monitor service', error instanceof Error ? error : new Error(String(error)), { userId });
    return null;
  }
}


