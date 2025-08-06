import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const session = await auth();
    const user = await currentUser();
    
    return NextResponse.json({
      authenticated: !!session?.userId,
      userId: session?.userId,
      userEmail: user?.emailAddresses?.[0]?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName,
      sessionExists: !!session,
      userExists: !!user
    });
  } catch (error) {
    console.error('❌ Error testing auth:', error);
    return NextResponse.json(
      { error: 'Failed to test authentication' },
      { status: 500 }
    );
  }
} 