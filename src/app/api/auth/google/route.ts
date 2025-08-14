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

    // If no session, redirect to login
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    let finalUserId = userId;

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
    console.log('🔗 OAuth URL:', authUrl);
    console.log('🔗 Redirect URI:', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`);
    console.log('🔗 Client ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT_SET');
    console.log('🔗 Has Client Secret:', !!process.env.GOOGLE_CLIENT_SECRET);

    return NextResponse.json({ authUrl });

  } catch (error) {
    console.error('❌ Error generating Google OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
} 