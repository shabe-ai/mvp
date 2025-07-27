import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleDriveService } from '@/lib/googleDrive';

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

    const { fileId } = await request.json();

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

    console.log(`📖 Reading document content on-demand: ${fileId}`);
    
    // Extract text from the file on-demand
    const extractedText = await driveService.extractTextFromFile(fileId);
    
    if (!extractedText || extractedText.length < 50) {
      return NextResponse.json({
        error: 'Document too short or extraction failed',
        textLength: extractedText?.length || 0
      });
    }

    return NextResponse.json({
      success: true,
      fileId,
      content: extractedText,
      textLength: extractedText.length
    });

  } catch (error) {
    console.error('❌ Document reading error:', error);
    return NextResponse.json(
      { error: 'Failed to read document content' },
      { status: 500 }
    );
  }
} 