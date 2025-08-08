import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    // Initialize Google OAuth2 client with minimal configuration
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );

    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    
    // Generate OAuth URL with minimal scopes
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      prompt: 'consent',
      state: userId
    });

    return NextResponse.json({
      authUrl,
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
      clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT_SET',
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      userId,
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing simple OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to test simple OAuth', details: error },
      { status: 500 }
    );
  }
} 