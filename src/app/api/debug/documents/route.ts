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

    console.log(`🔍 Debug: Fetching documents for team: ${teamId}`);

    // Get all documents for the team
    const documents = await convex.query(api.documents.getTeamDocuments, {
      teamId,
    });

    // Get all chunks for the team
    const chunks = await convex.query(api.documents.getTeamChunks, {
      teamId,
    });

    return NextResponse.json({
      success: true,
      teamId,
      documents,
      chunks,
      documentCount: documents.length,
      chunkCount: chunks.length,
    });

  } catch (error) {
    console.error('❌ Debug documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Debug: Deleting document with fileId: ${fileId}`);

    // Get the document by fileId
    const document = await convex.query(api.documents.getDocumentByFileId, {
      fileId,
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete the document and its chunks
    await convex.mutation(api.documents.deleteDocument, {
      documentId: document._id,
    });

    return NextResponse.json({
      success: true,
      message: `Document ${fileId} deleted successfully`,
      deletedDocument: document,
    });

  } catch (error) {
    console.error('❌ Debug delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
} 