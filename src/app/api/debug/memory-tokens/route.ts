import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Access the memory tokens from the tokenStorage module
    const { TokenStorage } = await import('@/lib/tokenStorage');
    
    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
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
    console.error('❌ Error checking memory tokens:', error);
    return NextResponse.json(
      { error: 'Failed to check memory tokens', details: error },
      { status: 500 }
    );
  }
} 