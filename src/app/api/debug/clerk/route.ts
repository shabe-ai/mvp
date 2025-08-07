import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    
    return NextResponse.json({
      hasClerkKey: !!clerkKey,
      hasClerkSecret: !!clerkSecret,
      clerkKeyStartsWith: clerkKey?.substring(0, 10) || 'none',
      clerkSecretStartsWith: clerkSecret?.substring(0, 10) || 'none',
      isProductionKey: clerkKey?.startsWith('pk_live_') || false,
      isProductionSecret: clerkSecret?.startsWith('sk_live_') || false,
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error('❌ Error in clerk debug:', error);
    return NextResponse.json(
      { error: 'Failed to check clerk configuration' },
      { status: 500 }
    );
  }
} 