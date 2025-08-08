import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { TokenStorage } from '@/lib/tokenStorage';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export async function GET(request: NextRequest) {
  try {
    console.log('🚨 CALLBACK ENDPOINT CALLED - URL:', request.url);
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // Get userId from state parameter

    console.log('🔍 Google OAuth callback received:', {
      hasCode: !!code,
      hasError: !!error,
      hasState: !!state,
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

    if (!state) {
      console.error('No state parameter received (userId)');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=no_state`);
    }

    const userId = state; // Use state parameter as userId

    console.log('🔄 Attempting to exchange code for tokens...');
    console.log('🔄 Code received:', code ? `${code.substring(0, 10)}...` : 'NO_CODE');
    console.log('🔄 OAuth2Client config:', {
      clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT_SET',
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
    });
    
    // Exchange code for tokens
    let tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      expires_in?: number | null;
    };
    try {
      console.log('🔄 Calling oauth2Client.getToken...');
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      
      console.log('🔄 Token response received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenKeys: Object.keys(tokens)
      });
      
      if (!tokens.access_token) {
        console.error('❌ No access token received from Google');
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=no_access_token`);
      }
      
      console.log('✅ Successfully received tokens from Google');
    } catch (tokenError: unknown) {
      console.error('❌ Error exchanging code for tokens:', tokenError);
      const error = tokenError as { message?: string; code?: string; status?: number; response?: { data?: unknown } };
      const errorDetails = error.message || error.code || 'unknown_error';
      console.error('❌ Token exchange error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        responseData: error.response?.data
      });
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=oauth_error&details=${errorDetails}`);
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
    
    console.log('💾 About to store tokens for user:', userId);
    console.log('💾 Token details:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn,
      userEmail
    });
    
    try {
      await TokenStorage.setToken(
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
    } catch (storageError) {
      console.error('❌ Error storing tokens:', storageError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=storage_error`);
    }

    // Redirect back to the app with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?success=google_connected`);

  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?error=callback_error`);
  }
} 