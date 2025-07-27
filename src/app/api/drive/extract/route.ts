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

    console.log(`📄 Extracting text from file: ${fileId}`);
    
    // Extract text from the file
    const extractedText = await driveService.extractTextFromFile(fileId);
    
    return NextResponse.json({
      success: true,
      fileId,
      extractedText,
      textLength: extractedText.length
    });

  } catch (error) {
    console.error('❌ Document extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract document text' },
      { status: 500 }
    );
  }
} 