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
    
    // Get the actual LinkedIn person ID from the profile
    let linkedinPersonId = '';
    try {
      const personResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      
      if (personResponse.ok) {
        const personData = await personResponse.json();
        linkedinPersonId = personData.id;
        console.log('LinkedIn person ID:', linkedinPersonId);
      }
    } catch (error) {
      console.log('Could not fetch LinkedIn person ID, will use userinfo sub:', error);
      linkedinPersonId = linkedinUserId;
    }
    
    // For personal posting only, we don't need to fetch organizations
    const linkedinOrganizationId = undefined;
    const linkedinOrganizationName = undefined;

    // Get user's teams to find the team ID
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: state });
    const teamId = teams?.[0]?._id;

    if (!teamId) {
      return NextResponse.redirect('https://app.shabe.ai/admin?error=no_team_found');
    }

    // Create LinkedIn integration in database
    try {
      // Validate required fields
      if (!state || !teamId || !access_token || !linkedinUserId || !linkedinEmail || !linkedinName) {
        console.error('Missing required fields for LinkedIn integration:', {
          state,
          teamId,
          hasAccessToken: !!access_token,
          linkedinUserId,
          linkedinEmail,
          linkedinName
        });
        return NextResponse.redirect('https://app.shabe.ai/admin?error=missing_required_fields');
      }

      const integrationData = {
        userId: state,
        teamId,
        accessToken: access_token,
        refreshToken: refresh_token || undefined,
        expiresAt: Date.now() + (expires_in * 1000),
        linkedinUserId: linkedinUserId,
        linkedinPersonId: linkedinPersonId || undefined,
        linkedinOrganizationId: linkedinOrganizationId || undefined,
        linkedinOrganizationName: linkedinOrganizationName || undefined,
        linkedinEmail,
        linkedinName,
        linkedinProfileUrl: `https://www.linkedin.com/in/${linkedinUserId}`,
      };

      console.log('Creating LinkedIn integration with data:', {
        userId: integrationData.userId,
        teamId: integrationData.teamId,
        linkedinUserId: integrationData.linkedinUserId,
        linkedinEmail: integrationData.linkedinEmail,
        linkedinName: integrationData.linkedinName,
        hasOrganizationId: !!integrationData.linkedinOrganizationId,
        hasOrganizationName: !!integrationData.linkedinOrganizationName
      });

      await convex.mutation(api.linkedin.createLinkedInIntegration, integrationData);
      
      console.log('LinkedIn integration created successfully');
    } catch (convexError) {
      console.error('Failed to create LinkedIn integration in database:', convexError);
      console.error('Error details:', {
        message: convexError instanceof Error ? convexError.message : String(convexError),
        stack: convexError instanceof Error ? convexError.stack : undefined
      });
      // Still redirect to admin page but with error
      return NextResponse.redirect('https://app.shabe.ai/admin?error=integration_creation_failed');
    }

    return NextResponse.redirect('https://app.shabe.ai/admin?success=linkedin_connected');

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return NextResponse.redirect('https://app.shabe.ai/admin?error=callback_failed');
  }
}
