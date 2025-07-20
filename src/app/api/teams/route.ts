import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, ownerId } = await req.json();

    if (!name || !ownerId) {
      return NextResponse.json(
        { error: "Team name and owner ID are required" },
        { status: 400 }
      );
    }

    const teamId = await convex.mutation(api.crm.createTeam, {
      name,
      ownerId,
    });

    // Return the created team
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: ownerId });
    const createdTeam = teams.find(team => team._id === teamId);

    return NextResponse.json(createdTeam);
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
} 