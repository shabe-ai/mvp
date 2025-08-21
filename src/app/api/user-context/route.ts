import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's teams
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: user.id });
    const teamId = teams?.[0]?._id;

    // Get AI profile context
    let aiContext = null;
    if (teamId) {
      try {
        aiContext = await convex.query(api.profiles.getAIProfileContext, { 
          userId: user.id, 
          teamId 
        });
      } catch (error) {
        console.error('Error getting AI profile context:', error);
      }
    }

    // Get user profile from Clerk (fallback)
    const userProfile = {
      name: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.emailAddresses[0]?.emailAddress || "User",
      email: user.emailAddresses[0]?.emailAddress || "",
      company: aiContext?.company?.name || "Shabe ai"
    };

    // Get company data from AI context or fallback
    let companyData = {
      name: aiContext?.company?.name || "Shabe ai",
      website: "www.shabe.ai", // Default website
      description: "Shabe AI is a chat-first revenue platform" // Default description
    };

    // Fallback to query params if no AI context
    if (!aiContext) {
      const url = new URL(request.url);
      const companyDataParam = url.searchParams.get('companyData');
      if (companyDataParam) {
        try {
          const parsedCompanyData = JSON.parse(decodeURIComponent(companyDataParam));
          if (parsedCompanyData.name) {
            companyData = parsedCompanyData;
          }
        } catch (error) {
          console.error('Error parsing company data:', error);
        }
      }
    }

    console.log('User context API returning:', { userProfile, companyData, aiContext });

    return NextResponse.json({
      userProfile,
      companyData,
      aiContext
    });

  } catch (error) {
    console.error('❌ Error getting user context:', error);
    return NextResponse.json(
      { error: 'Failed to get user context' },
      { status: 500 }
    );
  }
} 