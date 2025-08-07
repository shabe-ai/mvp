import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
      expectedDomain: 'https://app.shabe.ai',
      domainMatches: process.env.NEXT_PUBLIC_BASE_URL === 'https://app.shabe.ai',
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasClerkKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in domain debug:', error);
    return NextResponse.json(
      { error: 'Failed to check domain configuration' },
      { status: 500 }
    );
  }
} 