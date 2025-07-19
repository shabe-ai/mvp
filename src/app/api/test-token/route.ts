import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Test token storage
    const hasToken = TokenStorage.hasValidToken(userId);
    const token = TokenStorage.getToken(userId);

    return NextResponse.json({
      userId,
      hasToken,
      tokenExists: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null
    });

  } catch (error) {
    console.error('❌ Error testing token:', error);
    return NextResponse.json(
      { error: 'Failed to test token' },
      { status: 500 }
    );
  }
} 