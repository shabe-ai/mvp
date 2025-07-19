import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from './tokenStorage';

// Gmail API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify'
];

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

// Helper function to get user's Google access token from storage
export async function getUserGoogleToken(): Promise<string | null> {
  try {
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Get token from storage
    const accessToken = TokenStorage.getToken(userId);
    
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