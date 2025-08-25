import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains the user ID
    const error = searchParams.get('error');

    if (error) {
      console.error('LinkedIn OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?error=linkedin_auth_failed`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?error=missing_params`);
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID!,
        client_secret: LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('LinkedIn token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in, refresh_token } = tokenData;

    // Get user's LinkedIn profile information
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!profileResponse.ok) {
      console.error('LinkedIn profile fetch failed:', await profileResponse.text());
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?error=profile_fetch_failed`);
    }

    const profileData = await profileResponse.json();

    // Get user's email address
    const emailResponse = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    let linkedinEmail = '';
    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      linkedinEmail = emailData.elements?.[0]?.['handle~']?.emailAddress || '';
    }

    // Get user's teams to find the team ID
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: state });
    const teamId = teams?.[0]?._id;

    if (!teamId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?error=no_team_found`);
    }

    // Create LinkedIn integration in database
    await convex.mutation(api.linkedin.createLinkedInIntegration, {
      userId: state,
      teamId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      linkedinUserId: profileData.id,
      linkedinEmail,
      linkedinName: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
      linkedinProfileUrl: `https://www.linkedin.com/in/${profileData.id}`,
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?success=linkedin_connected`);

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?error=callback_failed`);
  }
}
