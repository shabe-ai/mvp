import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import {
  handleApiError,
  validateRequiredFields,
  validateStringField,
  AuthenticationError
} from '@/lib/errorHandler';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      throw new AuthenticationError();
    }

    const body = await req.json();
    validateRequiredFields(body, ['teamId']);
    validateStringField(body.teamId, 'teamId');

    const result = await convex.mutation(api.seed.seedTeamData, {
      teamId: body.teamId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
} 