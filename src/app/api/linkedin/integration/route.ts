import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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

    // Get LinkedIn integration from Convex
    const integration = await convex.query(api.linkedin.getLinkedInIntegration, {
      userId: user.id,
    });

    return NextResponse.json({
      integration,
      success: true,
    });

  } catch (error) {
    console.error('Error fetching LinkedIn integration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn integration' },
      { status: 500 }
    );
  }
}
