import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    
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
      lastRefreshed: tokenInfo?.lastRefreshed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error checking tokens:', error);
    return NextResponse.json(
      { error: 'Failed to check tokens', details: error },
      { status: 500 }
    );
  }
} 