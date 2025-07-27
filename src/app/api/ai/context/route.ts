import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { aiContextService } from '@/lib/aiContext';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const { query, teamId, maxResults = 3 } = await request.json();

    if (!query || !teamId) {
      return NextResponse.json(
        { error: 'query and teamId are required' },
        { status: 400 }
      );
    }

    console.log(`🧠 Creating AI context for query: "${query}"`);
    console.log(`🔍 Using teamId: ${teamId}`);
    
    // Get AI context from stored documents
    const contextResult = await aiContextService.createAIContext(
      query,
      teamId,
      maxResults
    );
    
    console.log(`📊 Context result:`, {
      hasRelevantDocuments: contextResult.hasRelevantDocuments,
      totalDocuments: contextResult.totalDocuments,
      documentsFound: contextResult.documents.length
    });

    return NextResponse.json({
      success: true,
      hasRelevantDocuments: contextResult.hasRelevantDocuments,
      context: contextResult.context,
      documents: contextResult.documents,
      totalDocuments: contextResult.totalDocuments,
      query,
    });

  } catch (error) {
    console.error('❌ AI context error:', error);
    return NextResponse.json(
      { error: 'Failed to create AI context' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      );
    }

    // Get document statistics
    const stats = await aiContextService.getTeamDocumentStats(teamId);

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('❌ Document stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get document statistics' },
      { status: 500 }
    );
  }
} 