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

    // Get recent emails and filter for contacts only
    const emails = await emailMonitor.getRecentEmails(20); // Get more emails to find contacts
    
    const contactEmails: any[] = [];
    
    for (const email of emails) {
      const details = emailMonitor.extractEmailDetails(email);
      const fromEmails = emailMonitor.extractEmails(details.from);
      
      // Check if any of the sender emails match contacts
      const matches = await emailMonitor.findMatchingContacts(fromEmails, userId);
      
      if (matches.length > 0) {
        contactEmails.push({
          id: email.id,
          from: details.from,
          subject: details.subject,
          date: details.date,
          snippet: email.snippet,
          matchedContacts: matches.map(m => m.name)
        });
      }
      
      // Limit to 5 contact emails for preview
      if (contactEmails.length >= 5) break;
    }

    return NextResponse.json({
      success: true,
      data: {
        recentEmails: contactEmails,
        totalEmails: contactEmails.length,
        note: "Showing only emails from contacts in your database"
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
