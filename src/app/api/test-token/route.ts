import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Test token storage with async methods
    const hasToken = await TokenStorage.hasValidToken(userId);
    const token = await TokenStorage.getToken(userId);
    const hasRefreshToken = !!TokenStorage.getRefreshToken(userId);

    return NextResponse.json({
      userId,
      hasToken,
      hasRefreshToken,
      tokenExists: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null,
      connectionStatus: hasToken ? 'connected' : 'disconnected',
      persistentConnection: hasToken && hasRefreshToken
    });

  } catch (error) {
    console.error('❌ Error testing token:', error);
    return NextResponse.json(
      { error: 'Failed to test token' },
      { status: 500 }
    );
  }
} 