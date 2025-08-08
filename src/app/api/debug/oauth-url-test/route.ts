import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    // Initialize Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );

    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    
    // Generate OAuth URL
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
      state: userId
    });

    return NextResponse.json({
      authUrl,
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
      clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT_SET',
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to test OAuth URL', details: error },
      { status: 500 }
    );
  }
} 