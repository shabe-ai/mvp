import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import {
  handleApiError,
  validateStringField,
  AuthenticationError
} from '@/lib/errorHandler';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      throw new AuthenticationError();
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      throw new Error("Team ID is required");
    }

    validateStringField(teamId, 'teamId');

    const stats = await convex.query(api.crm.getTeamStats, { teamId });
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
} 