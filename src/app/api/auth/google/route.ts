import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    console.log('🔍 Google OAuth request:', {
      hasSession: !!session,
      sessionUserId: userId,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    // If no session, try to get userId from query parameter or header
    let finalUserId = userId;
    if (!userId) {
      // Try to get userId from query parameter (for testing)
      const url = new URL(request.url);
      const testUserId = url.searchParams.get('userId');
      if (testUserId) {
        finalUserId = testUserId;
        console.log('⚠️ Using test userId from query parameter:', testUserId);
      } else {
        // Use the hardcoded userId for now
        finalUserId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
        console.log('⚠️ Using hardcoded userId for testing:', finalUserId);
      }
    }

    // Ensure finalUserId is always a string
    if (!finalUserId) {
      finalUserId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
      console.log('⚠️ No userId available, using hardcoded fallback');
    }

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
      state: finalUserId // Include userId in state parameter
    });

    console.log('🔗 Generated Google OAuth URL for user:', finalUserId);

    return NextResponse.json({ authUrl });

  } catch (error) {
    console.error('❌ Error generating Google OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
} 