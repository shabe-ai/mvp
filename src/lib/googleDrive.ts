import { google } from 'googleapis';
import { TokenStorage } from './tokenStorage';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Google Drive API scopes
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  files: DriveFile[];
  subfolders: DriveFolder[];
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  content: string;
  mimeType: string;
  lastModified: Date;
  folderPath: string;
  size: number;
}

export class GoogleDriveService {
  private drive: ReturnType<typeof google.drive>;

  constructor(accessToken: string) {
    oauth2Client.setCredentials({
      access_token: accessToken,
    });
    
    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Get all files in a specific folder
   */
  async getFolderContents(folderId: string): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,size,modifiedTime,parents,webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      return (response.data.files || []).filter(file => file.id) as DriveFile[];
    } catch (error) {
      console.error('❌ Error getting folder contents:', error);
      throw error;
    }
  }

  /**
   * Get folder structure recursively
   */
  async getFolderStructure(folderId: string): Promise<DriveFolder> {
    try {
      // Get folder info
      const folderResponse = await this.drive.files.get({
        fileId: folderId,
        fields: 'id,name'
      });

      const folder: DriveFolder = {
        id: folderResponse.data.id!,
        name: folderResponse.data.name!,
        files: [],
        subfolders: []
      };

      // Get all items in folder
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,size,modifiedTime,parents)',
        orderBy: 'name'
      });

      const items = (response.data.files || []).filter(item => item.id);

      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Recursively get subfolder contents
          const subfolder = await this.getFolderStructure(item.id!);
          folder.subfolders.push(subfolder);
        } else {
          // Add file
          folder.files.push(item as DriveFile);
        }
      }

      return folder;
    } catch (error) {
      console.error('❌ Error getting folder structure:', error);
      throw error;
    }
  }

  /**
   * Extract text content from a file
   */
  async extractTextFromFile(fileId: string): Promise<string> {
    try {
      // Get file metadata first
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size'
      });

      const file = fileResponse.data;
      console.log(`📄 Processing file: ${file.name} (${file.mimeType})`);

      // Handle different file types
      switch (file.mimeType) {
        case 'text/plain':
          return await this.extractTextFile(fileId);
        
        case 'application/pdf':
          return await this.extractPdfFile(fileId);
        
        case 'application/vnd.google-apps.document':
          return await this.extractGoogleDoc(fileId);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractWordDoc(fileId);
        
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          return await this.extractExcelFile(fileId);
        
        default:
          console.warn(`⚠️ Unsupported file type: ${file.mimeType}`);
          return '';
      }
    } catch (error) {
      console.error('❌ Error extracting text from file:', error);
      throw error;
    }
  }

  /**
   * Extract text from plain text files
   */
  private async extractTextFile(fileId: string): Promise<string> {
    const response = await this.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    return response.data as string;
  }

  /**
   * Extract text from PDF files
   */
  private async extractPdfFile(fileId: string): Promise<string> {
    try {
      // Download the PDF file
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      // Parse PDF content
      const pdfBuffer = Buffer.from(response.data as string, 'base64');
      const pdfData = await pdf(pdfBuffer);
      
      return pdfData.text;
    } catch (error) {
      console.error('❌ Error extracting PDF text:', error);
      return '[PDF content - extraction failed]';
    }
  }

  /**
   * Extract text from Google Docs
   */
  private async extractGoogleDoc(fileId: string): Promise<string> {
    const response = await this.drive.files.export({
      fileId: fileId,
      mimeType: 'text/plain'
    });
    
    return response.data as string;
  }

  /**
   * Extract text from Word documents
   */
  private async extractWordDoc(fileId: string): Promise<string> {
    try {
      // Download the Word document
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      // Parse Word document content
      const docBuffer = Buffer.from(response.data as string, 'base64');
      const result = await mammoth.extractRawText({ buffer: docBuffer });
      
      return result.value;
    } catch (error) {
      console.error('❌ Error extracting Word document text:', error);
      return '[Word document content - extraction failed]';
    }
  }

  /**
   * Extract text from Excel files
   */
  private async extractExcelFile(fileId: string): Promise<string> {
    try {
      // Download the Excel file
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      // Parse Excel content
      const excelBuffer = Buffer.from(response.data as string, 'base64');
      const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
      
      let textContent = '';
      
      // Extract text from all sheets
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        textContent += `Sheet: ${sheetName}\n`;
        jsonData.forEach((row: unknown) => {
          if (Array.isArray(row) && row.length > 0) {
            textContent += row.join('\t') + '\n';
          }
        });
        textContent += '\n';
      });
      
      return textContent;
    } catch (error) {
      console.error('❌ Error extracting Excel text:', error);
      return '[Excel content - extraction failed]';
    }
  }

  /**
   * Get user's root folder and shared folders
   */
  async getAvailableFolders(): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id,name,mimeType,modifiedTime)',
        orderBy: 'name'
      });

      return (response.data.files || []).filter(file => file.id) as DriveFile[];
    } catch (error) {
      console.error('❌ Error getting available folders:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string) {
    try {
      return await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,modifiedTime'
      });
    } catch (error) {
      console.error('❌ Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Monitor folder for changes (returns files modified since a given date)
   */
  async getModifiedFiles(folderId: string, sinceDate: Date): Promise<DriveFile[]> {
    try {
      const sinceDateString = sinceDate.toISOString();
      
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false and modifiedTime > '${sinceDateString}'`,
        fields: 'files(id,name,mimeType,size,modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      return (response.data.files || []).filter(file => file.id) as DriveFile[];
    } catch (error) {
      console.error('❌ Error getting modified files:', error);
      throw error;
    }
  }
}

/**
 * Get Google Drive service for a user
 */
export async function getGoogleDriveService(userId: string): Promise<GoogleDriveService | null> {
  try {
    console.log('🔍 Getting Google Drive service for user:', userId);
    const accessToken = await TokenStorage.getToken(userId);
    
    if (!accessToken) {
      console.log('❌ No Google access token found for user:', userId);
      return null;
    }

    console.log('✅ Google access token found, creating Drive service');
    return new GoogleDriveService(accessToken);
  } catch (error) {
    console.error('❌ Error getting Google Drive service:', error);
    return null;
  }
} 