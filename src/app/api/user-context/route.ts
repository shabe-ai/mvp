import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    
    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const url = new URL(req.url);
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