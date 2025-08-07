import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.userId;
    
    return NextResponse.json({
      domain: process.env.NEXT_PUBLIC_BASE_URL,
      hasSession: !!session,
      userId: userId,
      sessionExists: !!session,
      environment: process.env.NODE_ENV,
      clerkDomain: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes('api.app.shabe.ai') ? 'api.app.shabe.ai' : 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in subdomain test:', error);
    return NextResponse.json(
      { error: 'Failed to test subdomain configuration', details: error },
      { status: 500 }
    );
  }
} 