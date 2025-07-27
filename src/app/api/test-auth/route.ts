import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;

    console.log('🔍 Test Auth API - Session:', { userId: userId ? 'present' : 'missing' });

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', session: null },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'Authentication working correctly'
    });

  } catch (error) {
    console.error('❌ Test Auth API error:', error);
    return NextResponse.json(
      { error: 'Authentication test failed', details: error },
      { status: 500 }
    );
  }
} 