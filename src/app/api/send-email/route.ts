import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GmailService, getUserGoogleToken } from '@/lib/gmail';

export async function POST(req: NextRequest) {
  try {
    const { subject, content, to } = await req.json();
    
    console.log("📧 Sending email:", { subject, content, to });
    
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    // Get user's Google access token
    const accessToken = await getUserGoogleToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Google account not connected. Please connect your Gmail account first.",
          requiresOAuth: true
        },
        { status: 403 }
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
      console.error("❌ Failed to send email:", result.error);
      return NextResponse.json(
        { success: false, message: result.error || "Failed to send email" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return NextResponse.json(
      { success: false, message: "Failed to send email" },
      { status: 500 }
    );
  }
} 