import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TokenData } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');
    const TOKEN_BACKUP_FILE = path.join(process.cwd(), '.tokens.backup.json');
    
    let tokens: { [key: string]: TokenData } = {};
    
    // Check if token files exist
    if (fs.existsSync(TOKEN_FILE)) {
      try {
        const data = fs.readFileSync(TOKEN_FILE, 'utf8');
        tokens = JSON.parse(data);
      } catch (error) {
        console.error('Error reading token file:', error);
      }
    }
    
    if (fs.existsSync(TOKEN_BACKUP_FILE)) {
      try {
        const backupData = fs.readFileSync(TOKEN_BACKUP_FILE, 'utf8');
        const backupTokens = JSON.parse(backupData);
        tokens = { ...tokens, ...backupTokens };
      } catch (error) {
        console.error('Error reading backup token file:', error);
      }
    }
    
    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    const userToken = tokens[userId];
    
    return NextResponse.json({
      hasTokenFile: fs.existsSync(TOKEN_FILE),
      hasBackupFile: fs.existsSync(TOKEN_BACKUP_FILE),
      allUserIds: Object.keys(tokens),
      userToken: userToken ? {
        hasAccessToken: !!userToken.accessToken,
        hasRefreshToken: !!userToken.refreshToken,
        email: userToken.email,
        createdAt: userToken.createdAt,
        expiresAt: userToken.expiresAt
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error checking simple tokens:', error);
    return NextResponse.json(
      { error: 'Failed to check simple tokens', details: error },
      { status: 500 }
    );
  }
} 