import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
    const teamId = searchParams.get('teamId') || 'default-team';

    console.log(`🔍 Debug: Checking documents for team: ${teamId}`);

    // Get all documents for the team
    const documents = await convex.query(api.documents.getTeamDocuments, {
      teamId,
    });

    // Get all chunks for the team
    const chunks = await convex.query(api.documents.getTeamChunks, {
      teamId,
    });

    console.log(`📄 Found ${documents.length} documents and ${chunks.length} chunks`);

    return NextResponse.json({
      success: true,
      teamId,
      documents: documents.map(doc => ({
        id: doc._id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        contentLength: doc.contentLength,
        chunkCount: doc.chunkCount,
        processingStatus: doc.processingStatus,
        createdAt: doc.createdAt,
      })),
      chunks: chunks.map(chunk => ({
        id: chunk._id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        textLength: chunk.text.length,
        fileName: chunk.metadata.fileName,
      })),
      stats: {
        totalDocuments: documents.length,
        totalChunks: chunks.length,
      }
    });

  } catch (error) {
    console.error('❌ Debug documents error:', error);
    return NextResponse.json(
      { error: 'Failed to debug documents' },
      { status: 500 }
    );
  }
} 