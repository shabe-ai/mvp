import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { openaiClient } from "@/lib/openaiClient";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Test rate limit status
    const rateLimitStatus = await openaiClient.getRateLimitStatus(userId);
    
    // Test cost stats
    const costStats = await openaiClient.getCostStats(userId, 24 * 60 * 60 * 1000); // 24 hours

    return NextResponse.json({
      success: true,
      data: {
        rateLimitStatus,
        costStats,
        userId
      }
    });

  } catch (error) {
    console.error("❌ Error testing rate limits:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to test rate limits",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Test OpenAI call with rate limiting
    const response = await openaiClient.chatCompletionsCreate({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Respond briefly."
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
      stream: false,
    }, {
      userId,
      operation: 'test_call',
      model: 'gpt-3.5-turbo'
    });

    return NextResponse.json({
      success: true,
      data: {
        response: response.choices[0]?.message?.content,
        usage: response.usage
      }
    });

  } catch (error) {
    console.error("❌ Error testing OpenAI call:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to test OpenAI call",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 