import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user profile data
    const userProfile = {
      name: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.emailAddresses[0]?.emailAddress || "User",
      email: user.emailAddresses[0]?.emailAddress || "",
      company: "Shabe ai" // Default company name
    };

    // Get company data from request query params (passed from frontend)
    const url = new URL(request.url);
    const companyDataParam = url.searchParams.get('companyData');

    let companyData = {
      name: "Shabe ai",
      website: "www.shabe.ai",
      description: "Shabe AI is a chat-first revenue platform"
    };

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

    console.log('User context API returning:', { userProfile, companyData });

    return NextResponse.json({
      userProfile,
      companyData
    });

  } catch (error) {
    console.error('❌ Error getting user context:', error);
    return NextResponse.json(
      { error: 'Failed to get user context' },
      { status: 500 }
    );
  }
} 