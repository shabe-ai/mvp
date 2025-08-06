import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasClerkKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
      hasConvexUrl: !!process.env.NEXT_PUBLIC_CONVEX_URL,
      hasSentryDsn: !!process.env.SENTRY_DSN,
      hasPostHogKey: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
      // Don't expose actual values for security
      googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
      googleClientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
    });
  } catch (error) {
    console.error('❌ Error in env debug:', error);
    return NextResponse.json(
      { error: 'Failed to check environment' },
      { status: 500 }
    );
  }
} 