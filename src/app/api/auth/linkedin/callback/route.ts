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
    
    // Get user's organizations (company pages they can post to)
    let linkedinOrganizationId = '';
    let linkedinOrganizationName = '';
    try {
      console.log('Fetching LinkedIn organizations with token:', access_token.substring(0, 20) + '...');
      
      const orgResponse = await fetch('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(id,name)))', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      
      console.log('Organization response status:', orgResponse.status);
      
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        console.log('Organization data:', JSON.stringify(orgData, null, 2));
        
        if (orgData.elements && orgData.elements.length > 0) {
          const firstOrg = orgData.elements[0]['organizationalTarget~'];
          linkedinOrganizationId = firstOrg.id;
          linkedinOrganizationName = firstOrg.name;
          console.log('LinkedIn organization found:', { id: linkedinOrganizationId, name: linkedinOrganizationName });
        } else {
          console.log('No organizations found in response');
        }
      } else {
        const errorText = await orgResponse.text();
        console.error('Organization fetch failed:', orgResponse.status, errorText);
      }
    } catch (error) {
      console.error('Could not fetch LinkedIn organizations:', error);
    }

    // Get user's teams to find the team ID
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: state });
    const teamId = teams?.[0]?._id;

    if (!teamId) {
      return NextResponse.redirect('https://app.shabe.ai/admin?error=no_team_found');
    }

    // Create LinkedIn integration in database
    try {
      await convex.mutation(api.linkedin.createLinkedInIntegration, {
        userId: state,
        teamId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
        linkedinUserId: linkedinUserId,
        linkedinPersonId: linkedinPersonId,
        linkedinOrganizationId: linkedinOrganizationId,
        linkedinOrganizationName: linkedinOrganizationName,
        linkedinEmail,
        linkedinName,
        linkedinProfileUrl: `https://www.linkedin.com/in/${linkedinUserId}`,
      });
      
      console.log('LinkedIn integration created successfully');
    } catch (convexError) {
      console.error('Failed to create LinkedIn integration in database:', convexError);
      // Still redirect to admin page but with error
      return NextResponse.redirect('https://app.shabe.ai/admin?error=integration_creation_failed');
    }

    return NextResponse.redirect('https://app.shabe.ai/admin?success=linkedin_connected');

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return NextResponse.redirect('https://app.shabe.ai/admin?error=callback_failed');
  }
}
