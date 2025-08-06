import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.userId;

    console.log('🔍 Test token - Session:', { userId: userId ? 'present' : 'missing' });

    // TEMPORARY: Allow testing without authentication for debugging
    if (!userId) {
      console.log('⚠️ Test token - No user session, returning debug info');
      return NextResponse.json({
        error: 'User not authenticated',
        debug: {
          sessionExists: !!session,
          userId: userId,
          environment: process.env.NODE_ENV,
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL
        }
      });
    }

    // Test token storage with async methods
    const hasToken = await TokenStorage.hasValidToken(userId);
    const token = await TokenStorage.getToken(userId);
    const tokenInfo = TokenStorage.getTokenInfo(userId);
    const persistentConnection = TokenStorage.isPersistentConnection(userId);

    return NextResponse.json({
      userId,
      hasToken,
      hasRefreshToken: !!tokenInfo?.refreshToken,
      tokenExists: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null,
      connectionStatus: hasToken ? 'connected' : 'disconnected',
      persistentConnection,
      userEmail: tokenInfo?.email,
      tokenCreatedAt: tokenInfo?.createdAt,
      lastRefreshed: tokenInfo?.lastRefreshed
    });

  } catch (error) {
    console.error('❌ Error testing token:', error);
    return NextResponse.json(
      { error: 'Failed to test token', details: error },
      { status: 500 }
    );
  }
} 