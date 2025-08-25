import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
// Fix: Use the exact redirect URL that matches LinkedIn app configuration
const REDIRECT_URI = 'https://app.shabe.ai/api/auth/linkedin/callback';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains the user ID
    const error = searchParams.get('error');

    if (error) {
      console.error('LinkedIn OAuth error:', error);
      return NextResponse.redirect('https://app.shabe.ai/admin?error=linkedin_auth_failed');
    }

    if (!code || !state) {
      return NextResponse.redirect('https://app.shabe.ai/admin?error=missing_params');
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
      return NextResponse.redirect('https://app.shabe.ai/admin?error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in, refresh_token } = tokenData;

    // Get user's LinkedIn profile information using the correct API endpoint
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('LinkedIn profile fetch failed:', await profileResponse.text());
      return NextResponse.redirect('https://app.shabe.ai/admin?error=profile_fetch_failed');
    }

    const profileData = await profileResponse.json();
    console.log('LinkedIn profile data:', profileData);

    // Extract email from the userinfo response (it's included in the userinfo endpoint)
    const linkedinEmail = profileData.email || '';
    const linkedinName = profileData.name || '';
    const linkedinUserId = profileData.sub || profileData.id || '';

    // Get user's teams to find the team ID
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: state });
    const teamId = teams?.[0]?._id;

    if (!teamId) {
      return NextResponse.redirect('https://app.shabe.ai/admin?error=no_team_found');
    }

    // Create LinkedIn integration in database
    await convex.mutation(api.linkedin.createLinkedInIntegration, {
      userId: state,
      teamId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      linkedinUserId: linkedinUserId,
      linkedinEmail,
      linkedinName,
      linkedinProfileUrl: `https://www.linkedin.com/in/${linkedinUserId}`,
    });

    return NextResponse.redirect('https://app.shabe.ai/admin?success=linkedin_connected');

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return NextResponse.redirect('https://app.shabe.ai/admin?error=callback_failed');
  }
}
