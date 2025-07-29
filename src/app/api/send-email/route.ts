import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GmailService, getUserGoogleToken } from '@/lib/gmail';
import { 
  handleApiError, 
  validateRequiredFields, 
  validateStringField,
  validateEmail,
  AuthenticationError,
  ValidationError 
} from '@/lib/errorHandler';

export async function POST(req: NextRequest) {
  try {
    const { subject, content, to } = await req.json();
    
    console.log("📧 Sending email:", { subject, content, to });
    
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      throw new AuthenticationError();
    }

    // Validate required fields
    validateRequiredFields({ subject, content, to }, ['to', 'content']);
    
    // Validate email format
    validateEmail(to);
    
    // Validate content length
    validateStringField(content, 'content', 50000); // Max 50k chars for email content
    validateStringField(subject, 'subject', 200); // Max 200 chars for subject

    // Get user's Google access token
    const accessToken = await getUserGoogleToken();
    
    if (!accessToken) {
      throw new ValidationError(
        "Google account not connected. Please connect your Gmail account first.",
        'GOOGLE_NOT_CONNECTED',
        { requiresOAuth: true }
      );
    }

    // Initialize Gmail service
    const gmailService = new GmailService(accessToken);
    
    // Send the email
    const result = await gmailService.sendEmail({
      to,
      subject: subject || "Email from Shabe",
      content
    });

    if (result.success) {
      console.log("✅ Email sent successfully:", result.messageId);
      return NextResponse.json({ 
        success: true, 
        message: "Email sent successfully",
        messageId: result.messageId
      });
    } else {
      throw new Error(result.error || "Failed to send email");
    }
    
  } catch (error) {
    return handleApiError(error);
  }
} 