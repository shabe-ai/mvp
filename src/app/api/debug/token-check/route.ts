import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/tokenStorage';

export async function GET() {
  try {
    const userId = 'user_30yNzzaqY36tW07nKprV52twdEQ';
    
    console.log('🔍 Debug token check for user:', userId);
    
    const hasToken = await TokenStorage.hasValidToken(userId);
    const token = await TokenStorage.getToken(userId);
    const tokenInfo = await TokenStorage.getTokenInfo(userId);
    const allTokens = await TokenStorage.getAllTokens();
    
    console.log('🔍 Debug token results:', {
      hasToken,
      tokenExists: !!token,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email
      } : null,
      totalTokens: Object.keys(allTokens).length
    });
    
    return NextResponse.json({
      userId,
      hasToken,
      token: token ? '***' : null,
      userEmail: tokenInfo?.email,
      tokenInfo: tokenInfo ? {
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        email: tokenInfo.email,
        createdAt: tokenInfo.createdAt,
        expiresAt: tokenInfo.expiresAt
      } : null,
      totalTokens: Object.keys(allTokens).length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in debug token check:', error);
    return NextResponse.json(
      { error: 'Failed to check token', details: error },
      { status: 500 }
    );
  }
} 