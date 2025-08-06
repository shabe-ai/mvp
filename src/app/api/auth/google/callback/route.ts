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

    console.log('🔍 Google OAuth callback received:', {
      hasCode: !!code,
      hasError: !!error,
      error,
      url: request.url
    });

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=oauth_error&details=${error}`);
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=no_code`);
    }

    console.log('🔄 Attempting to exchange code for tokens...');
    
    // Exchange code for tokens
    let tokens: any;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      
      if (!tokens.access_token) {
        console.error('❌ No access token received from Google');
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=no_access_token`);
      }
      
      console.log('✅ Successfully received tokens from Google');
    } catch (tokenError: any) {
      console.error('❌ Error exchanging code for tokens:', tokenError);
      console.error('❌ Error details:', {
        message: tokenError.message,
        code: tokenError.code,
        status: tokenError.status,
        response: tokenError.response?.data
      });
      
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=token_exchange_failed&details=${tokenError.message}`
      );
    }

    // Get user session
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=not_authenticated`);
    }

    // Get user email from Google
    let userEmail: string | undefined;
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      userEmail = userInfo.data.email || undefined;
    } catch (error) {
      console.warn('⚠️ Could not fetch user email:', error);
    }

    // Store both access and refresh tokens with longer expiration
    const expiresIn = (tokens as { expires_in?: number }).expires_in || 3600; // Use Google's provided expiration
    TokenStorage.setToken(
      userId, 
      tokens.access_token, 
      tokens.refresh_token || undefined, // Store refresh token for persistent connections
      expiresIn,
      userEmail
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