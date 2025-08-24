import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // LinkedIn OAuth scopes for posting and profile access
    const scopes = [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social',
      'rw_organization_admin',
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
