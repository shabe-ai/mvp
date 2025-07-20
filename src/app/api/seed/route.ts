import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { teamId, userId } = await req.json();

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "Team ID and User ID are required" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.seed.seedSampleData, {
      teamId,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error seeding data:", error);
    return NextResponse.json(
      { error: "Failed to seed data" },
      { status: 500 }
    );
  }
} 