import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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

    const { fileId, teamId } = await request.json();

    if (!fileId || !teamId) {
      return NextResponse.json(
        { error: 'fileId and teamId are required' },
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

    console.log(`💾 Processing and storing document: ${fileId}`);
    
    // Get file metadata
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

    console.log(`💾 Storing document in Convex with data:`, {
      teamId,
      createdBy: userId,
      fileName: processedDocument.fileName,
      fileType: processedDocument.fileType,
      fileId: processedDocument.id,
      contentLength: processedDocument.content.length,
      chunkCount: processedDocument.chunks.length,
    });

    // Store document in Convex
    let documentId: string; // Will be Convex ID type
    try {
      documentId = await convex.mutation(api.documents.storeDocument, {
        teamId,
        createdBy: userId, // Pass the user ID directly
        fileName: processedDocument.fileName,
        fileType: processedDocument.fileType,
        fileId: processedDocument.id,
        folderPath: processedDocument.folderPath,
        contentLength: processedDocument.content.length,
        chunkCount: processedDocument.chunks.length,
        embeddingCount: processedDocument.embeddingCount,
        lastModified: processedDocument.lastModified.getTime(),
      });

      console.log(`📄 Convex mutation result:`, documentId);

      if (!documentId) {
        throw new Error('Failed to store document');
      }
    } catch (error) {
      console.error('❌ Convex mutation error:', error);
      throw new Error(`Convex mutation failed: ${error}`);
    }

    // Store document chunks with embeddings
    const chunksForStorage = processedDocument.chunks.map(chunk => ({
      chunkIndex: chunk.metadata.chunkIndex,
      text: chunk.text,
      embedding: chunk.embedding,
      metadata: {
        fileName: chunk.metadata.fileName,
        fileType: chunk.metadata.fileType,
        folderPath: chunk.metadata.folderPath,
        totalChunks: chunk.metadata.totalChunks,
        lastModified: chunk.metadata.lastModified.getTime(),
      },
    }));

    const chunkIds = await convex.mutation(api.documents.storeDocumentChunks, {
      teamId,
      createdBy: userId, // Pass the user ID directly
      documentId: documentId as Id<"documents">,
      chunks: chunksForStorage,
    });

    return NextResponse.json({
      success: true,
      documentId,
      chunkIds,
      fileName: processedDocument.fileName,
      fileType: processedDocument.fileType,
      textLength: processedDocument.content.length,
      chunkCount: processedDocument.chunks.length,
      embeddingCount: processedDocument.embeddingCount,
    });

  } catch (error) {
    console.error('❌ Document storage error:', error);
    return NextResponse.json(
      { error: 'Failed to store document' },
      { status: 500 }
    );
  }
} 