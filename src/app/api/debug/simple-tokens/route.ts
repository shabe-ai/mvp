import { NextResponse } from 'next/server';
import { TokenData } from '@/lib/tokenStorage';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('🔍 Checking for token files...');
    
    // Check if token files exist
    const tokenFile = path.join(process.cwd(), '.tokens.json');
    const backupFile = path.join(process.cwd(), '.tokens.backup.json');
    
    let tokens: { [key: string]: TokenData } = {};
    
    try {
      if (fs.existsSync(tokenFile)) {
        const data = fs.readFileSync(tokenFile, 'utf8');
        tokens = JSON.parse(data);
        console.log('📁 Found primary token file');
      } else if (fs.existsSync(backupFile)) {
        const data = fs.readFileSync(backupFile, 'utf8');
        tokens = JSON.parse(data);
        console.log('📁 Found backup token file');
      } else {
        console.log('📁 No token files found');
      }
    } catch (error) {
      console.error('❌ Error reading token files:', error);
    }
    
    return NextResponse.json({
      tokenFilesExist: {
        primary: fs.existsSync(tokenFile),
        backup: fs.existsSync(backupFile)
      },
      tokens,
      tokenCount: Object.keys(tokens).length,
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