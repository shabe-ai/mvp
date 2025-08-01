import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from './tokenStorage';

// Gmail API scopes


// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export interface EmailData {
  to: string;
  subject: string;
  content: string;
  from?: string;
}

export class GmailService {
  private gmail: ReturnType<typeof google.gmail>;

  constructor(accessToken: string) {
    oauth2Client.setCredentials({
      access_token: accessToken,
    });
    
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  async sendEmail(emailData: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { to, subject, content, from } = emailData;
      
      // Create email message
      const message = this.createEmailMessage({
        to,
        subject,
        content,
        from: from || 'noreply@shabe.ai'
      });

      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      console.log('✅ Email sent successfully:', response.data);
      
      return {
        success: true,
        messageId: response.data.id || undefined
      };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private createEmailMessage({ to, subject, content, from }: EmailData): string {
    const emailLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      content
    ];

    const email = emailLines.join('\r\n');
    
    // Encode the email in base64
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedEmail;
  }

  async getProfile(): Promise<{ email?: string; name?: string }> {
    try {
      const response = await this.gmail.users.getProfile({
        userId: 'me'
      });
      
      return {
        email: response.data.emailAddress || undefined,
        name: response.data.messagesTotal ? 'Gmail User' : undefined
      };
    } catch (error) {
      console.error('Error getting Gmail profile:', error);
      return {};
    }
  }
}

// Google Calendar API scopes


export class GoogleCalendarService {
  private calendar: ReturnType<typeof google.calendar>;

  constructor(accessToken: string) {
    oauth2Client.setCredentials({
      access_token: accessToken,
    });
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  }

  async getTodaysEvents(): Promise<{ events: unknown[]; summary: string }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();
    try {
      const res = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });
      const events = res.data.items || [];
      let summary = '';
      if (events.length === 0) {
        summary = "You have no meetings or events scheduled for today.";
      } else {
        summary = `You have ${events.length} meeting${events.length > 1 ? 's' : ''} today.`;
      }
      return { events, summary };
    } catch (error: unknown) {
      console.error('Error fetching today\'s calendar events:', error);
      const errorObj = error as { response?: { status?: number }; message?: string };
      if (errorObj?.response?.status === 403 && errorObj?.message?.toLowerCase().includes('insufficient authentication scopes')) {
        return { events: [], summary: 'Insufficient authentication scopes for Google Calendar. Please reconnect your Google account.' };
      }
      return { events: [], summary: 'Could not fetch calendar events.' };
    }
  }
}

// Helper function to get user's Google access token from storage
export async function getUserGoogleToken(): Promise<string | null> {
  try {
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Get token from storage (now async)
    const accessToken = await TokenStorage.getToken(userId);
    
    if (!accessToken) {
      console.log('🔑 No Google access token found for user:', userId);
      return null;
    }

    console.log('🔑 Found Google access token for user:', userId);
    return accessToken;
  } catch (error) {
    console.error('Error getting user Google token:', error);
    return null;
  }
} 

// Helper to get today's events for the current user
export async function getTodaysEventsForUser(): Promise<{ events: unknown[]; summary: string }> {
  const accessToken = await getUserGoogleToken();
  if (!accessToken) {
    return { events: [], summary: 'Google account not connected.' };
  }
  const calendarService = new GoogleCalendarService(accessToken);
  return calendarService.getTodaysEvents();
} 