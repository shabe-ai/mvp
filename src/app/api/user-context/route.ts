import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  try {
    // For internal API calls, we'll accept a userId parameter
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get('userId');
    
    let user = null;
    let userId = null;

    if (userIdParam) {
      // Internal API call - use the provided userId
      userId = userIdParam;
      // For now, we'll use placeholder data since we can't fetch Clerk user data without auth
      // In a real implementation, you'd store user data in a database
      user = {
        firstName: "John",
        lastName: "Doe",
        emailAddresses: [{ emailAddress: "john.doe@shabe.ai" }]
      };
    } else {
      // External call - use Clerk auth
      const authResult = await auth();
      const currentUserResult = await currentUser();
      
      if (!authResult.userId || !currentUserResult) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      userId = authResult.userId;
      user = currentUserResult;
    }

    // Get user profile from Clerk
    const userProfile = {
      name: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.emailAddresses[0]?.emailAddress || "User",
      email: user.emailAddresses[0]?.emailAddress || "",
      company: "Shabe ai" // Default company name
    };

    // Get company data from request query params (passed from frontend)
    const companyDataParam = url.searchParams.get('companyData');
    
    let companyData = {
      name: "Shabe ai",
      website: "www.shabe.ai",
      description: "Shabe AI is a chat-first revenue platform that turns every CRM, email, and calendar task into a single natural-language request"
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
    console.error('Error getting user context:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 