import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test the OAuth URL generation
    const oauthResponse = await fetch('https://app.shabe.ai/api/auth/google');
    const oauthData = await oauthResponse.json();
    
    return NextResponse.json({
      oauthUrlGenerated: !!oauthData.authUrl,
      oauthUrl: oauthData.authUrl,
      hasError: !!oauthData.error,
      error: oauthData.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error testing OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to test OAuth flow', details: error },
      { status: 500 }
    );
  }
} 