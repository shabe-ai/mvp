import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { TokenStorage } from '@/lib/tokenStorage';

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let body: any = null;
  
  try {
    const authResult = await auth();
    userId = authResult.userId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    body = await request.json();
    const { eventPreview } = body;

    logger.info('Calendar event creation requested', { 
      userId, 
      eventTitle: eventPreview?.title,
      attendees: eventPreview?.attendees?.length || 0
    });

    // Get user's Google tokens
    const tokenData = await TokenStorage.getTokenInfo(userId);
    
    if (!tokenData || !tokenData.accessToken) {
      logger.error('No Google tokens found', undefined, { userId });
      return NextResponse.json({ 
        error: 'Google authentication required',
        message: 'Please connect your Google account in Admin settings to create calendar events.',
        action: 'connect_google'
      }, { status: 401 });
    }

    // Check if token is expired
    if (tokenData.expiresAt < Date.now()) {
      logger.error('Google token expired', undefined, { userId });
      return NextResponse.json({ 
        error: 'Google authentication expired',
        message: 'Please reconnect your Google account in Admin settings.',
        action: 'connect_google'
      }, { status: 401 });
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );
    
    oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

    // Initialize Google Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse date and time
    const eventDateTime = parseEventDateTime(eventPreview.date, eventPreview.time);
    const endDateTime = new Date(eventDateTime.getTime() + (eventPreview.duration * 60000));

    // Prepare attendees
    const attendees = eventPreview.attendees
      .filter((attendee: any) => attendee.email && attendee.resolved)
      .map((attendee: any) => ({ email: attendee.email }));

    // Create calendar event
    const event = {
      summary: eventPreview.title,
      description: eventPreview.description || '',
      start: {
        dateTime: eventDateTime.toISOString(),
        timeZone: 'America/New_York', // Default timezone, could be made configurable
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: attendees,
      location: eventPreview.location || '',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 10 }, // 10 minutes before
        ],
      },
    };

    // Insert the event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all', // Send invitations to attendees
    });

    logger.info('Calendar event created successfully', {
      userId,
      eventId: response.data.id,
      eventTitle: eventPreview.title,
      attendeesCount: attendees.length
    });

    return NextResponse.json({
      success: true,
      message: `Calendar event "${eventPreview.title}" created successfully!`,
      eventId: response.data.id,
      eventUrl: response.data.htmlLink,
      attendees: attendees.length
    });

  } catch (error) {
    logger.error('Error creating calendar event', error instanceof Error ? error : new Error(String(error)), {
      userId: userId || 'unknown',
      eventPreview: body?.eventPreview
    });

    // Check for specific Google API errors
    if (error instanceof Error) {
      if (error.message.includes('insufficient authentication scopes') || 
          error.message.includes('403') ||
          (error as any).code === 403) {
        return NextResponse.json({
          error: 'Insufficient Google Calendar permissions',
          message: 'Your Google account needs calendar permissions. Please reconnect your Google account in Admin settings.',
          action: 'connect_google',
          details: 'Calendar event creation requires calendar.events scope'
        }, { status: 403 });
      }
      
      if (error.message.includes('Google authentication')) {
        return NextResponse.json({
          error: 'Google authentication required',
          message: 'Please connect your Google account in Admin settings to create calendar events.',
          action: 'connect_google'
        }, { status: 401 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to create calendar event', message: 'Please try again or contact support.' },
      { status: 500 }
    );
  }
}

function parseEventDateTime(dateStr: string, timeStr: string): Date {
  const now = new Date();
  let targetDate = new Date(now);

  // Parse date
  if (dateStr === 'today') {
    targetDate = new Date(now);
  } else if (dateStr === 'tomorrow') {
    targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (dateStr.includes('next')) {
    // Handle "next Friday", "next Monday", etc.
    const dayName = dateStr.replace('next ', '').toLowerCase();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(dayName);
    
    if (targetDay !== -1) {
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Next week
      targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }
  } else {
    // Try to parse as a specific date
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      targetDate = parsedDate;
    }
  }

  // Parse time
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }

    targetDate.setHours(hours, minutes, 0, 0);
  }

  return targetDate;
}
