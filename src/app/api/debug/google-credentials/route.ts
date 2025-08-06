import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    return NextResponse.json({
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientSecretLength: clientSecret?.length || 0,
      clientIdPreview: clientId ? `${clientId.substring(0, 20)}...` : null,
      clientSecretPreview: clientSecret ? `${clientSecret.substring(0, 10)}...` : null,
      baseUrl,
      redirectUri: `${baseUrl}/api/auth/google/callback`,
      allEnvVars: {
        GOOGLE_CLIENT_ID: clientId,
        GOOGLE_CLIENT_SECRET: clientSecret,
        NEXT_PUBLIC_BASE_URL: baseUrl
      }
    });

  } catch (error) {
    console.error('❌ Error checking Google credentials:', error);
    return NextResponse.json(
      { error: 'Failed to check credentials' },
      { status: 500 }
    );
  }
} 