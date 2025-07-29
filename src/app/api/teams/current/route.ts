import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { 
  handleApiError, 
  AuthenticationError 
} from '@/lib/errorHandler';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      throw new AuthenticationError();
    }

    // Get user's teams
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    
    if (teams.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No teams found for user'
      });
    }

    // Return the first team (or we could implement team selection logic)
    const currentTeam = teams[0];
    
    return NextResponse.json({
      success: true,
      team: {
        id: currentTeam._id,
        name: currentTeam.name,
        ownerId: currentTeam.ownerId,
        members: currentTeam.members
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
} 