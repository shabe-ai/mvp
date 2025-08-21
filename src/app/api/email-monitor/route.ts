import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEmailMonitorService } from '@/lib/emailMonitor';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    logger.info('Email monitoring triggered', { userId });

    // Get email monitor service
    const emailMonitor = await getEmailMonitorService(userId);
    
    if (!emailMonitor) {
      return NextResponse.json({
        error: "Google account not connected. Please connect your Gmail account first.",
        requiresOAuth: true
      }, { status: 400 });
    }

    // Process recent emails
    const result = await emailMonitor.processRecentEmails(userId);

    logger.info('Email monitoring completed', {
      userId,
      processed: result.processed,
      logged: result.logged,
      errors: result.errors
    });

    return NextResponse.json({
      success: true,
      message: `Email monitoring completed. Processed ${result.processed} emails, logged ${result.logged} activities.`,
      data: result
    });

  } catch (error) {
    logger.error('Error in email monitoring', error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process emails",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get email monitor service
    const emailMonitor = await getEmailMonitorService(userId);
    
    if (!emailMonitor) {
      return NextResponse.json({
        error: "Google account not connected. Please connect your Gmail account first.",
        requiresOAuth: true
      }, { status: 400 });
    }

    // Get recent emails for preview (without logging)
    const emails = await emailMonitor.getRecentEmails(5);
    
    const emailPreviews = emails.map(email => {
      const details = emailMonitor.extractEmailDetails(email);
      return {
        id: email.id,
        from: details.from,
        subject: details.subject,
        date: details.date,
        snippet: email.snippet
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        recentEmails: emailPreviews,
        totalEmails: emails.length
      }
    });

  } catch (error) {
    logger.error('Error getting email preview', error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get email preview",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
