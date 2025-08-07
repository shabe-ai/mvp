import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.userId;

    console.log('🔍 Test token - Session:', { userId: userId ? 'present' : 'missing' });

    // Use hardcoded userId for testing since session isn't working
    const testUserId = userId || 'user_30yNzzaqY36tW07nKprV52twdEQ';
    
    // Test token storage with async methods
    const hasToken = await TokenStorage.hasValidToken(testUserId);
    const token = await TokenStorage.getToken(testUserId);
    const tokenInfo = TokenStorage.getTokenInfo(testUserId);
    const persistentConnection = TokenStorage.isPersistentConnection(testUserId);

    return NextResponse.json({
      userId: testUserId,
      hasToken,
      hasRefreshToken: !!tokenInfo?.refreshToken,
      tokenExists: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null,
      connectionStatus: hasToken ? 'connected' : 'disconnected',
      persistentConnection,
      userEmail: tokenInfo?.email,
      tokenCreatedAt: tokenInfo?.createdAt,
      lastRefreshed: tokenInfo?.lastRefreshed,
      sessionUserId: userId,
      usingFallbackUserId: !userId
    });

  } catch (error) {
    console.error('❌ Error testing token:', error);
    return NextResponse.json(
      { error: 'Failed to test token', details: error },
      { status: 500 }
    );
  }
} 