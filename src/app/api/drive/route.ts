import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleDriveService } from '@/lib/googleDrive';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    console.log('🔍 Drive API - Session:', { userId: userId ? 'present' : 'missing' });

    if (!userId) {
      console.log('❌ Drive API - User not authenticated');
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const folderId = searchParams.get('folderId');

    const driveService = await getGoogleDriveService(userId);
    
    if (!driveService) {
      return NextResponse.json(
        { error: 'Google Drive not connected. Please connect your Google account first.' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'folders':
        // Get available folders
        const folders = await driveService.getAvailableFolders();
        return NextResponse.json({ folders });

      case 'contents':
        // Get contents of a specific folder
        if (!folderId) {
          return NextResponse.json(
            { error: 'folderId parameter is required' },
            { status: 400 }
          );
        }
        const contents = await driveService.getFolderContents(folderId);
        return NextResponse.json({ contents });

      case 'structure':
        // Get full folder structure
        if (!folderId) {
          return NextResponse.json(
            { error: 'folderId parameter is required' },
            { status: 400 }
          );
        }
        const structure = await driveService.getFolderStructure(folderId);
        return NextResponse.json({ structure });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: folders, contents, or structure' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Google Drive API error:', error);
    return NextResponse.json(
      { error: 'Failed to access Google Drive' },
      { status: 500 }
    );
  }
} 