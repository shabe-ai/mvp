import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
// Fix: Use the exact redirect URL that matches LinkedIn app configuration
const REDIRECT_URI = 'https://app.shabe.ai/api/auth/linkedin/callback';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // LinkedIn OAuth scopes - must match exactly what's configured in LinkedIn app
    const scopes = [
      'openid',
      'profile', 
      'w_member_social', // For personal posting
      'email'
    ];

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', user.id); // Pass user ID in state

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate LinkedIn OAuth' },
      { status: 500 }
    );
  }
}
