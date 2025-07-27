import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleDriveService } from '@/lib/googleDrive';
import { embeddingsService } from '@/lib/embeddings';

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

    const { fileId, query } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    const driveService = await getGoogleDriveService(userId);
    
    if (!driveService) {
      return NextResponse.json(
        { error: 'Google Drive not connected. Please connect your Google account first.' },
        { status: 400 }
      );
    }

    console.log(`🧠 Processing embeddings for file: ${fileId}`);
    
    // Get file metadata first
    const fileResponse = await driveService.getFileMetadata(fileId);

    const file = fileResponse.data;
    
    // Extract text from the file
    const extractedText = await driveService.extractTextFromFile(fileId);
    
    if (!extractedText || extractedText.length < 50) {
      return NextResponse.json({
        error: 'Document too short or extraction failed',
        textLength: extractedText?.length || 0
      });
    }

    // Process document and create embeddings
    const processedDocument = await embeddingsService.processDocument(
      fileId,
      file.name!,
      file.mimeType!,
      'Unknown', // We'll get this from folder structure later
      extractedText,
      new Date(file.modifiedTime!)
    );

    const response: {
      success: boolean;
      fileId: string;
      fileName?: string;
      fileType?: string;
      textLength: number;
      chunkCount: number;
      embeddingCount: number;
      semanticSearch?: {
        query: string;
        results: Array<{
          chunkText: string;
          similarity: number;
          chunkIndex: number;
        }>;
      };
    } = {
      success: true,
      fileId,
      fileName: file.name || undefined,
      fileType: file.mimeType || undefined,
      textLength: extractedText.length,
      chunkCount: processedDocument.chunks.length,
      embeddingCount: processedDocument.embeddingCount,
    };

    // If query provided, perform semantic search
    if (query) {
      console.log(`🔍 Performing semantic search for: "${query}"`);
      
      const similarDocs = await embeddingsService.findSimilarDocuments(
        query,
        [processedDocument],
        3
      );

      response.semanticSearch = {
        query,
        results: similarDocs.map(result => ({
          chunkText: result.chunk.text.substring(0, 200) + '...',
          similarity: result.similarity,
          chunkIndex: result.chunk.metadata.chunkIndex,
        }))
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Embeddings processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process document embeddings' },
      { status: 500 }
    );
  }
} 