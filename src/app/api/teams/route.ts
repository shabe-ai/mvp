import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";
import {
  handleApiError,
  validateRequiredFields,
  validateStringField,
  AuthenticationError,
  ValidationError
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

    if (teamId) {
      // Get specific team
      const team = await convex.query(api.crm.getTeamById, { teamId: teamId as Id<"teams"> });
      if (!team) {
        throw new ValidationError('Team not found', 'TEAM_NOT_FOUND');
      }
      return NextResponse.json(team);
    } else {
      // Get all teams for user
      const teams = await convex.query(api.crm.getTeamsByUser, { userId });
      return NextResponse.json(teams);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      throw new AuthenticationError();
    }

    const body = await req.json();
    validateRequiredFields(body, ['name']);
    validateStringField(body.name, 'name', 100);

    const teamId = await convex.mutation(api.crm.createTeam, {
      name: body.name,
      ownerId: userId,
    });

    // Return the created team
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    const createdTeam = teams.find(team => team._id === teamId);

    return NextResponse.json(createdTeam);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      throw new AuthenticationError();
    }

    const body = await req.json();
    validateRequiredFields(body, ['teamId']);
    validateStringField(body.teamId, 'teamId');

    const updateData: Record<string, unknown> = {};
    if (body.name) {
      validateStringField(body.name, 'name', 100);
      updateData.name = body.name;
    }
    if (body.settings) {
      updateData.settings = body.settings;
    }

    await convex.mutation(api.crm.updateTeam, {
      teamId: body.teamId as Id<"teams">,
      ...updateData
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
} 