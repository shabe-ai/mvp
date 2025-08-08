import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const allTokens = TokenStorage.getAllTokens();
    
    console.log('📋 Current tokens in storage:', Object.keys(allTokens).length);
    
    // Format the tokens for environment variable
    const tokensJson = JSON.stringify(allTokens, null, 2);
    
    return NextResponse.json({
      message: 'Current tokens in JSON format for GOOGLE_TOKENS environment variable',
      tokenCount: Object.keys(allTokens).length,
      tokensJson,
      instructions: [
        '1. Copy the tokensJson value below',
        '2. Go to your Vercel project settings',
        '3. Add a new environment variable named GOOGLE_TOKENS',
        '4. Paste the tokensJson as the value',
        '5. Redeploy your application'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting tokens JSON:', error);
    return NextResponse.json(
      { error: 'Failed to get tokens JSON', details: error },
      { status: 500 }
    );
  }
} 