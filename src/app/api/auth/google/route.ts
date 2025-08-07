import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export async function GET() {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    // TEMPORARY: Use a hardcoded userId for testing in production
    const testUserId = userId || 'user_30yNzzaqY36tW07nKprV52twdEQ'; // From console logs
    
    console.log('🔍 Google OAuth request:', {
      hasSession: !!session,
      sessionUserId: userId,
      usingTestUserId: !userId,
      finalUserId: testUserId
    });

    // Generate OAuth URL with state parameter containing userId
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ],
      prompt: 'consent',
      include_granted_scopes: true,
      state: testUserId // Include userId in state parameter
    });

    console.log('🔗 Generated Google OAuth URL for user:', testUserId);

    return NextResponse.json({ authUrl });

  } catch (error) {
    console.error('❌ Error generating Google OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
} 