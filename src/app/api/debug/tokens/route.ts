import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    // Get all stored tokens
    const allTokens = await TokenStorage.getAllTokens();
    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    const tokenInfo = await TokenStorage.getTokenInfo(userId);
    const hasToken = await TokenStorage.hasValidToken(userId);
    
    return NextResponse.json({
      allTokens: Object.keys(allTokens),
      hasTokenForUser: hasToken,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email,
        createdAt: tokenInfo.createdAt,
        lastRefreshed: tokenInfo.lastRefreshed,
        expiresAt: tokenInfo.expiresAt
      } : null,
      userId: userId,
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