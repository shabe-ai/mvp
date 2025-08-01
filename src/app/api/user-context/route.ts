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
      user = {
        firstName: "User",
        lastName: "",
        emailAddresses: [{ emailAddress: "user@example.com" }]
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
      company: "Unknown Company" // This would come from company settings
    };

    // Get company data from request query params (passed from frontend)
    const companyDataParam = url.searchParams.get('companyData');
    
    let companyData = {
      name: "",
      website: "",
      description: ""
    };

    if (companyDataParam) {
      try {
        companyData = JSON.parse(decodeURIComponent(companyDataParam));
      } catch (error) {
        console.error('Error parsing company data:', error);
      }
    }

    return NextResponse.json({
      userProfile,
      companyData
    });

  } catch (error) {
    console.error('Error getting user context:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 