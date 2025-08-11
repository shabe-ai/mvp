import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { personalizationEngine } from '@/lib/personalizationEngine';
import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'track_interaction':
        await personalizationEngine.trackUserInteraction(userId, data.action, data.metadata);
        return NextResponse.json({ success: true });

      case 'generate_dashboard':
        // Get user's data for dashboard generation
        const teams = await convex.query(api.crm.getTeamsByUser, { userId });
        const teamId = teams.length > 0 ? teams[0]._id : 'default';
        
        const userData = {
          contacts: await convex.query(api.crm.getContactsByTeam, { teamId }),
          deals: await convex.query(api.crm.getDealsByTeam, { teamId }),
          accounts: await convex.query(api.crm.getAccountsByTeam, { teamId }),
          activities: await convex.query(api.crm.getActivitiesByTeam, { teamId })
        };
        
        const dashboard = await personalizationEngine.generatePersonalizedDashboard(userId, userData);
        return NextResponse.json({ dashboard });

      case 'generate_insights':
        // Get user's data for insight generation
        const userTeams = await convex.query(api.crm.getTeamsByUser, { userId });
        const userTeamId = userTeams.length > 0 ? userTeams[0]._id : 'default';
        
        const insightData = {
          contacts: await convex.query(api.crm.getContactsByTeam, { teamId: userTeamId }),
          deals: await convex.query(api.crm.getDealsByTeam, { teamId: userTeamId }),
          accounts: await convex.query(api.crm.getAccountsByTeam, { teamId: userTeamId }),
          activities: await convex.query(api.crm.getActivitiesByTeam, { teamId: userTeamId })
        };
        
        const insights = await personalizationEngine.generatePersonalizedInsights(userId, insightData);
        return NextResponse.json({ insights });

      case 'adapt_ui':
        const adaptiveUI = await personalizationEngine.adaptUI(userId);
        return NextResponse.json({ adaptiveUI });

      case 'get_recommendations':
        const recommendations = await personalizationEngine.getRecommendations(userId);
        return NextResponse.json({ recommendations });

      case 'get_behavior':
        const behavior = personalizationEngine.getUserBehavior(userId);
        return NextResponse.json({ behavior });

      case 'get_dashboard':
        const existingDashboard = personalizationEngine.getDashboard(userId);
        return NextResponse.json({ dashboard: existingDashboard });

      case 'get_insights':
        const existingInsights = personalizationEngine.getInsights(userId);
        return NextResponse.json({ insights: existingInsights });

      case 'get_ui':
        const existingUI = personalizationEngine.getUI(userId);
        return NextResponse.json({ adaptiveUI: existingUI });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Personalization API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'behavior':
        const behavior = personalizationEngine.getUserBehavior(userId);
        return NextResponse.json({ behavior });

      case 'dashboard':
        const dashboard = personalizationEngine.getDashboard(userId);
        return NextResponse.json({ dashboard });

      case 'insights':
        const insights = personalizationEngine.getInsights(userId);
        return NextResponse.json({ insights });

      case 'ui':
        const adaptiveUI = personalizationEngine.getUI(userId);
        return NextResponse.json({ adaptiveUI });

      case 'recommendations':
        const recommendations = await personalizationEngine.getRecommendations(userId);
        return NextResponse.json({ recommendations });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Personalization API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 