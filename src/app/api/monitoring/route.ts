import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openaiClient } from "@/lib/openaiClient";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const timeWindow = url.searchParams.get('timeWindow') || '24h';
    const targetUserId = url.searchParams.get('userId') || userId;

    // Convert time window to milliseconds
    const timeWindowMs = timeWindow === '1h' ? 60 * 60 * 1000 :
                        timeWindow === '24h' ? 24 * 60 * 60 * 1000 :
                        timeWindow === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                        24 * 60 * 60 * 1000; // Default to 24 hours

    // Get cost statistics
    const costStats = await openaiClient.getCostStats(targetUserId, timeWindowMs);
    
    // Get rate limit status
    const rateLimitStatus = await openaiClient.getRateLimitStatus(targetUserId);

    return NextResponse.json({
      success: true,
      data: {
        costStats,
        rateLimitStatus,
        timeWindow,
        targetUserId
      }
    });

  } catch (error) {
    console.error("❌ Error getting monitoring data:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get monitoring data",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 