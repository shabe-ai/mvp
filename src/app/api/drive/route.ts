import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleDriveService } from '@/lib/googleDrive';
import { 
  handleApiError, 
  validateStringField,
  AuthenticationError,
  ValidationError 
} from '@/lib/errorHandler';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.userId;

    console.log('🔍 Drive API - Session:', { userId: userId ? 'present' : 'missing' });

    if (!userId) {
      throw new AuthenticationError();
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const folderId = searchParams.get('folderId');

    const driveService = await getGoogleDriveService(userId);
    
    if (!driveService) {
      throw new ValidationError(
        'Google Drive not connected. Please connect your Google account first.',
        'GOOGLE_NOT_CONNECTED'
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
          throw new ValidationError('folderId parameter is required', 'MISSING_FOLDER_ID');
        }
        validateStringField(folderId, 'folderId');
        const contents = await driveService.getFolderContents(folderId);
        return NextResponse.json({ contents });

      case 'structure':
        // Get full folder structure
        if (!folderId) {
          throw new ValidationError('folderId parameter is required', 'MISSING_FOLDER_ID');
        }
        validateStringField(folderId, 'folderId');
        const structure = await driveService.getFolderStructure(folderId);
        return NextResponse.json({ structure });

      default:
        throw new ValidationError(
          'Invalid action. Use: folders, contents, or structure',
          'INVALID_ACTION',
          { validActions: ['folders', 'contents', 'structure'] }
        );
    }

  } catch (error) {
    return handleApiError(error);
  }
} 