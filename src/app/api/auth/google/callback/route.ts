import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from '@/lib/tokenStorage';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=oauth_error`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=no_code`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=no_access_token`);
    }

    // Get user session
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=not_authenticated`);
    }

    // Store both access and refresh tokens with longer expiration
    const expiresIn = (tokens as any).expires_in || 3600; // Use Google's provided expiration
    TokenStorage.setToken(
      userId, 
      tokens.access_token, 
      tokens.refresh_token || undefined, // Store refresh token for persistent connections
      expiresIn
    );
    
    console.log('✅ Google OAuth successful for user:', userId);
    console.log('Access token stored:', tokens.access_token ? 'Yes' : 'No');
    console.log('Refresh token stored:', tokens.refresh_token ? 'Yes' : 'No');
    console.log('Token expires in:', expiresIn, 'seconds');

    // Redirect back to the app with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?success=google_connected`);

  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=callback_error`);
  }
} 