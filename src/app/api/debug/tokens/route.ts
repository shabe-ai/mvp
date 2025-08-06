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

    // Get all tokens for debugging
    const allTokens = TokenStorage.getAllTokens();
    const userTokenInfo = TokenStorage.getTokenInfo(userId);
    const hasValidToken = await TokenStorage.hasValidToken(userId);
    const isPersistent = TokenStorage.isPersistentConnection(userId);

    return NextResponse.json({
      currentUser: {
        userId,
        hasValidToken,
        isPersistent,
        tokenInfo: userTokenInfo ? {
          hasRefreshToken: !!userTokenInfo.refreshToken,
          email: userTokenInfo.email,
          createdAt: userTokenInfo.createdAt,
          lastRefreshed: userTokenInfo.lastRefreshed,
          expiresAt: userTokenInfo.expiresAt,
          isExpired: Date.now() > userTokenInfo.expiresAt
        } : null
      },
      allTokens: Object.keys(allTokens).map(userId => ({
        userId,
        hasToken: !!allTokens[userId],
        hasRefreshToken: !!allTokens[userId]?.refreshToken,
        email: allTokens[userId]?.email,
        isExpired: allTokens[userId] ? Date.now() > allTokens[userId].expiresAt : true
      })),
      summary: {
        totalTokens: Object.keys(allTokens).length,
        persistentConnections: Object.values(allTokens).filter(token => !!token.refreshToken).length,
        expiredTokens: Object.values(allTokens).filter(token => Date.now() > token.expiresAt).length
      }
    });

  } catch (error) {
    console.error('❌ Error debugging tokens:', error);
    return NextResponse.json(
      { error: 'Failed to debug tokens' },
      { status: 500 }
    );
  }
} 